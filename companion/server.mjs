import http from 'node:http';
import { exec } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

const PORT = parseInt(process.env.COMPANION_PORT || '19191', 10);

// --- Key code mappings (from src/app/api/execute/route.ts) ---

const SPECIAL_KEY_CODES = {
  enter: 36, return: 36, tab: 48, space: 49, backspace: 51, delete: 117,
  escape: 53, arrowleft: 123, arrowright: 124, arrowdown: 125, arrowup: 126,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100,
  f9: 101, f10: 109, f11: 103, f12: 111, home: 115, end: 119,
  pageup: 116, pagedown: 121,
};

const MODIFIER_MAP = {
  meta: 'command down', command: 'command down', cmd: 'command down',
  control: 'control down', ctrl: 'control down',
  alt: 'option down', option: 'option down',
  shift: 'shift down',
};

// --- Action executors ---

function executeShortcut(keys) {
  return new Promise((resolve, reject) => {
    const modifiers = [];
    let mainKey = '';
    for (const key of keys) {
      const modifier = MODIFIER_MAP[key.toLowerCase()];
      if (modifier) {
        modifiers.push(modifier);
      } else {
        mainKey = key;
      }
    }
    const modifierStr = modifiers.length > 0
      ? ` using {${modifiers.join(', ')}}`
      : '';
    const keyCode = SPECIAL_KEY_CODES[mainKey.toLowerCase()];
    let script;
    if (keyCode !== undefined) {
      script = `tell application "System Events" to key code ${keyCode}${modifierStr}`;
    } else if (mainKey.length === 1) {
      script = `tell application "System Events" to keystroke "${mainKey}"${modifierStr}`;
    } else {
      reject(new Error(`Unknown key: ${mainKey}`));
      return;
    }
    exec(`osascript -e '${script}'`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function launchApp(appPath) {
  return new Promise((resolve, reject) => {
    exec(`open "${appPath}"`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function openUrl(url) {
  return new Promise((resolve, reject) => {
    exec(`open "${url}"`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// --- Apps scanning (from src/app/api/apps/route.ts) ---

async function scanDirectory(dir) {
  const apps = [];
  if (!existsSync(dir)) return apps;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name.endsWith('.app')) {
        apps.push({ name: entry.name.replace('.app', ''), path: fullPath });
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        try {
          const subEntries = await readdir(fullPath, { withFileTypes: true });
          for (const subEntry of subEntries) {
            if (subEntry.name.endsWith('.app')) {
              apps.push({ name: subEntry.name.replace('.app', ''), path: path.join(fullPath, subEntry.name) });
            }
          }
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }
  return apps;
}

async function getApps() {
  const dirs = ['/Applications', '/System/Applications', path.join(homedir(), 'Applications')];
  const results = await Promise.all(dirs.map(scanDirectory));
  const apps = results.flat().sort((a, b) => a.name.localeCompare(b.name));
  const seen = new Set();
  return apps.filter(app => {
    if (seen.has(app.name)) return false;
    seen.add(app.name);
    return true;
  });
}

// --- HTTP helpers ---

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// --- Server ---

const server = http.createServer(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /health
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  // GET /apps
  if (req.method === 'GET' && url.pathname === '/apps') {
    try {
      const apps = await getApps();
      sendJson(res, 200, { apps });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  // POST /execute
  if (req.method === 'POST' && url.pathname === '/execute') {
    try {
      const { action } = await parseJsonBody(req);
      switch (action.type) {
        case 'shortcut':
          await executeShortcut(action.keys);
          break;
        case 'app_launch':
          await launchApp(action.appPath);
          break;
        case 'run_command':
          await runCommand(action.command);
          break;
        case 'open_url':
          await openUrl(action.url);
          break;
        case 'none':
          break;
      }
      sendJson(res, 200, { success: true });
    } catch (error) {
      console.error('[execute]', error.message);
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Companion] Port ${PORT} is already in use. Set COMPANION_PORT env variable to use a different port.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Companion] Launchpad companion server running on http://127.0.0.1:${PORT}`);
  console.log(`[Companion] Endpoints:`);
  console.log(`  GET  /health  - Health check`);
  console.log(`  GET  /apps    - List installed macOS apps`);
  console.log(`  POST /execute - Execute actions`);
  console.log(`[Companion] Press Ctrl+C to stop`);
});
