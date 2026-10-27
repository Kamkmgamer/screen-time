// Prints the Windows SDK folder that holds the C++/WinRT headers, for binding.gyp.
// Called by node-gyp while it configures the media addon.
const fs = require('node:fs');
const path = require('node:path');

const roots = [
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'Include'),
  path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Windows Kits', '10', 'Include'),
];

for (const root of roots) {
  let versions = [];
  try {
    versions = fs.readdirSync(root).filter((name) => /^10\./.test(name));
  } catch {
    continue;
  }
  versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const version of versions.reverse()) {
    const dir = path.join(root, version, 'cppwinrt');
    if (fs.existsSync(path.join(dir, 'winrt', 'Windows.Media.Control.h'))) {
      process.stdout.write(dir.replace(/\\/g, '/'));
      process.exit(0);
    }
  }
}

process.stderr.write('tally: no Windows SDK with C++/WinRT headers found\n');
process.exit(1);
