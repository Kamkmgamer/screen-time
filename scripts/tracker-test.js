'use strict';

// Exercises the sampling rules in electron/tracker/index.js without a desktop:
// which ticks earn seconds, what the idle loop costs, and the guards around
// sleep, lock and a player left running.
//
// Run with `npm test`.

const assert = require('node:assert/strict');
const { Tracker } = require('../electron/tracker');

let clock = Date.parse('2026-10-28T09:00:00Z');
Date.now = () => clock;

const FOREGROUND = {
  title: 'A very long video - player',
  pid: 4242,
  exePath: 'C:\\Program Files\\Player\\player.exe',
  aumid: '',
  idleMs: 0,
};

function makeStore(overrides = {}) {
  return {
    settings: {
      sampleSeconds: 5,
      idleSeconds: 120,
      mediaCeilingMinutes: 120,
      paused: false,
      recordWebsites: false,
      launchAtLogin: false,
      retentionDays: 90,
      browsers: null,
      ...overrides,
    },
    credits: [],
    record(sample) {
      this.credits.push(sample);
    },
  };
}

function makeMedia() {
  return {
    playing: false,
    fullscreen: false,
    reads: 0,
    available: () => true,
    async read() {
      this.reads += 1;
      return { available: true, error: null, playing: this.playing, fullscreen: this.fullscreen, sessions: 1 };
    },
  };
}

function makeTracker(settings) {
  const store = makeStore(settings);
  const media = makeMedia();
  const tracker = new Tracker({ store, mediaSignal: media, readWindow: () => ({ ...FOREGROUND }) });
  tracker.running = true;
  tracker.lastSampleAt = clock;
  tracker.lastCreditedAt = clock;
  tracker.resuming = true;
  return { tracker, store, media };
}

async function tick(tracker, seconds, patch = {}) {
  clock += seconds * 1000;
  Object.assign(FOREGROUND, patch);
  await tracker.tick();
}

function credited(store) {
  return Math.round(store.credits.reduce((sum, row) => sum + row.seconds, 0));
}

const results = [];
async function scenario(name, fn) {
  clock = Date.parse('2026-10-28T09:00:00Z');
  Object.assign(FOREGROUND, { idleMs: 0, title: 'A very long video - player', pid: 4242, exePath: 'C:\\Program Files\\Player\\player.exe' });
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}\n     ${error.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  await scenario('input credits every sample', async () => {
    const { tracker, store } = makeTracker();
    for (let i = 0; i < 4; i++) await tick(tracker, 5, { idleMs: 0 });
    assert.equal(credited(store), 20);
  });

  await scenario('idle without media credits nothing', async () => {
    const { tracker, store, media } = makeTracker();
    await tick(tracker, 5, { idleMs: 200000 });
    assert.equal(credited(store), 0);
    assert.equal(tracker.status.idle, true);
    assert.equal(tracker.nextDelay, 20000, 'idle poll should slow to 20 s');
    assert.equal(media.reads, 1);
  });

  await scenario('media in the front app keeps counting while idle', async () => {
    const { tracker, store, media } = makeTracker();
    media.playing = true;
    await tick(tracker, 5, { idleMs: 200000 });
    await tick(tracker, 5, { idleMs: 210000 });
    await tick(tracker, 5, { idleMs: 215000 });
    assert.equal(credited(store), 15);
    assert.equal(tracker.status.idle, false);
    assert.equal(tracker.status.media, true);
  });

  await scenario('background media does not hold the clock', async () => {
    const { tracker, store, media } = makeTracker();
    media.playing = false;
    await tick(tracker, 20, { idleMs: 200000 });
    assert.equal(credited(store), 0);
  });

  await scenario('media starting after a pause credits one sample, not the gap', async () => {
    const { tracker, store, media } = makeTracker();
    await tick(tracker, 20, { idleMs: 200000 });
    assert.equal(credited(store), 0);
    media.playing = true;
    await tick(tracker, 20, { idleMs: 220000 });
    assert.equal(credited(store), 5, 'the first credited sample is capped at the sample length');
  });

  await scenario('media stopping returns to idle', async () => {
    const { tracker, store, media } = makeTracker();
    media.playing = true;
    await tick(tracker, 5, { idleMs: 200000 });
    assert.equal(credited(store), 5);
    media.playing = false;
    await tick(tracker, 5, { idleMs: 205000 });
    assert.equal(credited(store), 5);
  });

  await scenario('two hours of untouched media ends the run', async () => {
    const { tracker, store, media } = makeTracker();
    media.playing = true;
    await tick(tracker, 5, { idleMs: 200000 });
    tracker.mediaSince = Date.now() - (2 * 60 * 60 * 1000) - 1000;
    await tick(tracker, 5, { idleMs: 205000 });
    assert.equal(credited(store), 5);
    assert.equal(tracker.status.reason, 'limit', 'the sidebar can say why counting stopped');
  });

  await scenario('the media ceiling is a setting, and never is allowed', async () => {
    const { tracker, store, media } = makeTracker({ mediaCeilingMinutes: null });
    media.playing = true;
    await tick(tracker, 5, { idleMs: 200000 });
    tracker.mediaSince = Date.now() - (9 * 60 * 60 * 1000);
    await tick(tracker, 5, { idleMs: 205000 });
    assert.equal(credited(store), 10);
    assert.equal(tracker.status.reason, 'media');
  });

  await scenario('a shorter ceiling stops media sooner', async () => {
    const { tracker, store, media } = makeTracker({ mediaCeilingMinutes: 30 });
    media.playing = true;
    await tick(tracker, 5, { idleMs: 200000 });
    tracker.mediaSince = Date.now() - (31 * 60 * 1000);
    await tick(tracker, 5, { idleMs: 205000 });
    assert.equal(credited(store), 5);
    assert.equal(tracker.status.reason, 'limit');
    assert.equal(tracker.status.idle, true);
  });

  await scenario('the reason follows the desk', async () => {
    const { tracker, media } = makeTracker();
    await tick(tracker, 5, { idleMs: 0 });
    assert.equal(tracker.status.reason, 'recording');
    assert.equal(tracker.status.mediaSessions, null, 'media is not read while input is fresh');
    await tick(tracker, 5, { idleMs: 200000 });
    assert.equal(tracker.status.reason, 'idle');
    media.playing = true;
    await tick(tracker, 5, { idleMs: 205000 });
    assert.equal(tracker.status.reason, 'media');
    assert.equal(tracker.status.mediaSessions, 1);
    await tick(tracker, 5, { pid: process.pid, idleMs: 0 });
    assert.equal(tracker.status.reason, 'self');
  });

  await scenario('paused and sleep both say so', async () => {
    const { tracker } = makeTracker({ paused: true });
    await tick(tracker, 5, { idleMs: 0 });
    assert.equal(tracker.status.reason, 'paused');
    tracker.store.settings.paused = false;
    await tick(tracker, 600, { idleMs: 0 });
    assert.equal(tracker.status.reason, 'starting', 'a gap is not credited and does not claim to be recording');
  });

  await scenario('a full-screen app counts as in use', async () => {
    const { tracker, store, media } = makeTracker();
    media.fullscreen = true;
    await tick(tracker, 5, { idleMs: 200000 });
    assert.equal(credited(store), 5);
    assert.equal(tracker.status.idle, false);
  });

  await scenario('a sleep gap is never credited', async () => {
    const { tracker, store } = makeTracker();
    await tick(tracker, 600, { idleMs: 0 });
    assert.equal(credited(store), 0);
  });

  await scenario('pausing stops credit and idle resumes it', async () => {
    const { tracker, store } = makeTracker({ paused: true });
    await tick(tracker, 5, { idleMs: 0 });
    assert.equal(credited(store), 0);
    tracker.store.settings.paused = false;
    await tick(tracker, 5, { idleMs: 0 });
    assert.equal(credited(store), 5);
  });

  await scenario('suspending clears the timer', async () => {
    const { tracker } = makeTracker();
    tracker.suspend();
    assert.equal(tracker.suspended, true);
    assert.equal(tracker.timer, null);
    tracker.wake();
    assert.equal(tracker.suspended, false);
  });

  console.log(results.join('\n'));
  console.log(process.exitCode ? '\nFAILED' : '\nall tracker rules hold');
}

main();
