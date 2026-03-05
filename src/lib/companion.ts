import type { Action } from './types';

const COMPANION_URL = 'http://127.0.0.1:19191';

export async function checkCompanion(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${COMPANION_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function companionExecute(action: Action): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${COMPANION_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  return res.json();
}

export async function companionGetApps(): Promise<{ apps: Array<{ name: string; path: string }> }> {
  const res = await fetch(`${COMPANION_URL}/apps`);
  return res.json();
}
