import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createDefaultConfig, type LaunchpadConfig } from '@/lib/types';

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

async function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

async function loadConfig(): Promise<LaunchpadConfig> {
  try {
    await ensureConfigDir();
    if (!existsSync(CONFIG_PATH)) {
      const defaultConfig = createDefaultConfig();
      await writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    const data = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data) as LaunchpadConfig;
  } catch {
    return createDefaultConfig();
  }
}

async function saveConfig(config: LaunchpadConfig): Promise<void> {
  await ensureConfigDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function GET() {
  const config = await loadConfig();
  return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
  try {
    const config = (await request.json()) as LaunchpadConfig;
    await saveConfig(config);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Save failed' },
      { status: 500 }
    );
  }
}
