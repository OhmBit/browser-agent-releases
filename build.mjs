// build.mjs — Build static updates.ohmbit.com from release artifacts.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, 'build');

// Clean and recreate target directory
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

// Copy state files
for (const file of ['version.json', 'store-config.json']) {
  const src = resolve(__dirname, file);
  if (existsSync(src)) cpSync(src, resolve(target, file));
}

// Copy all artifact files (ZIPs and store CRX/XPIs)
const artifactPattern =
  /^browser-agent-\d+\.\d+\.\d+(-(chromium|firefox)\.zip|-(chrome|edge|firefox)\.(crx|xpi))$/;

for (const entry of readdirSync(__dirname)) {
  if (artifactPattern.test(entry)) {
    cpSync(resolve(__dirname, entry), resolve(target, entry));
  }
}

// Load configuration
let currentVersion = null;
const versionPath = resolve(__dirname, 'version.json');
if (existsSync(versionPath)) {
  currentVersion = JSON.parse(readFileSync(versionPath, 'utf-8'));
}
const storeConfig = existsSync(resolve(__dirname, 'store-config.json'))
  ? JSON.parse(readFileSync(resolve(__dirname, 'store-config.json'), 'utf-8'))
  : {};

const escapeHtml = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Extract semver version from artifact filename (e.g. "browser-agent-0.1.3-chrome.crx" → "0.1.3"). */
const extractVersion = (filename) => {
  const m = filename.match(/^browser-agent-(\d+\.\d+\.\d+)-/);
  return m ? m[1] : '';
};

if (!currentVersion) {
  writeFileSync(
    resolve(target, 'index.html'),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OhmBit Browser Agent</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.5rem; }
    footer { margin-top: 2rem; font-size: 0.875rem; color: #9ca3af; }
  </style>
</head>
<body>
  <h1>OhmBit Browser Agent</h1>
  <p>No versions published yet.</p>
  <footer>OhmBit</footer>
</body>
</html>`,
  );
  console.log('Built updates.ohmbit.com static files');
  process.exit(0);
}

const ver = currentVersion.version;
const allFiles = readdirSync(__dirname);

// Build store download section with listing URLs and CRX/XPI downloads
const storeEntries = [];

if (storeConfig.chromeWebStoreId) {
  const crxFile = allFiles.find(
    (f) => f.startsWith('browser-agent-') && f.endsWith('-chrome.crx'),
  );
  if (crxFile) {
    storeEntries.push({
      label: 'Chrome Web Store',
      version: extractVersion(crxFile),
      url: `https://chromewebstore.google.com/detail/${storeConfig.chromeWebStoreId}`,
      file: `/${encodeURIComponent(crxFile)}`,
    });
  }
}

if (storeConfig.edgeAddonsId) {
  const crxFile = allFiles.find(
    (f) => f.startsWith('browser-agent-') && f.endsWith('-edge.crx'),
  );
  if (crxFile) {
    storeEntries.push({
      label: 'Edge Add-ons',
      version: extractVersion(crxFile),
      url: `https://microsoftedge.microsoft.com/addons/detail/${storeConfig.edgeAddonsId}`,
      file: `/${encodeURIComponent(crxFile)}`,
    });
  }
}

if (storeConfig.firefoxAmoId) {
  const xpiFile = allFiles.find(
    (f) => f.startsWith('browser-agent-') && f.endsWith('-firefox.xpi'),
  );
  if (xpiFile) {
    storeEntries.push({
      label: 'Firefox AMO',
      version: extractVersion(xpiFile),
      url: `https://addons.mozilla.org/addon/${storeConfig.firefoxAmoId}/`,
      file: `/${encodeURIComponent(xpiFile)}`,
    });
  }
}

const storeHtml = storeEntries
  .map(
    (e) => `    <li>
      <strong>${escapeHtml(e.label)}</strong>
      <span class="version">v${escapeHtml(e.version)}</span>
      <a href="${escapeHtml(e.url)}">Store Page</a>
      <a href="${e.file}">Download</a>
    </li>`,
  )
  .join('\n');

// Build developer download section
const devFiles = allFiles.filter(
  (f) =>
    f.startsWith(`browser-agent-${ver}-`) && f.endsWith('.zip'),
);

const devHtml = devFiles
  .map((f) => {
    const isChromium = f.includes('chromium');
    const label = isChromium
      ? `<strong>Chromium</strong><small>Chrome / Edge</small>`
      : '<strong>Firefox</strong>';
    return `    <li>
      <span class="browser-label">${label}</span>
      <a href="/${encodeURIComponent(f)}">Download .zip</a>
    </li>`;
  })
  .join('\n');

writeFileSync(
  resolve(target, 'index.html'),
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OhmBit Browser Agent</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.2rem; margin-top: 1.5rem; }
    a { color: #2563eb; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.75rem 0; border-bottom: 1px solid #e5e7eb; display: flex; gap: 1rem; align-items: center; }
    .browser-label { display: flex; flex-direction: column; min-width: 5rem; }
    .browser-label small { color: #6b7280; font-size: 0.75rem; font-weight: normal; }
    .version { color: #6b7280; font-size: 0.875rem; margin-left: 0.5rem; }
    footer { margin-top: 2rem; font-size: 0.875rem; color: #9ca3af; }
  </style>
</head>
<body>
  <h1>OhmBit Browser Agent</h1>
${storeHtml ? `  <h2>Store Downloads</h2>\n  <ul>\n${storeHtml}\n  </ul>` : ''}
  <h2>Developer Downloads <span class="version">v${escapeHtml(ver)}</span></h2>
  <ul>
${devHtml || '    <li>No downloads available yet.</li>'}
  </ul>
  <p><a href="/version.json">Version Info (JSON)</a></p>
  <footer>OhmBit</footer>
</body>
</html>`,
);

// eslint-disable-next-line no-undef
console.log('Built updates.ohmbit.com static files');
