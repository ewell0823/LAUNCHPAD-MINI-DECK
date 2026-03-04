import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

interface AppInfo {
  name: string;
  path: string;
}

async function scanDirectory(dir: string): Promise<AppInfo[]> {
  const apps: AppInfo[] = [];
  if (!existsSync(dir)) return apps;

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name.endsWith('.app')) {
        apps.push({
          name: entry.name.replace('.app', ''),
          path: fullPath,
        });
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        // Scan one level deep (e.g., /Applications/Utilities/)
        try {
          const subEntries = await readdir(fullPath, { withFileTypes: true });
          for (const subEntry of subEntries) {
            if (subEntry.name.endsWith('.app')) {
              apps.push({
                name: subEntry.name.replace('.app', ''),
                path: path.join(fullPath, subEntry.name),
              });
            }
          }
        } catch {
          // Skip unreadable directories
        }
      }
    }
  } catch {
    // Skip unreadable directories
  }

  return apps;
}

export async function GET() {
  const dirs = [
    '/Applications',
    '/System/Applications',
    path.join(homedir(), 'Applications'),
  ];

  const results = await Promise.all(dirs.map(scanDirectory));
  const apps = results.flat().sort((a, b) => a.name.localeCompare(b.name));

  // Deduplicate by name
  const seen = new Set<string>();
  const unique = apps.filter(app => {
    if (seen.has(app.name)) return false;
    seen.add(app.name);
    return true;
  });

  return NextResponse.json({ apps: unique });
}
