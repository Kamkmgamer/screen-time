(function () {
  'use strict';

  const CHECK = '<svg viewBox="0 0 11 11" aria-hidden="true"><path d="m1.6 5.6 2.4 2.4L9.4 2.6"/></svg>';
  const CHEVRON = '<svg class="chev" viewBox="0 0 13 13" aria-hidden="true"><path d="m3 5 3.5 3.5L10 5"/></svg>';
  const EXTERNAL = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5h5.5V8M9.5 2.5 3.5 8.5"/></svg>';

  const MONTHS = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const SHORT_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long' });
  const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const TIME_WITH_SECONDS = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const state = {
    snapshot: null,
    route: 'today',
    ranges: { apps: 7, sites: 7 },
    openApp: undefined,
    openGroup: 'recording',
    savedAt: 0,
  };

  const view = document.getElementById('view');
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

  function glyph(key, className = 'glyph') {
    if (!key) return h('span', { class: `${className} glyph-empty`, 'aria-hidden': 'true' });
    return h('span', { class: className, 'aria-hidden': 'true', style: `--glyph: url("icons/${key}.svg")` });
  }

  function appGlyph(name, className) {
    return glyph(APP_GLYPHS[String(name || '').toLowerCase()] || null, className);
  }

  function siteGlyph(domain, className) {
    const host = String(domain || '').toLowerCase().replace(/^www\./, '');
    const parts = host.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const key = SITE_GLYPHS[parts.slice(i).join('.')];
      if (key) return glyph(key, className);
    }
    return glyph(null, className);
  }

  function browserGlyph(id, className) {
    return glyph(BROWSER_GLYPHS.includes(id) ? id : null, className);
  }

  /* ---------- figures ---------- */

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

  function figure(seconds) {
    const p = durationParts(seconds);
    const fragment = document.createDocumentFragment();
    if (p.under) {
      fragment.append(h('span', { text: '< 1' }), h('span', { class: 'u', text: 'm' }));
      return fragment;
    }
    if (p.h) fragment.append(h('span', { text: String(p.h) }), h('span', { class: 'u', text: 'h' }));
    if (p.m || !p.h) fragment.append(h('span', { text: String(p.m) }), h('span', { class: 'u', text: 'm' }));
    return fragment;
  }

  function share(part, whole) {
    const value = whole ? (Number(part) / Number(whole)) * 100 : 0;
    return {
      value,
      text: value > 0 && value < 0.5 ? '<1%' : `${Math.round(value)}%`,
      width: value > 0 ? Math.max(0.6, Math.min(100, value)) : 0,
    };
  }

  function pctText(part, whole) {
    return share(part, whole).text;
  }

  function plural(count, one, many) {
    return `${count} ${count === 1 ? one : many}`;
  }

  function shortName(name) {
    return String(name || '').replace(/^(Google|Microsoft|Mozilla)\s+/, '');
  }

  // The app that was counted most recently today. The tracker only knows what it
  // has counted in this run, so a fresh session would otherwise claim nothing was
  // ever counted while the day already holds hours.
  function lastCountedName(day) {
    let best = null;
    for (const app of Object.values((day && day.apps) || {})) {
      if (!best || (Number(app.lastAt) || 0) > (Number(best.lastAt) || 0)) best = app;
    }
    return best ? best.name : null;
  }

  function timeOf(iso) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return TIME.format(date);
  }

  function clockOf(ms, withSeconds = false) {
    if (!ms) return '—';
    const date = new Date(Number(ms));
    if (Number.isNaN(date.getTime())) return '—';
    return (withSeconds ? TIME_WITH_SECONDS : TIME).format(date);
  }

  function dayLabel(key) {
    if (!key) return '';
    const [y, m, d] = key.split('-').map(Number);
    return MONTHS.format(new Date(y, m - 1, d, 12));
  }

  function shortDayLabel(key) {
    if (!key) return '';
    const [y, m, d] = key.split('-').map(Number);
    return SHORT_DAY.format(new Date(y, m - 1, d, 12));
  }

  function keyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }

  function rangeLabel(days, todayKey) {
    if (days === 1) return dayLabel(todayKey);
    const end = keyToDate(todayKey);
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    if (start.getMonth() === end.getMonth()) return `${start.getDate()} – ${end.getDate()} ${MONTH.format(end)}`;
    return `${start.getDate()} ${MONTH.format(start)} – ${end.getDate()} ${MONTH.format(end)}`;
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function totalOf(rows) {
    return rows.reduce((sum, row) => sum + (Number(row.seconds) || 0), 0);
  }

  function mediaCeilingLabel(minutes) {
    if (minutes === null || minutes === undefined) return 'never';
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes === 60) return '1 hour';
    return `${minutes / 60} hours`;
  }

  /* ---------- page shell ---------- */

  function pageHead({ eyebrow, title, right }) {
    return h('header', { class: 'page-head' },
      h('div', null,
        h('div', { class: 'eyebrow', text: eyebrow }),
        h('h1', { text: title })),
      right ? h('div', { class: 'head-right' }, right) : null);
  }

  function stampText(snap) {
    if (snap.settings.paused) return 'Paused';
    return snap.tracking.lastSampleAt ? `Updated ${clockOf(snap.tracking.lastSampleAt)}` : 'Just now';
  }

  function rangeControl(kind, value) {
    const options = [[1, '1 day'], [7, '7 days'], [30, '30 days']];
    return h('div', { class: 'seg', role: 'group', 'aria-label': 'Time range' },
      options.map(([days, label]) => h('button', {
        type: 'button',
        class: value === days ? 'on' : null,
        'aria-pressed': String(value === days),
        onclick: () => {
          state.ranges[kind] = days;
          if (kind === 'apps') state.openApp = undefined;
          render();
        },
      }, label)));
  }

  function listEmpty(lines, action) {
    return h('div', { class: 'list-empty' },
      lines.map((line) => h('p', { text: line })),
      action || null);
  }

  /* ---------- today ---------- */

  function renderToday(snap) {
    const data = snap.today;
    const apps = data.apps;
    const sites = data.sites;
    const yesterday = snap.yesterday || { totalSeconds: 0 };
    const now = new Date(snap.now || Date.now());

    const header = pageHead({
      eyebrow: dayLabel(snap.todayKey),
      title: 'Today',
      right: [h('span', { class: 'stamp num', text: stampText(snap) })],
    });

    const summary = h('div', { class: 'summary' },
      h('div', { class: 'total-block' },
        h('div', { class: 'label', text: 'Recorded today' }),
        h('div', { class: 'total num' }, figure(data.totalSeconds)),
        h('div', { class: 'sub' },
          data.browserSeconds > 0
            ? ['Includes ', h('b', { class: 'num', text: durationText(data.browserSeconds) }), ' in browsers']
            : (data.totalSeconds > 0 ? 'No browser time today.' : 'Nothing recorded yet today.'))),
      h('dl', { class: 'mini' },
        h('div', null,
          h('dt', { text: 'Yesterday, whole day' }),
          h('dd', { class: 'num', text: yesterday.totalSeconds ? durationText(yesterday.totalSeconds) : '—' })),
        h('div', null,
          h('dt', { text: 'Apps' }),
          h('dd', { class: 'num', text: String(apps.length) })),
        h('div', null,
          h('dt', { text: 'Websites' }),
          h('dd', { class: 'num', text: String(sites.length) }))));

    const hours = hourBlock(data, now);
    const lists = h('div', { class: 'lists' }, appList(data, snap), siteList(data, snap));

    const page = h('div', { class: 'page-inner' },
      header,
      h('section', { class: 'sheet' },
        summary,
        h('div', { class: 'rule' }),
        hours,
        h('div', { class: 'rule' }),
        lists));
    return page;
  }

  function hourBlock(data, now) {
    const hasData = data.totalSeconds > 0;
    const nowHour = now.getHours();
    const futureWidth = Math.max(0, ((23 - nowHour) / 24) * 100);
    const columns = [];

    for (let hour = 0; hour < 24; hour++) {
      const seconds = Number((data.hours || [])[hour]) || 0;
      const minutes = Math.min(60, seconds / 60);
      const live = hour <= nowHour;
      const height = live && minutes > 0 ? Math.max(1.5, Math.min(100, (minutes / 60) * 100)) : 0;
      columns.push(h('div', { class: 'col' },
        h('div', {
          class: `bar${hour === nowHour ? ' now' : ''}`,
          style: `height:${height}%`,
          title: `${String(hour).padStart(2, '0')}:00 – ${Math.round(seconds / 60)} m`,
          role: 'presentation',
        })));
    }

    const peak = hasData ? data.hours.indexOf(Math.max(...data.hours)) : -1;
    const meta = hasData
      ? h('div', { class: 'hours-meta' },
        h('span', { class: 'num', text: `Busiest ${String(peak).padStart(2, '0')}–${String((peak + 1) % 24).padStart(2, '0')} · ${Math.round(data.hours[peak] / 60)} m` }),
        h('span', { class: 'faint num', text: `First ${timeOf(data.firstAt) || '—'} · Last ${timeOf(data.lastAt) || '—'}` }))
      : h('div', { class: 'hours-meta' }, h('span', { class: 'faint', text: 'Nothing recorded yet today.' }));

    const labelAt = (hour) => hour % 3 === 0;

    const axis = h('div', { class: 'axis', 'aria-hidden': 'true' },
      Array.from({ length: 24 }, (_, hour) => h('div', { class: `cell${labelAt(hour) ? ' on' : ''}` },
        labelAt(hour) ? h('span', { text: String(hour).padStart(2, '0') }) : null)));

    return h('div', { class: 'hours' },
      h('div', { class: 'hours-head' },
        h('div', { class: 'hours-title', text: 'By hour' }),
        meta),
      h('div', {
        class: 'chart',
        role: 'img',
        'aria-label': hasData
          ? `Minutes recorded each hour today. Busiest hour ${String(peak).padStart(2, '0')}:00 with ${Math.round(data.hours[peak] / 60)} minutes.`
          : 'No minutes recorded yet today.',
      },
        futureWidth ? h('div', { class: 'future', style: `width:${futureWidth}%`, 'aria-hidden': 'true' }) : null,
        columns),
      axis);
  }

  function appList(data, snap) {
    const total = data.totalSeconds;
    const apps = data.apps;
    const shown = apps.slice(0, 6);
    const rest = apps.slice(6);
    const restSeconds = totalOf(rest);
    const rows = shown.map((app) => itemRow({
      glyph: appGlyph(app.name),
      name: app.name,
      seconds: app.seconds,
      whole: total,
    }));

    if (restSeconds > 0.5) {
      rows.push(itemRow({
        glyph: glyph(null),
        name: 'Other apps',
        seconds: restSeconds,
        whole: total,
        other: true,
      }));
    }

    return h('section', { class: 'list' },
      h('div', { class: 'list-head' },
        h('div', { class: 'list-title', text: 'Apps' }),
        h('div', { class: 'list-meta', text: 'Share of recorded time' })),
      apps.length
        ? rows
        : listEmpty([snap.settings.paused
          ? 'Tracking is paused, so nothing is being recorded.'
          : 'Nothing recorded yet today. Open an app and Tally will list it here.']));
  }

  function siteList(data, snap) {
    const total = data.browserSeconds;
    const sites = data.sites;
    const shown = sites.slice(0, 6);
    const rest = sites.slice(6);
    const restSeconds = totalOf(rest);
    const namedSeconds = totalOf(sites);
    const unattributed = Math.max(0, total - namedSeconds);
    const rows = shown.map((site) => itemRow({
      glyph: siteGlyph(site.domain),
      name: site.domain,
      seconds: site.seconds,
      whole: total,
    }));

    if (restSeconds > 0.5) {
      rows.push(itemRow({
        glyph: glyph(null),
        name: 'Other sites',
        seconds: restSeconds,
        whole: total,
        other: true,
      }));
    }
    if (unattributed > 0.5) {
      rows.push(itemRow({
        glyph: glyph(null),
        name: 'No site name',
        seconds: unattributed,
        whole: total,
        other: true,
      }));
    }

    let empty = null;
    if (!snap.settings.recordWebsites) {
      empty = listEmpty(
        ['Website names are turned off.', 'Browser time still counts, without a domain.'],
        h('button', { class: 'link-btn', type: 'button', onclick: () => go('settings') }, 'Turn on website names'));
    } else if (!total) {
      empty = listEmpty(['No browser time yet today.', 'Time in a browser will be matched to the page it shows.']);
    }

    return h('section', { class: 'list' },
      h('div', { class: 'list-head' },
        h('div', { class: 'list-title', text: 'Websites' }),
        h('div', { class: 'list-meta', text: 'Share of browser time' })),
      empty && !rows.length ? empty : rows,
      empty && rows.length ? h('div', { class: 'list-foot' }, empty) : null);
  }

  function itemRow({ glyph: mark, name, seconds, whole, other = false }) {
    const part = share(seconds, whole);
    return h('div', { class: `item${other ? ' other' : ''}` },
      mark || null,
      h('div', { class: 'item-main' },
        h('div', { class: 'item-line' },
          h('span', { class: 'item-name', text: name, title: name }),
          h('span', { class: 'item-time num', text: durationText(seconds) }),
          h('span', { class: 'item-pct num', text: part.text })),
        h('div', { class: 'track' }, h('i', { style: `width:${part.width}%` }))));
  }

  /* ---------- apps ---------- */

  function renderApps(snap) {
    const days = state.ranges.apps;
    const data = snap.ranges[days] || snap.today;
    const total = data.totalSeconds;
    const apps = data.apps;

    const header = pageHead({
      eyebrow: rangeLabel(days, snap.todayKey),
      title: 'Apps',
      right: [rangeControl('apps', days), h('span', { class: 'stamp num', text: `${plural(apps.length, 'app', 'apps')} · Updated ${clockOf(snap.tracking.lastSampleAt)}` })],
    });

    const top = apps.slice(0, 5);
    const topSeconds = totalOf(top);
    const remainder = Math.max(0, total - topSeconds);
    const strip = total
      ? h('div', { class: 'strip', 'aria-hidden': 'true' },
        top.map((app, index) => h('i', {
          style: `width:${share(app.seconds, total).width}%;background:${STRIP_COLOURS[index % STRIP_COLOURS.length]}`,
        })),
        remainder > 0.5 ? h('i', { style: `width:${share(remainder, total).width}%;background:#e2e6eb` }) : null)
      : null;

    const context = h('aside', { class: 'ctx' },
      h('div', { class: 'label', text: 'Recorded' }),
      h('div', { class: 'big num' }, figure(total)),
      h('div', { class: 'ctx-sub', text: total
        ? `Across ${plural(apps.length, 'app', 'apps')}, ${days === 1 ? 'today' : `${days} days`}`
        : 'Nothing recorded in this range' }),
      strip,
      total ? h('div', { class: 'ctx-legend', text: `${top.length === 1 ? '1 app holds' : `${top.length} apps hold`} ${pctText(topSeconds, total)} of recorded time.` }) : null,
      h('div', { class: 'ctx-note', text: 'A window title is the last one seen, not a duration. Open a row to read it.' }));

    const openKey = state.openApp === undefined ? (apps[0] ? apps[0].key : null) : state.openApp;
    const rows = apps.slice(0, 8);
    const restSeconds = Math.max(0, total - totalOf(rows));

    const table = h('div', { class: 'table' },
      h('div', { class: 'thead' },
        h('span'),
        h('span'),
        h('span', { text: 'App' }),
        h('span', { class: 'r', text: 'Time' }),
        h('span', { class: 'lh', text: 'Share' }),
        h('span', { class: 'r', text: '%' }),
        h('span')),
      apps.length
        ? rows.map((app, index) => {
          const open = app.key === openKey;
          return [
            h('button', {
              type: 'button',
              class: `trow${open ? ' open' : ''}`,
              'aria-expanded': String(open),
              onclick: () => {
                state.openApp = open ? null : app.key;
                render();
              },
            },
            h('span', { class: 'idx num', text: String(index + 1).padStart(2, '0') }),
            appGlyph(app.name),
            h('span', { class: 'name', text: app.name, title: app.name }),
            h('span', { class: 'time num', text: durationText(app.seconds) }),
            h('span', { class: 'track' }, h('i', { style: `width:${share(app.seconds, total).width}%` })),
            h('span', { class: 'pct num', text: pctText(app.seconds, total) }),
            h('span', { class: 'chev-wrap', html: CHEVRON })),
            open ? h('div', { class: 'title-row' },
              h('span', { class: 'title-k', text: 'Last title' }),
              h('span', { class: 'title-v', text: app.title || 'No window title recorded', title: app.title || '' }),
              h('span', { class: 'title-t num', text: app.lastAt ? `${SHORT_DAY.format(new Date(app.lastAt))}, ${clockOf(app.lastAt)}` : '' })) : null,
          ];
        })
        : h('div', { class: 'table-empty' },
          listEmpty(['Nothing recorded in this range.', days === 1
            ? 'Today has only just started, or tracking is paused.'
            : 'Try a shorter range, or leave Tally running in the tray.'])),
      apps.length && restSeconds > 0.5
        ? h('div', { class: 'trow other' },
          h('span', { class: 'idx num', text: String(Math.min(rows.length, 8) + 1).padStart(2, '0') }),
          h('span', { class: 'glyph glyph-empty', 'aria-hidden': 'true' }),
          h('span', { class: 'name', text: 'Other apps' }),
          h('span', { class: 'time num', text: durationText(restSeconds) }),
          h('span', { class: 'track' }, h('i', { style: `width:${share(restSeconds, total).width}%` })),
          h('span', { class: 'pct num', text: pctText(restSeconds, total) }),
          h('span'))
        : null);

    return h('div', { class: 'page-inner' }, header, h('div', { class: 'split' }, context, table));
  }

  const STRIP_COLOURS = ['#39414b', '#5f6874', '#8b949f', '#b5bdc8', '#d8dde3'];

  /* ---------- websites ---------- */

  function renderSites(snap) {
    const days = state.ranges.sites;
    const data = snap.ranges[days] || snap.today;
    const total = data.browserSeconds;
    const sites = data.sites;
    const shown = sites.slice(0, 6);
    const rest = sites.slice(6);
    const restSeconds = totalOf(rest);
    const namedSeconds = totalOf(sites);
    const unattributed = Math.max(0, total - namedSeconds);

    const header = pageHead({
      eyebrow: rangeLabel(days, snap.todayKey),
      title: 'Websites',
      right: [rangeControl('sites', days), h('span', { class: 'stamp num', text: `${plural(sites.length, 'site', 'sites')} named` })],
    });

    const rows = shown.map((site) => siteRow({
      glyph: siteGlyph(site.domain),
      name: site.domain,
      detail: site.title ? `${shortName(site.browser || 'Browser')} · ${site.title}` : shortName(site.browser || 'Browser'),
      seconds: site.seconds,
      whole: total,
    }));

    if (restSeconds > 0.5) {
      rows.push(siteRow({
        glyph: glyph(null),
        name: 'Other sites',
        detail: `${plural(rest.length, 'site', 'sites')} below this list`,
        seconds: restSeconds,
        whole: total,
        other: true,
      }));
    }
    if (unattributed > 0.5) {
      rows.push(siteRow({
        glyph: glyph(null),
        name: 'Browser time without a website name',
        detail: snap.settings.recordWebsites ? 'No recent match in history' : 'Naming is turned off',
        seconds: unattributed,
        whole: total,
        dashed: true,
      }));
    }

    const meta = total
      ? h('div', { class: 'hours-meta' },
        h('span', { class: 'num', text: `${durationText(total)} in browsers` }),
        h('span', { class: 'faint num', text: unattributed > 0.5 ? `${durationText(unattributed)} without a site name` : 'Every browser minute named' }))
      : h('div', { class: 'hours-meta' }, h('span', { class: 'faint', text: 'No browser time in this range.' }));

    let empty = null;
    if (!snap.settings.recordWebsites) {
      empty = listEmpty(
        ['Website names are turned off.', 'Tally still counts every browser as an app. Names come only from local browser history.'],
        h('button', { class: 'link-btn', type: 'button', onclick: () => go('settings') }, 'Turn on website names'));
    } else if (!total) {
      empty = listEmpty(['No website time recorded in this range.', 'Website names come from the history file of the browser in front.']);
    }

    const body = h('section', { class: 'sites' },
      h('div', { class: 'sites-head' },
        h('div', { class: 'hours-title', text: 'Share of browser time' }),
        meta),
      rows.length ? rows : null,
      empty ? h('div', { class: 'sites-empty' }, empty) : null,
      rows.length ? h('div', { class: 'sites-note', text: 'Names come from each browser’s own history, matched against the window title. Tally copies the file, reads it here and deletes the copy. Nothing is uploaded.' }) : null,
      browserSplit(data, total));

    return h('div', { class: 'page-inner' }, header, body);
  }

  function siteRow({ glyph: mark, name, detail, seconds, whole, other = false, dashed = false }) {
    const part = share(seconds, whole);
    return h('div', { class: `site${other ? ' other' : ''}${dashed ? ' unattributed' : ''}` },
      h('div', { class: 'site-line' },
        mark || null,
        h('span', { class: 'site-name', text: name, title: name }),
        h('span', { class: 'site-browser', text: detail, title: detail }),
        h('span', { class: 'site-time num', text: durationText(seconds) }),
        h('span', { class: 'site-pct num', text: part.text })),
      h('div', { class: `track${dashed ? ' dashed' : ''}` }, dashed ? null : h('i', { style: `width:${part.width}%` })));
  }

  function browserSplit(data, total) {
    const rows = (data.apps || []).filter((app) => app.browser && app.seconds > 0);
    if (!rows.length || !total) return null;
    const ordered = [...rows].sort((a, b) => b.seconds - a.seconds);
    const top = ordered.slice(0, 4);
    const restSeconds = totalOf(ordered.slice(4));
    const pieces = top.map((app, index) => ({
      name: shortName(app.browser),
      seconds: app.seconds,
      colour: STRIP_COLOURS[index % STRIP_COLOURS.length],
    }));
    if (restSeconds > 0.5) pieces.push({ name: 'Other', seconds: restSeconds, colour: '#e2e6eb' });

    return h('div', { class: 'browser-split' },
      h('div', { class: 'label', text: 'By browser' }),
      h('div', { class: 'split-strip', 'aria-hidden': 'true' },
        pieces.map((piece) => h('i', { style: `width:${share(piece.seconds, total).width}%;background:${piece.colour}` }))),
      h('div', { class: 'split-legend' },
        pieces.map((piece) => h('span', null,
          h('b', { text: piece.name }),
          h('span', { class: 'num', text: durationText(piece.seconds) })))));
  }

  /* ---------- settings ---------- */

  function renderSettings(snap) {
    const settings = snap.settings;
    const system = snap.system;
    const tracking = snap.tracking;
    const reason = reasonOf(tracking, settings);
    const saved = Date.now() - state.savedAt < 2600;
    const platform = system.platform === 'win32'
      ? `Windows${system.arch ? ` ${system.arch === 'x64' ? 'x64' : system.arch}` : ''}`
      : (system.platform || 'Desktop');

    const header = pageHead({
      eyebrow: `Tally ${system.version} · ${platform}`,
      title: 'Settings',
      right: [saved
        ? h('span', { class: 'stamp', text: 'Saved' })
        : h('span', { class: 'stamp', text: 'Nothing leaves this PC' })],
    });

    const index = [
      ['recording', 'Recording'],
      ['websites', 'Websites'],
      ['data', 'Data'],
      ['about', 'About'],
    ];

    const indexRail = h('aside', { class: 'index', 'aria-label': 'Settings sections' },
      index.map(([key, label], i) => h('button', {
        type: 'button',
        class: state.openGroup === key ? 'on' : null,
        onclick: () => {
          state.openGroup = key;
          document.querySelectorAll('.index button').forEach((button) => {
            button.classList.toggle('on', button.dataset.group === key);
          });
          const target = document.getElementById(`group-${key}`);
          if (target) target.scrollIntoView({ block: 'start' });
        },
        dataset: { group: key },
      },
      h('span', { class: 'n num', text: `0${i + 1}` }),
      h('span', { text: label }))));

    const browsers = system.browserList || [];
    const installed = browsers.filter((browser) => browser.installed);
    const enabled = settings.browsers === null ? installed.map((browser) => browser.id) : settings.browsers;

    const recording = h('section', { class: 'group', id: 'group-recording' },
      groupHead('01', 'Recording', tracking.mediaAvailable === false ? 'Keyboard and mouse only' : 'Media sessions readable'),
      h('div', { class: 'readout' },
        readoutCell('State', STATES[reason].label, 'state'),
        readoutCell('Last sample', clockOf(tracking.lastSampleAt, true), 'num'),
        readoutCell('Idle poll', tracking.idle ? '20 s' : `${tracking.sampling || settings.sampleSeconds} s`, 'num'),
        readoutCell('Media sessions', tracking.mediaAvailable === false
          ? 'Unavailable'
          : tracking.mediaSessions == null ? 'Not read' : `${tracking.mediaSessions} detected`, 'num')),
      switchRow('Record screen time', 'Pause any time from the sidebar; nothing is deleted.', !settings.paused,
        () => saveSettings({ paused: !settings.paused })),
      switchRow('Open Tally at login', 'Start hidden in the tray when you sign in to Windows.', settings.launchAtLogin,
        () => saveSettings({ launchAtLogin: !settings.launchAtLogin })),
      h('div', { class: 'fields' },
        fieldSelect('Sample every',
          [[5, '5 seconds'], [10, '10 seconds'], [30, '30 seconds']],
          settings.sampleSeconds,
          (value) => saveSettings({ sampleSeconds: Number(value) })),
        fieldSelect('Ignore idle time after',
          [[60, '1 minute'], [120, '2 minutes'], [300, '5 minutes'], [600, '10 minutes']],
          settings.idleSeconds,
          (value) => saveSettings({ idleSeconds: Number(value) })),
        fieldSelect('Stop counting media after',
          [[30, '30 minutes'], [60, '1 hour'], [120, '2 hours'], [240, '4 hours'], ['never', 'Never']],
          settings.mediaCeilingMinutes == null ? 'never' : settings.mediaCeilingMinutes,
          (value) => saveSettings({ mediaCeilingMinutes: value === 'never' ? null : Number(value) }))),
      h('p', { class: 'field-hint', text: 'Media keeps the clock running without input until this limit, then waits for a keystroke. Never means it keeps counting until the player stops.' }),
      tracking.mediaAvailable === false
        ? h('p', { class: 'field-hint', text: 'Windows media sessions are not readable on this build, so idle time is measured from keyboard and mouse only.' })
        : null);

    const websites = h('section', { class: 'group', id: 'group-websites' },
      groupHead('02', 'Websites', `${plural(installed.length, 'browser', 'browsers')} found`),
      switchRow('Record website names', 'Copies each browser’s history to a temporary folder, matches the window title, then deletes the copy.',
        settings.recordWebsites, () => saveSettings({ recordWebsites: !settings.recordWebsites })),
      installed.length
        ? h('div', { class: 'browsers' }, installed.map((browser) => h('label', { class: 'browser' },
          h('input', {
            class: 'check-input',
            type: 'checkbox',
            checked: enabled.includes(browser.id),
            onchange: (event) => {
              const next = new Set(enabled);
              if (event.target.checked) next.add(browser.id);
              else next.delete(browser.id);
              const all = installed.every((row) => next.has(row.id)) ? null : [...next];
              saveSettings({ browsers: all });
            },
          }),
          h('span', { class: 'check', html: CHECK }),
          browserGlyph(browser.id),
          h('span', { class: 'bn', text: browser.name }))))
        : h('p', { class: 'note', text: 'No supported browser found on this PC yet.' }),
      h('p', { class: 'note' },
        'The copy never leaves this device. ',
        h('button', {
          class: 'link-btn',
          type: 'button',
          onclick: async () => {
            const list = await api.rescanBrowsers();
            state.snapshot.system.browserList = list;
            render();
          },
        }, 'Rescan browsers')));

    const oldest = system.oldestDay;
    const dataGroup = h('section', { class: 'group', id: 'group-data' },
      groupHead('03', 'Data', `${formatBytes(system.fileSize || 0)} on disk`),
      h('div', { class: 'row' },
        h('div', null,
          h('div', { class: 'row-t', text: 'Keep history for' }),
          h('div', { class: 'row-d', text: 'Older days are deleted automatically.' })),
        h('div', { class: 'row-r' },
          h('select', {
            class: 'select',
            'aria-label': 'Keep history for',
            onchange: (event) => saveSettings({ retentionDays: Number(event.target.value) }),
          },
          [[30, '30 days'], [90, '90 days'], [365, '1 year']].map(([value, label]) => h('option', {
            value,
            selected: Number(settings.retentionDays) === value,
          }, label))))),
      h('div', { class: 'stats' },
        h('div', null, h('div', { class: 'k', text: 'Days stored' }), h('div', { class: 'v num', text: String(system.storedDays || 0) })),
        h('div', null, h('div', { class: 'k', text: 'Oldest day' }), h('div', { class: 'v num', text: oldest ? shortDayLabel(oldest) : '—' })),
        h('div', { class: 'path-stat' },
          h('div', { class: 'k', text: 'File' }),
          h('div', { class: 'v num path', text: system.dataPath, title: system.dataPath }))),
      h('div', { class: 'row destructive' },
        h('div', null,
          h('div', { class: 'row-t danger', text: 'Delete all data' }),
          h('div', { class: 'row-d', text: 'Removes every day, then starts empty. It cannot be undone.' })),
        h('div', { class: 'row-r' },
          h('button', { class: 'btn btn-danger', type: 'button', onclick: () => dialog.showModal() }, 'Delete data…'))));

    const about = h('section', { class: 'group', id: 'group-about' },
      groupHead('04', 'About', `Tally ${system.version}`),
      h('p', { class: 'about', text: 'One local JSON file. No account, no extension, no upload, no network requests. Tally reads the title of the window in front every few seconds and writes the total here.' }),
      h('p', { class: 'about faint', text: `${platform} · ${system.dataPath}` }));

    const panel = h('section', { class: 'panel' },
      recording,
      websites,
      dataGroup,
      about,
      h('div', { class: 'panel-foot' },
        h('span', { text: `Tally ${system.version}` }),
        h('span', { class: 'num', text: platform }),
        h('span', { text: 'No network requests' }),
        h('button', {
          class: 'link-btn',
          type: 'button',
          onclick: () => api.openDataFolder(),
        }, 'Show data folder', h('span', { class: 'ext', html: EXTERNAL }))));

    return h('div', { class: 'page-inner' },
      header,
      h('div', { class: 'settings' }, indexRail, panel));
  }

  function groupHead(number, title, meta) {
    return h('div', { class: 'group-head' },
      h('span', { class: 'group-n num', text: number }),
      h('span', { class: 'group-t', text: title }),
      meta ? h('span', { class: 'group-m', text: meta }) : null);
  }

  function readoutCell(label, value, className) {
    return h('div', null,
      h('span', { class: 'k', text: label }),
      h('span', { class: `v${className === 'num' ? ' num' : ''}${className === 'state' ? ' state' : ''}`, text: value }));
  }

  function switchRow(title, description, checked, onChange) {
    return h('div', { class: 'row' },
      h('div', null,
        h('div', { class: 'row-t', text: title }),
        h('div', { class: 'row-d', text: description })),
      h('div', { class: 'row-r' },
        h('button', {
          class: 'switch',
          type: 'button',
          role: 'switch',
          'aria-checked': String(Boolean(checked)),
          'aria-label': title,
          onclick: onChange,
        })));
  }

  function fieldSelect(label, options, value, onChange) {
    return h('label', { class: 'field' },
      h('span', { class: 'k', text: label }),
      h('select', {
        class: 'select',
        onchange: (event) => onChange(event.target.value),
      },
      options.map(([optionValue, optionLabel]) => h('option', {
        value: optionValue,
        selected: String(optionValue) === String(value),
      }, optionLabel))));
  }

  /* ---------- tracker state ---------- */

  const STATES = {
    recording: { label: 'Recording', dot: true, why: 'Time is being added.' },
    media: { label: 'Media in foreground', dot: true, why: 'Time continues with no input.' },
    idle: { label: 'Idle', dot: false, why: 'No time added. Counting starts again on input.' },
    limit: { label: 'Media limit reached', dot: false, why: 'Media kept playing without input. Counting resumes when you touch the keyboard.' },
    paused: { label: 'Paused', dot: false, why: 'Nothing is being recorded. Resume when you want totals again.' },
    self: { label: 'Tally in front', dot: false, why: 'Tally is in front now, and is never counted.' },
    starting: { label: 'Starting', dot: false, why: 'Reading the app in front.' },
    unsupported: { label: 'Tracking unavailable', dot: false, why: 'Screen-time tracking currently runs on Windows.' },
    error: { label: 'Not recording', dot: false, why: 'The last read did not work.' },
  };

  function reasonOf(tracking, settings) {
    if (!tracking.supported) return 'unsupported';
    if (settings.paused) return 'paused';
    if (tracking.error) return 'error';
    return tracking.reason || (tracking.idle ? 'idle' : tracking.media ? 'media' : 'recording');
  }

  function stateCopy(snap) {
    const tracking = snap.tracking;
    const reason = reasonOf(tracking, snap.settings);
    const base = STATES[reason] || STATES.starting;
    const why = reason === 'recording' && state.route === 'sites' && snap.settings.recordWebsites
      ? 'Titles are read here on this PC.'
      : reason === 'recording' && tracking.app
        ? `${shortName(tracking.app)} is in front. Time is being added.`
        : reason === 'media' && tracking.app
          ? `${shortName(tracking.app)} is playing media. Time continues with no input.`
          : reason === 'limit'
            ? `${snap.settings.mediaCeilingMinutes == null ? 'The media limit is reached.' : `Media played for ${mediaCeilingLabel(snap.settings.mediaCeilingMinutes)} without input.`} Counting resumes when you touch the keyboard.`
            : reason === 'error' && tracking.error
              ? tracking.error
              : base.why;
    const label = reason === 'self'
      ? (() => {
          const counted = lastCountedName(snap.today) || tracking.app;
          return counted ? `Last counted · ${shortName(counted)}` : STATES.self.label;
        })()
      : base.label;
    return { reason, label, why, dot: base.dot };
  }

  function renderRailState() {
    const host = document.getElementById('rail-state');
    const snap = state.snapshot;
    if (!host || !snap) return;
    const copy = stateCopy(snap);
    const paused = snap.settings.paused;
    const canPause = snap.tracking.supported;

    host.replaceChildren(h('div', { class: 'state' },
      h('div', { class: 'state-head' },
        h('span', { class: `dot${copy.dot ? '' : ' hollow'}` }),
        h('span', { class: 'state-label', text: copy.label, title: copy.label })),
      h('p', { class: 'state-why', text: copy.why }),
      canPause
        ? h('button', {
          class: 'state-action',
          type: 'button',
          onclick: () => saveSettings({ paused: !paused }),
        }, paused ? 'Resume recording' : 'Pause recording')
        : null));

    const note = document.getElementById('preview-note');
    if (note) note.hidden = !snap.tracking.demo;
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
    renderRailState();
  }

  function renderNav() {
    document.querySelectorAll('.nav-item').forEach((item) => {
      if (item.dataset.nav === state.route) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  /* ---------- actions ---------- */

  async function refresh() {
    try {
      const active = document.activeElement;
      const editing = state.route === 'settings' && active && view.contains(active) && /^(SELECT|INPUT)$/.test(active.tagName);
      state.snapshot = await api.snapshot();
      if (!editing) render();
      else renderRailState();
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
        render();
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
  }

  /* ---------- routing ---------- */

  function readRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return ['today', 'apps', 'sites', 'settings'].includes(hash) ? hash : 'today';
  }

  window.addEventListener('hashchange', () => {
    state.route = readRoute();
    render();
    view.scrollTo({ top: 0 });
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
      sampleSeconds: 5, idleSeconds: 120, mediaCeilingMinutes: 120, paused: false,
      recordWebsites: true, launchAtLogin: false, retentionDays: 90, browsers: null,
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
          title: 'How a mechanical watch works - YouTube', idleMs: 0, idle: false,
          media: true, mediaSessions: 2, mediaAvailable: true,
          reason: 'media', error: null, paused: settings.paused, sampling: 5, demo: true,
        },
        system: {
          platform: 'win32', arch: 'x64', version: '1.2.0',
          dataPath: 'C:\\Users\\you\\AppData\\Roaming\\Tally\\tally-data.json',
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
