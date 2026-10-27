# Tally

A local screen-time tracker for Windows. It records the app in front of you and, when that app is a browser, the site on screen. Three screens: Today, Apps, Websites.

No account, no extension, no upload, no network requests. One JSON file on this PC.

## Run

```bash
npm install
npm start        # starts in the tray; closing the window keeps counting
npm run demo     # sample data, tracking off
```

The first run starts empty. Tally samples the foreground window every 5 seconds and saves after the first few records.

If nothing is recorded, `npm run check` prints the foreground window, its process and the idle clock through the same Win32 calls the tracker uses.

## What it counts

- The process and window title of the foreground window, every 5 seconds (5/10/30 in Settings).
- Idle time past 2 minutes is not counted (1/2/5/10 in Settings). The threshold is measured from the last keyboard or mouse input.
- Website names come from the browser's own history file. Tally copies `History` or `places.sqlite` to a temporary folder, matches the window title against recent visits, then deletes the copy. The history itself is never modified.
- Browsers: Chrome, Edge, Brave, Vivaldi, Opera, Opera GX, Firefox and Zen.
- History is kept for 30, 90 or 365 days, then pruned.

Pause from the tray, the sidebar or the Today header. Tally can start hidden at login.

## Where the data lives

`%APPDATA%\Tally\tally-data.json` — the path is shown in Settings, with a button to open the folder.

One file, written atomically, at most every 15 seconds while tracking. Deleting the data in Settings removes every app and site total and leaves the file with default settings.

## Limits

- **Windows only.** Foreground window, idle time and the tray use Win32 calls through `koffi`; there is no macOS or Linux tracker.
- **Website names are a heuristic.** A browser window is matched to a recent history entry by title. Private windows, cleared history, a page whose title changed after it loaded, or no recent visit all mean the browser time is counted but the site stays unnamed. No site is guessed from the URL bar.
- **Sampling, not events.** Each sample is credited to the window in front at that moment, so an app opened and closed between samples can be missed.
- **Runs from source.** There is no installer yet; `npm start` is the app.

## Structure

| Path | What it does |
| --- | --- |
| `electron/main.js` | window, tray, IPC, login item, demo and screenshot modes |
| `electron/preload.js` | the `window.tally` bridge |
| `electron/tracker/window.js` | Win32 foreground window and idle time via `koffi` |
| `electron/tracker/apps.js` | executable names, browser detection, window-title cleanup |
| `electron/tracker/browsers.js` | browser profile discovery, copied history lookup (`sql.js`) |
| `electron/tracker/store.js` | JSON store, per-day totals, aggregation, retention |
| `electron/tracker/index.js` | sampling loop, idle and self-exclusion |
| `app/` | renderer: shell, three screens, settings, bundled Geist fonts |

Sample data lives in `app/demo-data.js` and is used only by `npm run demo` and the browser preview.
