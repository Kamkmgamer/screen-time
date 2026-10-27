{
  "targets": [
    {
      "target_name": "media",
      "sources": ["media.cc"],
      "include_dirs": [
        "<!(node sdk.js)",
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS=0", "UNICODE", "_UNICODE", "NOMINMAX", "WIN32_LEAN_AND_MEAN"],
      "libraries": ["windowsapp.lib"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": ["/EHsc", "/D_SILENCE_EXPERIMENTAL_COROUTINE_DEPRECATION_WARNINGS"]
        }
      }
    }
  ]
}
