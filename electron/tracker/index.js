'use strict';

const { EventEmitter } = require('node:events');
const { readForeground } = require('./window');
const { appName, browserFor, cleanBrowserTitle } = require('./apps');
const browsers = require('./browsers');

const IGNORED_EXES = new Set(['logonui.exe', 'lockapp.exe', 'screensaver.scr', 'searchhost.exe', 'shellexperiencehost.exe']);

class Tracker extends EventEmitter {
  constructor({ store }) {
    super();
    this.store = store;
    this.timer = null;
    this.lastSampleAt = null;
    this.running = false;
    this.busy = false;
    this.status = {
      supported: process.platform === 'win32',
      lastSampleAt: null,
      app: null,
      site: null,
      title: '',
      idleMs: 0,
      error: null,
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastSampleAt = Date.now();
    this.schedule(300);
    if (!this.status.supported) {
      this.status.error = 'Foreground-app tracking currently runs on Windows.';
    }
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  restart() {
    this.stop();
    this.start();
  }

  schedule(delay = null) {
    if (!this.running) return;
    const wait = delay == null ? this.store.settings.sampleSeconds * 1000 : delay;
    this.timer = setTimeout(() => {
      this.tick()
        .catch((error) => {
          this.status.error = error.message;
        })
        .finally(() => this.schedule());
    }, wait);
    if (this.timer.unref) this.timer.unref();
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    const now = Date.now();
    const previous = this.lastSampleAt;
    this.lastSampleAt = now;

    try {
      const settings = this.store.settings;
      const foreground = readForeground();
      if (!foreground) {
        this.status.lastSampleAt = now;
        return;
      }
      if (foreground.error) {
        this.status.error = foreground.error;
        this.status.lastSampleAt = now;
        return;
      }

      this.status.error = null;
      this.status.lastSampleAt = now;
      this.status.idleMs = foreground.idleMs;
      this.status.title = foreground.title;

      if (previous == null) return;
      const elapsed = (now - previous) / 1000;
      if (!(elapsed > 0) || elapsed > settings.sampleSeconds * 3 + 2) return; // machine slept or clock jumped
      if (settings.paused) return;
      if (foreground.idleMs > settings.idleSeconds * 1000) return;
      if (foreground.pid === process.pid) return;
      if (!foreground.exePath) return;

      const exe = foreground.exePath.split(/[\\/]/).pop().toLowerCase();
      if (IGNORED_EXES.has(exe)) return;

      const browser = browserFor(foreground.exePath);
      const name = appName(foreground.exePath);
      const appKey = foreground.exePath.toLowerCase();
      this.status.app = name;

      let site = null;
      const enabled = settings.browsers === null || settings.browsers.includes(browser?.id);
      const windowTitle = browser ? cleanBrowserTitle(browser, foreground.title) : foreground.title;
      if (browser && settings.recordWebsites && enabled) {
        try {
          site = await browsers.lookup(browser, windowTitle);
        } catch {
          site = null;
        }
      }
      this.status.site = site ? site.domain : null;

      this.store.record({
        appKey,
        appName: name,
        title: windowTitle,
        browser: browser ? browser.name : null,
        site,
        seconds: elapsed,
        at: new Date(now),
      });
      this.emit('change');
    } finally {
      this.busy = false;
    }
  }

  getStatus() {
    return { ...this.status };
  }
}

module.exports = { Tracker };
