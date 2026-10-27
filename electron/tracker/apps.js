'use strict';

const path = require('node:path');

// Known applications get the name people use for them; everything else is derived from the executable.
const NAMES = {
  'chrome.exe': 'Google Chrome',
  'msedge.exe': 'Microsoft Edge',
  'brave.exe': 'Brave',
  'firefox.exe': 'Firefox',
  'vivaldi.exe': 'Vivaldi',
  'opera.exe': 'Opera',
  'opera_gx.exe': 'Opera GX',
  'arc.exe': 'Arc',
  'zen.exe': 'Zen',
  'code.exe': 'Visual Studio Code',
  'code - insiders.exe': 'VS Code Insiders',
  'cursor.exe': 'Cursor',
  'devenv.exe': 'Visual Studio',
  'idea64.exe': 'IntelliJ IDEA',
  'pycharm64.exe': 'PyCharm',
  'webstorm64.exe': 'WebStorm',
  'windowsterminal.exe': 'Terminal',
  'wt.exe': 'Terminal',
  'powershell.exe': 'PowerShell',
  'pwsh.exe': 'PowerShell',
  'cmd.exe': 'Command Prompt',
  'explorer.exe': 'File Explorer',
  'slack.exe': 'Slack',
  'discord.exe': 'Discord',
  'spotify.exe': 'Spotify',
  'figma.exe': 'Figma',
  'notion.exe': 'Notion',
  'obsidian.exe': 'Obsidian',
  'winword.exe': 'Word',
  'excel.exe': 'Excel',
  'powerpnt.exe': 'PowerPoint',
  'outlook.exe': 'Outlook',
  'teams.exe': 'Microsoft Teams',
  'ms-teams.exe': 'Microsoft Teams',
  'zoom.exe': 'Zoom',
  'steam.exe': 'Steam',
  'telegram.exe': 'Telegram',
  'whatsapp.exe': 'WhatsApp',
  'snippingtool.exe': 'Snipping Tool',
  'notepad.exe': 'Notepad',
  't3 code (nightly).exe': 'T3 Code',
  'tally.exe': 'Tally',
};

const BROWSERS = {
  'chrome.exe': { id: 'chrome', name: 'Google Chrome', family: 'chromium' },
  'msedge.exe': { id: 'edge', name: 'Microsoft Edge', family: 'chromium' },
  'brave.exe': { id: 'brave', name: 'Brave', family: 'chromium' },
  'vivaldi.exe': { id: 'vivaldi', name: 'Vivaldi', family: 'chromium' },
  'opera.exe': { id: 'opera', name: 'Opera', family: 'chromium' },
  'opera_gx.exe': { id: 'opera-gx', name: 'Opera GX', family: 'chromium' },
  'arc.exe': { id: 'arc', name: 'Arc', family: 'chromium' },
  'firefox.exe': { id: 'firefox', name: 'Firefox', family: 'firefox' },
  'zen.exe': { id: 'zen', name: 'Zen', family: 'firefox' },
};

function exeName(exePath) {
  return path.win32.basename(exePath || '').toLowerCase();
}

function appName(exePath) {
  const base = exeName(exePath);
  if (!base) return 'Unknown app';
  if (NAMES[base]) return NAMES[base];
  const stem = base.replace(/\.exe$/i, '').replace(/[-_]+/g, ' ');
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function browserFor(exePath) {
  return BROWSERS[exeName(exePath)] || null;
}

// Window titles end with the browser's name and, with several profiles, the profile name.
const TITLE_SUFFIXES = [
  /\s+[-–—]\s+Google Chrome$/i,
  /\s+[-–—]\s+Microsoft Edge$/i,
  /\s+[-–—]\s+Mozilla Firefox$/i,
  /\s+[-–—]\s+Zen Browser$/i,
  /\s+[-–—]\s+Brave$/i,
  /\s+[-–—]\s+Vivaldi$/i,
  /\s+[-–—]\s+Opera( GX)?$/i,
  /\s+[-–—]\s+Arc$/i,
  /\s+and \d+ more pages?\s+[-–—]\s+.*$/i,
  /\s+[-–—]\s+(Personal|Work|Profile \d+)$/i,
];

function cleanBrowserTitle(browser, title) {
  let out = String(title || '');
  for (let i = 0; i < 2; i++) {
    for (const pattern of TITLE_SUFFIXES) out = out.replace(pattern, '');
  }
  // Firefox sometimes prefixes the window with the profile.
  if (browser.family === 'firefox') out = out.replace(/^Mozilla Firefox\s+[-–—]\s+/i, '');
  // Unread counts ("(2) WhatsApp") belong to the window, not to the page's name.
  return out.replace(/^\(\d+\)\s*/, '').trim();
}

module.exports = { appName, exeName, browserFor, cleanBrowserTitle, BROWSERS, NAMES };
