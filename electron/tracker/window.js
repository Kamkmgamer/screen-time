'use strict';

// Reads the foreground window through Win32 directly (koffi, no helper process).
// Windows is the supported platform; elsewhere read() returns null and the app says so.

let native = null;

function loadNative() {
  if (native) return native;
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const kernel32 = koffi.load('kernel32.dll');
  native = {
    GetForegroundWindow: user32.func('void *GetForegroundWindow()'),
    GetWindowTextW: user32.func('int GetWindowTextW(void *hWnd, uint16_t *lpString, int nMaxCount)'),
    GetWindowThreadProcessId: user32.func('uint32_t GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *lpdwProcessId)'),
    OpenProcess: kernel32.func('void *OpenProcess(uint32_t access, bool inherit, uint32_t pid)'),
    QueryFullProcessImageNameW: kernel32.func('bool QueryFullProcessImageNameW(void *h, uint32_t flags, uint16_t *buf, _Inout_ uint32_t *size)'),
    CloseHandle: kernel32.func('bool CloseHandle(void *h)'),
    GetLastInputInfo: user32.func('bool GetLastInputInfo(_Inout_ void *plii)'),
    GetTickCount64: kernel32.func('uint64_t GetTickCount64()'),
  };
  return native;
}

const titleBuffer = Buffer.alloc(2048);
const pathBuffer = Buffer.alloc(4096);

function cleanTitle(raw) {
  return String(raw || '')
    .replace(/\u200b|\u200e|\u200f/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function readForeground() {
  if (process.platform !== 'win32') return null;
  try {
    const api = loadNative();
    const hwnd = api.GetForegroundWindow();
    if (!hwnd) return null;

    const length = api.GetWindowTextW(hwnd, titleBuffer, 1024);
    const title = cleanTitle(titleBuffer.toString('utf16le', 0, Math.max(0, length) * 2));

    const pidOut = [0];
    api.GetWindowThreadProcessId(hwnd, pidOut);
    const pid = pidOut[0] || 0;

    let exePath = '';
    const handle = pid ? api.OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pid) : null;
    if (handle) {
      const size = [2048];
      if (api.QueryFullProcessImageNameW(handle, 0, pathBuffer, size)) {
        exePath = pathBuffer.toString('utf16le', 0, size[0] * 2);
      }
      api.CloseHandle(handle);
    }

    const info = Buffer.alloc(8);
    info.writeUInt32LE(8, 0);
    let idleMs = 0;
    if (api.GetLastInputInfo(info)) {
      const last = info.readUInt32LE(4);
      const now = Number(api.GetTickCount64()) >>> 0;
      idleMs = (now - last) >>> 0;
    }

    return { title, pid, exePath, idleMs };
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = { readForeground };
