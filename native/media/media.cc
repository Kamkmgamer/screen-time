// Reads the Windows media session list: which apps are playing, and their play
// state. Used by the tracker so a video keeps counting when nobody touches the
// keyboard, while a machine that is genuinely idle does not.
//
// Windows exposes this as WinRT (GlobalSystemMediaTransportControlsSessionManager).
// The call is asynchronous, so it runs on a worker thread and never blocks the
// main process.

#include <napi.h>

#include <string>
#include <vector>

#include <winrt/base.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Media.Control.h>

namespace {

namespace control = winrt::Windows::Media::Control;

// Closed 0, Opened 1, Changing 2, Stopped 3, Playing 4, Paused 5.
constexpr int kPlaying = 4;

struct SessionInfo {
  std::string aumid;
  int status = 0;
};

class SessionWorker : public Napi::AsyncWorker {
 public:
  explicit SessionWorker(Napi::Env env)
      : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)) {}

  Napi::Promise Promise() const { return deferred_.Promise(); }

  void Execute() override {
    try {
      winrt::init_apartment(winrt::apartment_type::multi_threaded);
    } catch (...) {
      // A thread that already picked an apartment is fine; the calls below still work.
    }
    try {
      auto manager = control::GlobalSystemMediaTransportControlsSessionManager::RequestAsync().get();
      auto sessions = manager.GetSessions();
      const uint32_t count = sessions.Size();
      sessions_.reserve(count);
      for (uint32_t index = 0; index < count; index++) {
        auto session = sessions.GetAt(index);
        SessionInfo info;
        try {
          info.aumid = winrt::to_string(session.SourceAppUserModelId());
        } catch (...) {
          continue;
        }
        if (info.aumid.empty()) continue;
        try {
          info.status = static_cast<int>(session.GetPlaybackInfo().PlaybackStatus());
        } catch (...) {
          info.status = 0;
        }
        sessions_.push_back(std::move(info));
      }
      ok_ = true;
    } catch (winrt::hresult_error const& error) {
      message_ = winrt::to_string(error.message());
    } catch (std::exception const& error) {
      message_ = error.what();
    } catch (...) {
      message_ = "media session query failed";
    }
  }

  void OnOK() override {
    Napi::Env env = Env();
    if (!ok_) {
      deferred_.Reject(Napi::Error::New(env, message_.empty() ? "media session unavailable" : message_).Value());
      return;
    }
    Napi::Array out = Napi::Array::New(env, sessions_.size());
    for (size_t index = 0; index < sessions_.size(); index++) {
      Napi::Object row = Napi::Object::New(env);
      row.Set("aumid", Napi::String::New(env, sessions_[index].aumid));
      row.Set("status", Napi::Number::New(env, sessions_[index].status));
      row.Set("playing", Napi::Boolean::New(env, sessions_[index].status == kPlaying));
      out.Set(static_cast<uint32_t>(index), row);
    }
    deferred_.Resolve(out);
  }

  void OnError(const Napi::Error& error) override { deferred_.Reject(error.Value()); }

 private:
  Napi::Promise::Deferred deferred_;
  std::vector<SessionInfo> sessions_;
  std::string message_;
  bool ok_ = false;
};

Napi::Value Sessions(const Napi::CallbackInfo& info) {
  auto* worker = new SessionWorker(info.Env());
  Napi::Promise promise = worker->Promise();
  worker->Queue();
  return promise;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("sessions", Napi::Function::New(env, Sessions));
  return exports;
}

}  // namespace

NODE_API_MODULE(tally_media, Init)
