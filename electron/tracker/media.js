'use strict';

// Answers one question: is media playing in the window that is in front?
//
// Windows publishes every player to the system media transport (GSMTC), which
// names the app and says playing or paused. That is read by a small addon in
// native/media; when the addon is missing the tracker still runs, but it falls
// back to keyboard and mouse idle alone.
//
// The query only runs while input is already idle, and the answer is cached for
// a second, so a normal working session never pays for it.

const path = require('node:path');
const { readFullscreenState } = require('./window');

let addon = null;
let addonError = null;
try {
  addon = require(path.join(__dirname, '..', '..', 'native', 'media', 'build', 'Release', 'media.node'));
} catch (error) {
  addonError = error.message;
}

// App ids Windows uses that do not name their executable.
const ALIASES = new Map([
  ['chrome', 'chrome.exe'],
  ['google chrome', 'chrome.exe'],
  ['msedge', 'msedge.exe'],
  ['microsoft edge', 'msedge.exe'],
  ['firefox', 'firefox.exe'],
  ['brave', 'brave.exe'],
  ['vivaldi', 'vivaldi.exe'],
  ['opera', 'opera.exe'],
  ['opera gx', 'opera_gx.exe'],
  ['zen', 'zen.exe'],
  ['vlc', 'vlc.exe'],
  ['mpv', 'mpv.exe'],
  ['potplayer', 'potplayermini64.exe'],
  ['spotifyab.spotifymusic', 'spotify.exe'],
  ['spotifymusic', 'spotify.exe'],
  ['microsoft.zunemusic', 'music.ui.exe'],
]);

const CACHE_MS = 1500;
const FAILURE_LIMIT = 5;

let cache = { at: 0, sessions: [] };
let inflight = null;
let failures = 0;

function baseName(value) {
  const text = String(value || '');
  const cut = Math.max(text.lastIndexOf('\\'), text.lastIndexOf('/'));
  return (cut === -1 ? text : text.slice(cut + 1)).toLowerCase();
}

function exeForAumid(aumid) {
  const id = String(aumid || '').trim().toLowerCase();
  if (!id) return null;
  const direct = ALIASES.get(id);
  if (direct) return direct;
  if (id.endsWith('.exe')) return baseName(id);
  const family = id.split('!')[0];
  if (family && ALIASES.has(family)) return ALIASES.get(family);
  return null;
}

async function sessions() {
  if (!addon) return { available: false, sessions: [], error: addonError };
  if (Date.now() - cache.at < CACHE_MS) return { available: true, sessions: cache.sessions, error: null };
  if (inflight) return inflight;

  inflight = addon.sessions()
    .then((rows) => {
      cache = { at: Date.now(), sessions: Array.isArray(rows) ? rows : [] };
      failures = 0;
      return { available: true, sessions: cache.sessions, error: null };
    })
    .catch((error) => {
      failures += 1;
      cache = { at: Date.now(), sessions: [] };
      const message = error && error.message ? error.message : 'media session unavailable';
      return { available: failures < FAILURE_LIMIT, sessions: [], error: message };
    })
    .finally(() => { inflight = null; });

  return inflight;
}

function ownsPlayingSession(rows, foreground) {
  const aumid = String(foreground.aumid || '').toLowerCase();
  const exe = baseName(foreground.exePath);
  for (const row of rows) {
    if (!row || !row.playing) continue;
    const id = String(row.aumid || '').toLowerCase();
    if (aumid && id === aumid) return true;
    const owner = exeForAumid(id);
    if (owner && exe && owner === exe) return true;
  }
  return false;
}

// `playing` is media running in the foreground app; `fullscreen` is a full-screen
// app or presentation mode, which is where gamepad-only play and full-screen
// players show up. Both only matter once input has gone quiet.
async function read(foreground) {
  const result = await sessions();
  return {
    available: result.available,
    error: result.error,
    playing: ownsPlayingSession(result.sessions, foreground || {}),
    fullscreen: readFullscreenState(),
  };
}

module.exports = { read, sessions, ownsPlayingSession, exeForAumid, baseName, available: () => Boolean(addon) };
