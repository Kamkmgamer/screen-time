'use strict';

// Run with `npm run check`: prints what the tracker sees right now, through the
// same calls the sampler makes. Useful when nothing is being recorded.
const { readForeground, readFullscreenState } = require('../electron/tracker/window');
const media = require('../electron/tracker/media');

async function main() {
  const foreground = readForeground();
  if (!foreground) {
    console.log('foreground  no window (not Windows, or nothing focused)');
    return;
  }
  if (foreground.error) {
    console.log('foreground  failed:', foreground.error);
    return;
  }

  console.log('title       ', foreground.title || '(none)');
  console.log('process     ', foreground.exePath || '(unavailable)', `pid ${foreground.pid}`);
  console.log('app id      ', foreground.aumid || '(none)');
  console.log('idle        ', `${Math.round(foreground.idleMs / 1000)} s since the last keyboard or mouse input`);

  if (!media.available()) {
    console.log('media       ', 'addon missing - idle falls back to keyboard and mouse alone');
    return;
  }

  const listed = await media.sessions();
  if (listed.error) console.log('media error ', listed.error);
  console.log('media       ', `${listed.sessions.length} session${listed.sessions.length === 1 ? '' : 's'}`);
  for (const row of listed.sessions) {
    console.log('            ', row.aumid, row.playing ? 'playing' : `status ${row.status}`);
  }

  const signal = await media.read(foreground);
  console.log('front app   ', signal.playing ? 'is playing media' : 'is not playing media');
  console.log('full screen ', readFullscreenState() ? 'yes' : 'no');
}

main();
