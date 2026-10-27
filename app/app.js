(function () {
  'use strict';

  const ICONS = {
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.4 3.4v9.2M10.6 3.4v9.2"/></svg>',
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 3.4 12 8l-6.8 4.6Z"/></svg>',
    refresh: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.6-3.7"/><path d="M13.2 3.4V6.2h-2.8"/></svg>',
    close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
  };

  const MONTHS = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const SHORT_MONTHS = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

  const state = {
    snapshot: null,
    route: 'today',
    ranges: { apps: 1, sites: 1 },
    savedAt: 0,
    menuOpen: false,
  };

  const view = document.getElementById('view');
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');
  const menuBtn = document.getElementById('menu-btn');
  const sheetClose = document.getElementById('sheet-close');
  const dialog = document.getElementById('confirm-dialog');
  const api = window.tally || createDemoApi();

  /* ---------- small DOM helpers ---------- */

  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
        else node.setAttribute(key, value === true ? '' : value);
      }
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function icon(name) {
    const span = h('span', { class: 'icon', 'aria-hidden': 'true' });
    span.innerHTML = ICONS[name] || '';
    return span;
  }

  // Brand glyphs are bundled monochrome SVGs in app/icons (source: thesvg.org),
  // painted through a mask so every one inherits the same ink. Names come from
  // electron/tracker/apps.js; unknown apps and sites get an empty slot.
  const APP_GLYPHS = {
    'google chrome': 'chrome',
    chrome: 'chrome',
    'microsoft edge': 'edge',
    edge: 'edge',
    brave: 'brave',
    firefox: 'firefox',
    vivaldi: 'vivaldi',
    opera: 'opera',
    'opera gx': 'opera-gx',
    arc: 'arc',
    zen: 'zen',
    'visual studio code': 'code',
    'vs code insiders': 'code',
    cursor: 'cursor',
    'visual studio': 'visual-studio',
    'intellij idea': 'intellij',
    pycharm: 'pycharm',
    webstorm: 'webstorm',
    powershell: 'powershell',
    warp: 'warp',
    slack: 'slack',
    discord: 'discord',
    'microsoft teams': 'teams',
    teams: 'teams',
    zoom: 'zoom',
    figma: 'figma',
    notion: 'notion',
    obsidian: 'obsidian',
    linear: 'linear',
    trello: 'trello',
    miro: 'miro',
    loom: 'loom',
    airtable: 'airtable',
    canva: 'canva',
    framer: 'framer',
    webflow: 'webflow',
    photoshop: 'photoshop',
    blender: 'blender',
    word: 'word',
    excel: 'excel',
    powerpoint: 'powerpoint',
    outlook: 'outlook',
    spotify: 'spotify',
    steam: 'steam',
    telegram: 'telegram',
    whatsapp: 'whatsapp',
    '1password': '1password',
    bitwarden: 'bitwarden',
    raycast: 'raycast',
    terminal: 'terminal',
  };

  const SITE_GLYPHS = {
    'youtube.com': 'youtube',
    'youtu.be': 'youtube',
    'github.com': 'github',
    'gist.github.com': 'github',
    'gitlab.com': 'gitlab',
    'mail.google.com': 'gmail',
    'google.com': 'google',
    'linear.app': 'linear',
    'mozilla.org': 'mozilla',
    'news.ycombinator.com': 'ycombinator',
    'reddit.com': 'reddit',
    'wikipedia.org': 'wikipedia',
    'stackoverflow.com': 'stackoverflow',
    'chatgpt.com': 'chatgpt',
    'chat.openai.com': 'chatgpt',
    'claude.ai': 'claude',
    'notion.so': 'notion',
    'figma.com': 'figma',
    'slack.com': 'slack',
    'discord.com': 'discord',
    'spotify.com': 'spotify',
    'open.spotify.com': 'spotify',
    'netflix.com': 'netflix',
    'linkedin.com': 'linkedin',
    'amazon.com': 'amazon',
    'twitch.tv': 'twitch',
    'x.com': 'x',
    'twitter.com': 'x',
    'instagram.com': 'instagram',
    'facebook.com': 'facebook',
    'tiktok.com': 'tiktok',
    'medium.com': 'medium',
    'substack.com': 'substack',
    'duckduckgo.com': 'duckduckgo',
    'bing.com': 'bing',
    'threads.net': 'threads',
    'vercel.com': 'vercel',
    'npmjs.com': 'npm',
    'nodejs.org': 'nodejs',
    'python.org': 'python',
    'rust-lang.org': 'rust',
    'go.dev': 'go',
    'docker.com': 'docker',
    'supabase.com': 'supabase',
    'firebase.google.com': 'firebase',
    'cloudflare.com': 'cloudflare',
    'canva.com': 'canva',
    'trello.com': 'trello',
    'miro.com': 'miro',
    'loom.com': 'loom',
    'airtable.com': 'airtable',
    'framer.com': 'framer',
    'webflow.com': 'webflow',
    'teams.microsoft.com': 'teams',
    'zoom.us': 'zoom',
    'outlook.com': 'outlook',
    'outlook.office.com': 'outlook',
    '1password.com': '1password',
    'bitwarden.com': 'bitwarden',
    'raycast.com': 'raycast',
    'warp.dev': 'warp',
    'cursor.com': 'cursor',
    'code.visualstudio.com': 'code',
    'obsidian.md': 'obsidian',
  };

  const BROWSER_GLYPHS = ['chrome', 'edge', 'brave', 'vivaldi', 'opera', 'opera-gx', 'firefox', 'zen', 'arc'];

  function glyph(key) {
    if (!key) return h('span', { class: 'glyph glyph-empty', 'aria-hidden': 'true' });
    return h('span', { class: 'glyph', 'aria-hidden': 'true', style: `--glyph: url("icons/${key}.svg")` });
  }

  function appGlyph(name) {
    return glyph(APP_GLYPHS[String(name || '').toLowerCase()] || null);
  }

  function siteGlyph(domain) {
    const host = String(domain || '').toLowerCase().replace(/^www\./, '');
    const parts = host.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const key = SITE_GLYPHS[parts.slice(i).join('.')];
      if (key) return glyph(key);
    }
    return glyph(null);
  }

  function browserGlyph(id) {
    return glyph(BROWSER_GLYPHS.includes(id) ? id : null);
  }

  function pctText(part, whole) {
    if (!whole || !part) return '0%';
    const value = (part / whole) * 100;
    if (value < 0.5) return '<1%';
    return `${Math.round(value)}%`;
  }

  function durationParts(seconds) {
    const raw = Math.max(0, Number(seconds) || 0);
    if (raw < 1) return { h: 0, m: 0, under: false };
    const total = Math.round(raw);
    if (total < 60) return { h: 0, m: 0, under: true };
    let hours = Math.floor(total / 3600);
    let minutes = Math.round((total % 3600) / 60);
    if (minutes === 60) { hours += 1; minutes = 0; }
    return { h: hours, m: minutes, under: false };
  }

  function durationText(seconds) {
    const p = durationParts(seconds);
    if (p.under) return '< 1 m';
    if (p.h && p.m) return `${p.h} h ${p.m} m`;
    if (p.h) return `${p.h} h`;
    return `${p.m} m`;
  }

  function durationNode(seconds) {
    const p = durationParts(seconds);
    const node = h('span', { class: 'kpi-value' });
    if (p.under) {
      node.append(h('span', { text: '< 1' }), h('span', { class: 'unit', text: 'm' }));
    } else if (p.h) {
      node.append(h('span', { text: String(p.h) }), h('span', { class: 'unit', text: 'h' }));
      if (p.m) node.append(h('span', { text: String(p.m) }), h('span', { class: 'unit', text: 'm' }));
    } else {
      node.append(h('span', { text: String(p.m) }), h('span', { class: 'unit', text: 'm' }));
    }
    return node;
  }

  function timeOf(iso) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return TIME.format(date);
  }

  function dayLabel(key) {
    if (!key) return '';
    const [y, m, d] = key.split('-').map(Number);
    return MONTHS.format(new Date(y, m - 1, d, 12));
  }

  function shortDayLabel(key) {
    if (!key) return '';
    const [y, m, d] = key.split('-').map(Number);
    return SHORT_MONTHS.format(new Date(y, m - 1, d, 12));
  }

  function keyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }

  function plural(count, one, many) {
    return `${count} ${count === 1 ? one : many}`;
  }

  function shortName(name) {
    return String(name || '').replace(/^(Google|Microsoft|Mozilla)\s+/, '');
  }

  /* ---------- data helpers ---------- */

  function totalOf(rows) {
    return rows.reduce((sum, row) => sum + (row.seconds || 0), 0);
  }

  function topSiteLine(data) {
    const top = data.sites[0];
    if (!top) return null;
    return `${top.domain} took ${durationText(top.seconds)}, ${pctText(top.seconds, data.browserSeconds)} of browser time`;
  }

  /* ---------- page shell ---------- */

  function titleRow({ title, sub, actions }) {
    return h('div', { class: 'title-row' },
      h('div', null,
        h('h1', { text: title }),
        sub ? h('p', { class: 'sub', text: sub }) : null),
      actions ? h('div', { class: 'title-actions' }, actions) : null);
  }

  function titleActions(compact) {
    if (!state.snapshot) return null;
    const paused = state.snapshot.settings.paused;
    const stampText = paused ? 'Paused' : (timeOf(state.snapshot.tracking.lastSampleAt) ? `Updated ${timeOf(state.snapshot.tracking.lastSampleAt)}` : 'Just now');
    return [
      h('span', { class: 'stamp', text: stampText }),
      h('button', {
        class: 'icon-btn', type: 'button', 'aria-label': 'Refresh data', title: 'Refresh',
        onclick: () => refresh(),
      }, icon('refresh')),
      compact ? null : h('button', {
        class: 'btn btn-secondary', type: 'button',
        onclick: () => saveSettings({ paused: !paused }),
      }, h('span', { class: 'btn-icon', html: paused ? ICONS.play : ICONS.pause }), paused ? 'Resume tracking' : 'Pause tracking'),
    ];
  }

  function rangeControl(kind, value) {
    const options = [[1, 'Today'], [7, '7 days'], [30, '30 days']];
    return h('div', { class: 'segmented', role: 'group', 'aria-label': 'Time range' },
      options.map(([days, label]) => h('button', {
        type: 'button',
        'aria-pressed': String(value === days),
        onclick: () => {
          state.ranges[kind] = days;
          render();
        },
      }, label)));
  }

  function emptyBlock(lines, action) {
    return h('div', { class: 'empty' },
      lines.map((line) => h('p', { text: line })),
      action || null);
  }

  /* ---------- today ---------- */

  function renderToday(snap) {
    const data = snap.today;
    const paused = snap.settings.paused;
    const apps = data.apps;
    const sites = data.sites;
    const yesterday = snap.yesterday || { totalSeconds: 0 };
    const topApp = apps[0] || null;

    let finding;
    if (paused) finding = 'Tracking is paused.';
    else if (topSiteLine(data)) finding = topSiteLine(data);
    else if (topApp) finding = `${topApp.name} took ${durationText(topApp.seconds)}, ${pctText(topApp.seconds, data.totalSeconds)} of screen time`;
    else finding = 'Tally records the app in front of you every few seconds.';

    const dateLong = dayLabel(snap.todayKey);

    const kpis = h('div', { class: 'kpis' },
      kpi('Screen time today', durationNode(data.totalSeconds),
        yesterday.totalSeconds > 0 ? `Yesterday ${durationText(yesterday.totalSeconds)}` : 'First day recorded'),
      kpi('Apps used', h('span', { class: 'kpi-value', text: String(apps.length) }),
        topApp ? `Top: ${topApp.name}` : 'None yet'),
      kpi('Websites', h('span', { class: 'kpi-value', text: String(sites.length) }),
        sites.length ? `Top: ${sites[0].domain}` : (snap.settings.recordWebsites ? 'None yet' : 'Turned off')),
      kpi('In browsers', durationNode(data.browserSeconds),
        data.totalSeconds ? `${pctText(data.browserSeconds, data.totalSeconds)} of screen time` : 'No browser yet'));

    const appsPanel = h('section', { class: 'panel span-7', 'aria-labelledby': 'apps-heading' },
      h('header', null,
        h('h2', { id: 'apps-heading', text: 'Apps' }),
        h('span', { class: 'meta', text: apps.length ? `${Math.min(apps.length, 6)} of ${apps.length}` : 'Today' }),
        h('div', { class: 'head-right' },
          h('button', { class: 'card-link', type: 'button', onclick: () => go('apps') }, 'All apps'))),
      apps.length
        ? h('ol', { class: 'ranks' }, apps.slice(0, 6).map((app) => rankRow({
          glyph: appGlyph(app.name),
          name: app.name,
          detail: app.title || 'No window title',
          value: durationText(app.seconds),
          share: pctText(app.seconds, data.totalSeconds),
          width: app.seconds / (apps[0].seconds || 1),
        })))
        : emptyBlock(paused
          ? ['Tracking is paused, so nothing is being recorded.', 'Resume to start counting the app in front.'] 
          : ['Nothing recorded yet today.', 'Open an app and Tally will list it here within a few seconds.']));

    const sitesPanel = h('section', { class: 'panel span-5', 'aria-labelledby': 'sites-heading' },
      h('header', null,
        h('h2', { id: 'sites-heading', text: 'Websites' }),
        h('span', { class: 'meta', text: sites.length ? `${Math.min(sites.length, 6)} of ${sites.length}` : 'Today' }),
        h('div', { class: 'head-right' },
          h('button', { class: 'card-link', type: 'button', onclick: () => go('sites') }, 'All sites'))),
      sites.length
        ? h('ol', { class: 'ranks' }, sites.slice(0, 6).map((site) => rankRow({
          glyph: siteGlyph(site.domain),
          name: site.domain,
          detail: site.title || site.browser || 'Page title unavailable',
          value: durationText(site.seconds),
          share: pctText(site.seconds, data.browserSeconds),
          width: site.seconds / (sites[0].seconds || 1),
        })))
        : sitesEmpty(snap, data));

    const peak = data.hours.indexOf(Math.max(...data.hours));
    const hasHours = data.totalSeconds > 0;
    const chartPanel = h('section', { class: 'panel chart-panel span-12', 'aria-labelledby': 'day-heading' },
      h('header', null,
        h('h2', { id: 'day-heading', text: 'The day, hour by hour' }),
        hasHours ? h('span', { class: 'meta', text: `Peak ${String(peak).padStart(2, '0')}:00` }) : null,
        hasHours ? h('div', { class: 'head-right' }, h('span', { class: 'meta', text: 'Minutes on screen' })) : null),
      hasHours
        ? h('div', { class: 'chart', id: 'day-chart' })
        : emptyBlock(['Nothing recorded yet today.', 'Open an app and Tally will draw the day here.']));

    const page = h('div', null,
      titleRow({
        title: 'Today',
        sub: `${dateLong} · ${finding}`,
        actions: titleActions(),
      }),
      kpis,
      h('div', { class: 'grid' }, appsPanel, sitesPanel, chartPanel));

    requestAnimationFrame(() => {
      const el = document.getElementById('day-chart');
      if (!el || !window.Charts) return;
      const values = data.hours.map((seconds) => Math.round(seconds / 60));
      Charts.bars(el, {
        labels: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
        values,
        xAt: [0, 6, 12, 18],
        height: 186,
        format: (v) => `${v} m`,
        colour: '#1d5fbf',
      });
    });

    return page;
  }

  function kpi(label, valueNode, note) {
    return h('div', { class: 'kpi' },
      h('div', { class: 'kpi-label', text: label }),
      valueNode,
      h('div', { class: 'kpi-note', text: note }));
  }

  function rankRow({ name, detail, value, share, width, glyph: mark }) {
    return h('li', { class: 'rank-row' },
      h('div', { class: 'rank-main' },
        mark || null,
        h('div', { class: 'rank-body' },
          h('div', { class: 'rank-line' },
            h('span', { class: 'rank-name', text: name, title: name }),
            h('span', { class: 'rank-value', text: value })),
          h('div', { class: 'rank-subline' },
            h('span', { class: 'rank-sub', text: detail, title: detail }),
            h('span', { class: 'rank-share', text: share })))),
      h('div', { class: 'bar' }, h('i', { style: `width:${Math.max(2, Math.round(width * 100))}%` })));
  }

  function sitesEmpty(snap, data) {
    if (!snap.settings.recordWebsites) {
      return emptyBlock(
        ['Website names are turned off.', 'Tally still counts every browser as an app.'],
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => go('settings') }, 'Turn on website names'));
    }
    if (!data.browserSeconds) {
      return emptyBlock(['No website time yet today.', 'Time in a browser will be matched to the page it shows.']);
    }
    return emptyBlock(['No site named yet.', 'Tally matches the window title to a recent entry in local browser history.']);
  }

  /* ---------- apps ---------- */

  function renderApps(snap) {
    const days = state.ranges.apps;
    const data = snap.ranges[days] || snap.today;
    const total = data.totalSeconds;
    const top = data.apps[0];

    const sub = total
      ? [plural(data.apps.length, 'app', 'apps'), durationText(total), rangePhrase(data, days)].filter(Boolean).join(' · ')
      : ['No app time recorded', rangePhrase(data, days)].filter(Boolean).join(' · ');

    const table = h('section', { class: 'panel span-12', 'aria-labelledby': 'apps-table-heading' },
      h('header', null,
        h('h2', { id: 'apps-table-heading', text: 'Time by app' }),
        h('span', { class: 'meta', text: total ? `Top: ${top.name}` : 'Nothing yet' })),
      data.apps.length
        ? h('div', { class: 'table' },
          h('div', { class: 'table-head', role: 'row' },
            h('span', { text: 'App' }),
            h('span', { class: 'num', text: 'Time' }),
            h('span', { class: 'num', text: 'Share' })),
          data.apps.map((app) => h('div', { class: 'table-row' },
            h('div', { class: 'ident' },
              appGlyph(app.name),
              h('div', { class: 'ident-text' },
                h('div', { class: 'name', text: app.name, title: app.name }),
                h('div', { class: 'detail', text: app.title || 'No window title', title: app.title || '' }))),
            h('div', { class: 'value', text: durationText(app.seconds) }),
            h('div', { class: 'share', text: pctText(app.seconds, total) }))))
        : emptyBlock(
          ['Nothing recorded in this range.', days === 1 ? 'Today has only just started, or tracking is paused.' : 'Try a shorter range, or leave Tally running in the tray.']));

    return h('div', null,
      titleRow({
        title: 'Apps',
        sub,
        actions: [rangeControl('apps', days), titleActions(true)],
      }),
      h('div', { class: 'grid' }, table));
  }

  /* ---------- websites ---------- */

  function renderSites(snap) {
    const days = state.ranges.sites;
    const data = snap.ranges[days] || snap.today;
    const total = data.browserSeconds;

    const sub = total
      ? [plural(data.sites.length, 'site', 'sites'), `${durationText(total)} in browsers`, rangePhrase(data, days)].filter(Boolean).join(' · ')
      : ['No website time recorded', rangePhrase(data, days)].filter(Boolean).join(' · ');

    let content;
    if (!snap.settings.recordWebsites) {
      content = emptyBlock(
        ['Website names are turned off.', 'Tally still counts every browser as an app. Names come only from local browser history.'],
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => go('settings') }, 'Turn on website names'));
    } else if (!data.sites.length) {
      content = emptyBlock(
        total
          ? ['Browser time recorded, but no page named yet.', 'Open a page in Chrome, Edge, Brave, Firefox or Zen and Tally will match the window to a recent history entry.']
          : ['No website time recorded in this range.', 'Website names come from the history file of the browser in front.']);
    } else {
      content = h('div', { class: 'table table-sites' },
        h('div', { class: 'table-head', role: 'row' },
          h('span', { text: 'Site' }),
          h('span', { text: 'Browser' }),
          h('span', { class: 'num', text: 'Time' }),
          h('span', { class: 'num', text: 'Share' })),
        data.sites.map((site) => h('div', { class: 'table-row' },
          h('div', { class: 'ident' },
            siteGlyph(site.domain),
            h('div', { class: 'ident-text' },
              h('div', { class: 'name', text: site.domain, title: site.domain }),
              h('div', { class: 'detail' },
                h('span', { class: 'detail-browser' }, `${site.browser || 'Browser'} · `),
                site.title || 'Page title unavailable'))),
          h('div', { class: 'browser-col', text: site.browser || 'Browser' }),
          h('div', { class: 'value', text: durationText(site.seconds) }),
          h('div', { class: 'share', text: pctText(site.seconds, total) }))));
    }

    return h('div', null,
      titleRow({
        title: 'Websites',
        sub,
        actions: [rangeControl('sites', days), titleActions(true)],
      }),
      h('div', { class: 'grid' },
        h('section', { class: 'panel span-12', 'aria-labelledby': 'sites-table-heading' },
          h('header', null,
            h('h2', { id: 'sites-table-heading', text: 'Time by website' }),
            h('span', { class: 'meta source', text: 'Read from local browser history' })),
          content)));
  }

  function rangePhrase(data, days) {
    if (days === 1) return '';
    return `${data.daysWithData} of ${days} days recorded`;
  }

  /* ---------- settings ---------- */

  function renderSettings(snap) {
    const settings = snap.settings;
    const system = snap.system;
    const saved = Date.now() - state.savedAt < 2600;

    const trackingPanel = settingPanel([
      switchRow('Record screen time', 'Pause and resume without closing Tally.', !settings.paused, () => saveSettings({ paused: !settings.paused })),
      selectRow('Sample every', 'A shorter interval is more precise; a longer one uses less power.',
        [[5, '5 seconds'], [10, '10 seconds'], [30, '30 seconds']], settings.sampleSeconds,
        (value) => saveSettings({ sampleSeconds: Number(value) })),
      selectRow('Ignore idle time after', 'Time with no keyboard or mouse input is not counted.',
        [[60, '1 minute'], [120, '2 minutes'], [300, '5 minutes'], [600, '10 minutes']], settings.idleSeconds,
        (value) => saveSettings({ idleSeconds: Number(value) })),
      switchRow('Open Tally at login', 'Start hidden in the tray when you sign in to Windows.', settings.launchAtLogin,
        () => saveSettings({ launchAtLogin: !settings.launchAtLogin })),
    ]);

    const browsers = system.browserList || [];
    const installed = browsers.filter((browser) => browser.installed);
    const enabled = settings.browsers === null ? installed.map((browser) => browser.id) : settings.browsers;

    const websiteRows = [
      switchRow('Name websites from browser history',
        'Uses the browser’s own history file. No extension, no network.',
        settings.recordWebsites, () => saveSettings({ recordWebsites: !settings.recordWebsites })),
      h('div', { class: 'browser-list' },
        installed.length
          ? installed.map((browser) => h('label', { class: 'browser-row' },
            browserGlyph(browser.id),
            h('span', { class: 'browser-name', text: browser.name }),
            h('span', { class: 'browser-meta', text: plural(browser.profiles, 'profile', 'profiles') }),
            h('input', {
              class: 'check', type: 'checkbox', checked: enabled.includes(browser.id),
              onchange: (event) => {
                const next = new Set(enabled);
                if (event.target.checked) next.add(browser.id);
                else next.delete(browser.id);
                const all = installed.every((row) => next.has(row.id)) ? null : [...next];
                saveSettings({ browsers: all });
              },
            })))
          : h('div', { class: 'note', text: 'No supported browser found on this PC yet.' })),
      h('p', { class: 'note', text: 'Tally copies the history file to a temporary folder, reads recent visits, then deletes the copy. The copy never leaves this device.' }),
      h('div', { class: 'note' },
        h('button', {
          class: 'btn btn-secondary', type: 'button',
          onclick: async () => {
            const list = await api.rescanBrowsers();
            state.snapshot.system.browserList = list;
            render();
          },
        }, 'Rescan browsers')),
    ];

    const oldest = system.oldestDay;
    const dataPanel = settingPanel([
      selectRow('Keep history for', 'Older days are deleted automatically.',
        [[30, '30 days'], [90, '90 days'], [365, '1 year']], settings.retentionDays,
        (value) => saveSettings({ retentionDays: Number(value) })),
      h('div', { class: 'data-stats' },
        stat('Days stored', String(system.storedDays || 0)),
        stat('Oldest day', oldest ? shortDayLabel(oldest) : '—'),
        stat('Data size', formatBytes(system.fileSize || 0))),
      h('div', { class: 'field-row' },
        h('div', { class: 'text' }, h('div', { class: 'title', text: 'Data file' })),
        h('div', { class: 'control storage-field' },
          h('input', { readonly: true, value: system.dataPath, 'aria-label': 'Data file location' }),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => api.openDataFolder() }, 'Show'))),
      h('div', { class: 'destructive-row' },
        h('div', { class: 'text' },
          h('div', { class: 'title', text: 'Delete all recorded time' }),
          h('div', { class: 'desc', text: 'Removes every app and website total on this PC.' })),
        h('button', {
          class: 'btn btn-danger', type: 'button',
          onclick: () => dialog.showModal(),
        }, 'Delete data')),
    ]);

    const aboutPanel = h('div', { class: 'setting-panel' },
      h('div', { class: 'about-well' },
        h('p', null, h('strong', { text: `Tally ${system.version}` }), ` for ${system.platform === 'win32' ? 'Windows' : system.platform}.`),
        h('p', null, 'One local JSON file. No account, no extension, no upload, no network requests.') ));

    return h('div', null,
      titleRow({
        title: 'Settings',
        sub: 'Tracking, website names and where the data lives.',
        actions: saved ? [h('span', { class: 'stamp', text: 'Saved' })] : null,
      }),
      h('div', { class: 'settings' },
        settingRow('Tracking', 'Tally reads the title and process of the foreground window every few seconds.', trackingPanel),
        settingRow('Websites', 'Site names come from the browser’s own history, read on this PC.', websiteRows),
        settingRow('Data', 'One local file, kept for the retention you choose.', dataPanel),
        settingRow('About', 'Small, local and quiet.', aboutPanel)));
  }

  function settingRow(title, description, panel) {
    return h('section', { class: 'setting-row' },
      h('div', { class: 'setting-label' },
        h('h2', null, title),
        h('p', { text: description })),
      h('div', { class: 'setting-panel' }, panel));
  }

  function settingPanel(children) {
    return h('div', { class: 'setting-panel' }, children.flat());
  }

  function switchRow(title, description, checked, onChange) {
    return h('div', { class: 'switch-row' },
      h('div', { class: 'text' },
        h('div', { class: 'title', text: title }),
        h('div', { class: 'desc', text: description })),
      h('button', {
        class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(Boolean(checked)), 'aria-label': title,
        onclick: onChange,
      }, h('span', { class: 'knob' })));
  }

  function selectRow(title, description, options, value, onChange) {
    const id = `select-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
    return h('div', { class: 'field-row' },
      h('div', { class: 'text' },
        h('label', { class: 'title', for: id, text: title }),
        h('div', { class: 'desc', text: description })),
      h('div', { class: 'control' },
        h('select', { class: 'control', id, onchange: (event) => onChange(event.target.value) },
          options.map(([optionValue, label]) => h('option', { value: optionValue, selected: Number(optionValue) === Number(value) }, label)))));
  }

  function stat(label, value) {
    return h('div', { class: 'stat' },
      h('div', { class: 'stat-label', text: label }),
      h('div', { class: 'stat-value', text: value }));
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /* ---------- render ---------- */

  function render() {
    const snap = state.snapshot;
    if (!snap) {
      view.replaceChildren(h('p', { class: 'loading', text: 'Reading local totals…' }));
      return;
    }
    const page = state.route === 'apps' ? renderApps(snap)
      : state.route === 'sites' ? renderSites(snap)
        : state.route === 'settings' ? renderSettings(snap)
          : renderToday(snap);
    view.replaceChildren(page);
    renderNav();
    renderSidebarState();
  }

  function renderNav() {
    document.querySelectorAll('.nav-item').forEach((item) => {
      if (item.dataset.nav === state.route) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function renderSidebarState() {
    const host = document.getElementById('track-state');
    const snap = state.snapshot;
    if (!host || !snap) return;
    const tracking = snap.tracking;
    const paused = snap.settings.paused;
    const text = !tracking.supported ? 'Tracking unavailable'
      : paused ? 'Paused'
        : tracking.lastSampleAt ? `Tracking · ${shortName(tracking.app || 'waiting')}` : 'Starting';
    host.replaceChildren(
      h('span', { class: 'dot' }),
      h('span', { class: 'state-text', text, title: text }),
      tracking.supported
        ? h('button', { type: 'button', onclick: () => saveSettings({ paused: !paused }) }, paused ? 'Resume' : 'Pause')
        : null);
    host.classList.toggle('is-paused', paused || !tracking.supported);
    const note = document.getElementById('preview-note');
    if (note) note.hidden = !tracking.demo;
  }

  /* ---------- actions ---------- */

  async function refresh() {
    try {
      const active = document.activeElement;
      const editing = state.route === 'settings' && active && view.contains(active) && /^(SELECT|INPUT|BUTTON)$/.test(active.tagName);
      state.snapshot = await api.snapshot();
      if (!editing) render();
    } catch {
      // keep the last good screen rather than flashing an error over it
    }
  }

  async function saveSettings(patch) {
    try {
      const result = await api.updateSettings(patch);
      if (result && result.settings) {
        state.snapshot.settings = { ...state.snapshot.settings, ...result.settings };
        state.snapshot.tracking = { ...state.snapshot.tracking, ...(result.tracking || {}) };
      }
      state.savedAt = Date.now();
      render();
      api.snapshot().then((snapshot) => {
        state.snapshot = snapshot;
        if (state.route !== 'settings') render();
      }).catch(() => {});
      setTimeout(() => {
        if (state.route === 'settings') render();
      }, 2600);
    } catch {
      // a failed write leaves the old value on screen
    }
  }

  function go(route) {
    if (window.location.hash !== `#/${route}`) window.location.hash = `#/${route}`;
    else {
      state.route = route;
      render();
    }
    closeMenu();
  }

  /* ---------- routing and menu ---------- */

  function readRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return ['today', 'apps', 'sites', 'settings'].includes(hash) ? hash : 'today';
  }

  function closeMenu() {
    state.menuOpen = false;
    sidebar.classList.remove('is-open');
    scrim.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-menu-open');
  }

  function toggleMenu() {
    state.menuOpen = !state.menuOpen;
    sidebar.classList.toggle('is-open', state.menuOpen);
    scrim.hidden = !state.menuOpen;
    menuBtn.setAttribute('aria-expanded', String(state.menuOpen));
    document.body.classList.toggle('is-menu-open', state.menuOpen);
    if (state.menuOpen) {
      const current = sidebar.querySelector('.nav-item[aria-current="page"]') || sidebar.querySelector('.nav-item');
      if (current) current.focus({ preventScroll: true });
    }
  }

  window.addEventListener('hashchange', () => {
    state.route = readRoute();
    closeMenu();
    render();
    window.scrollTo({ top: 0 });
  });

  menuBtn.addEventListener('click', toggleMenu);
  sheetClose.addEventListener('click', closeMenu);
  scrim.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.menuOpen) closeMenu();
  });

  dialog.addEventListener('close', async () => {
    if (dialog.returnValue === 'delete') {
      await api.clearData();
      state.savedAt = Date.now();
      await refresh();
    }
  });

  api.onChanged(() => {
    if (!document.hidden) refresh();
  });
  setInterval(() => {
    if (!document.hidden) refresh();
  }, 60000);

  state.route = readRoute();
  refresh();

  /* ---------- preview bridge (opened outside Electron) ---------- */

  function createDemoApi() {
    const days = window.TallyDemo ? window.TallyDemo.buildDays(30) : { days: {} };
    const settings = {
      sampleSeconds: 5, idleSeconds: 120, paused: false, recordWebsites: true,
      launchAtLogin: false, retentionDays: 90, browsers: null,
    };
    const browserList = [
      { id: 'chrome', name: 'Google Chrome', profiles: 1, installed: true },
      { id: 'edge', name: 'Microsoft Edge', profiles: 1, installed: true },
      { id: 'brave', name: 'Brave', profiles: 0, installed: false },
      { id: 'vivaldi', name: 'Vivaldi', profiles: 0, installed: false },
      { id: 'opera', name: 'Opera', profiles: 0, installed: false },
      { id: 'opera-gx', name: 'Opera GX', profiles: 0, installed: false },
      { id: 'firefox', name: 'Firefox', profiles: 0, installed: false },
      { id: 'zen', name: 'Zen', profiles: 0, installed: false },
    ];
    const demoNow = new Date();
    const demoKey = window.TallyDemo ? window.TallyDemo.keyOf(demoNow) : '';

    function snapshot() {
      const today = window.TallyDemo.aggregate(days, 1);
      const yesterdayDate = new Date(demoNow.getFullYear(), demoNow.getMonth(), demoNow.getDate() - 1, 12);
      const yesterday = window.TallyDemo.aggregate({ [window.TallyDemo.keyOf(yesterdayDate)]: days[window.TallyDemo.keyOf(yesterdayDate)] }, 1, yesterdayDate);
      const keys = Object.keys(days).sort();
      return {
        now: new Date().toISOString(),
        todayKey: demoKey,
        today,
        yesterday,
        ranges: { 1: today, 7: window.TallyDemo.aggregate(days, 7), 30: window.TallyDemo.aggregate(days, 30) },
        settings,
        tracking: {
          supported: true, lastSampleAt: Date.now(), app: 'Google Chrome', site: 'youtube.com',
          title: 'How a mechanical watch works - YouTube', idleMs: 0, error: null, paused: settings.paused, sampling: 5, demo: true,
        },
        system: {
          platform: 'win32', version: '1.0.0', dataPath: 'C:\\Users\\you\\AppData\\Roaming\\Tally\\tally-data.json',
          browserList, supported: true, startedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
          storedDays: keys.length, oldestDay: keys[0] || null, fileSize: JSON.stringify(days).length,
        },
      };
    }

    return {
      snapshot: async () => snapshot(),
      range: async (n) => window.TallyDemo.aggregate(days, n),
      updateSettings: async (patch) => {
        Object.assign(settings, patch);
        return { settings: { ...settings }, tracking: snapshot().tracking };
      },
      clearData: async () => {
        for (const key of Object.keys(days)) delete days[key];
        return true;
      },
      openDataFolder: async () => true,
      rescanBrowsers: async () => browserList,
      onChanged: () => () => {},
    };
  }
})();
