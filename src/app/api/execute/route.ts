import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import type { Action } from '@/lib/types';

const SPECIAL_KEY_CODES: Record<string, number> = {
  enter: 36,
  return: 36,
  tab: 48,
  space: 49,
  backspace: 51,
  delete: 117,
  escape: 53,
  arrowleft: 123,
  arrowright: 124,
  arrowdown: 125,
  arrowup: 126,
  f1: 122,
  f2: 120,
  f3: 99,
  f4: 118,
  f5: 96,
  f6: 97,
  f7: 98,
  f8: 100,
  f9: 101,
  f10: 109,
  f11: 103,
  f12: 111,
  home: 115,
  end: 119,
  pageup: 116,
  pagedown: 121,
};

const MODIFIER_MAP: Record<string, string> = {
  meta: 'command down',
  command: 'command down',
  cmd: 'command down',
  control: 'control down',
  ctrl: 'control down',
  alt: 'option down',
  option: 'option down',
  shift: 'shift down',
};

function executeShortcut(keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const modifiers: string[] = [];
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
    let script: string;

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

function launchApp(appPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(`open "${appPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('[execute] launchApp error:', error.message, stderr);
        reject(error);
      } else {
        console.log('[execute] launchApp success:', appPath, stdout);
        resolve();
      }
    });
  });
}

function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(`open "${url}"`, (error) => {
      if (error) {
        console.error('[execute] openUrl error:', error.message);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function runCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('[execute] runCommand error:', error.message, stderr);
        reject(error);
      } else {
        console.log('[execute] runCommand success:', stdout);
        resolve();
      }
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body as { action: Action };
    console.log('[execute] Received action:', JSON.stringify(action));

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[execute] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
