export interface NoneAction {
  type: 'none';
}

export interface ShortcutAction {
  type: 'shortcut';
  keys: string[];
}

export interface AppLaunchAction {
  type: 'app_launch';
  appPath: string;
  appName: string;
}

export interface RunCommandAction {
  type: 'run_command';
  command: string;
}

export interface OpenUrlAction {
  type: 'open_url';
  url: string;
}

export type Action = NoneAction | ShortcutAction | AppLaunchAction | RunCommandAction | OpenUrlAction;

export interface ButtonColor {
  r: number; // 0-127 (Launchpad range)
  g: number;
  b: number;
}

export interface ButtonConfig {
  action: Action;
  color: ButtonColor;
  label: string;
}

export interface LaunchpadConfig {
  buttons: Record<string, ButtonConfig>;
}

export const GRID_ROWS = 9;
export const GRID_COLS = 9;

// Convert grid position (row 0=top, col 0=left) to MIDI note number
export function noteForCell(row: number, col: number): number {
  return (9 - row) * 10 + (col + 1);
}

// Convert MIDI note to grid position
export function cellForNote(note: number): { row: number; col: number } | null {
  const row = 9 - Math.floor(note / 10);
  const col = (note % 10) - 1;
  if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null;
  return { row, col };
}

export function createDefaultButton(): ButtonConfig {
  return {
    action: { type: 'none' },
    color: { r: 0, g: 0, b: 0 },
    label: '',
  };
}

export function createDefaultConfig(): LaunchpadConfig {
  const buttons: Record<string, ButtonConfig> = {};
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const note = noteForCell(row, col);
      buttons[String(note)] = createDefaultButton();
    }
  }
  return { buttons };
}

// Top row and right column buttons are round on the physical device
export function isRoundButton(row: number, col: number): boolean {
  return row === 0 || col === 8;
}

// Display name for modifier/special keys
export const KEY_DISPLAY: Record<string, string> = {
  meta: '⌘',
  command: '⌘',
  control: '⌃',
  ctrl: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧',
  enter: '↩',
  return: '↩',
  tab: '⇥',
  space: '␣',
  escape: 'Esc',
  backspace: '⌫',
  delete: '⌦',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
};

export function displayKey(key: string): string {
  return KEY_DISPLAY[key.toLowerCase()] || key.toUpperCase();
}
