export interface PresetColor {
  r: number; // 0-127
  g: number;
  b: number;
  name: string;
}

export const PRESET_COLORS: PresetColor[] = [
  { r: 0, g: 0, b: 0, name: 'Off' },
  { r: 127, g: 12, b: 0, name: 'Red' },
  { r: 127, g: 48, b: 0, name: 'Orange' },
  { r: 127, g: 96, b: 0, name: 'Amber' },
  { r: 127, g: 127, b: 0, name: 'Yellow' },
  { r: 64, g: 127, b: 0, name: 'Lime' },
  { r: 0, g: 127, b: 0, name: 'Green' },
  { r: 0, g: 127, b: 64, name: 'Mint' },
  { r: 0, g: 127, b: 127, name: 'Cyan' },
  { r: 0, g: 64, b: 127, name: 'Sky' },
  { r: 0, g: 0, b: 127, name: 'Blue' },
  { r: 64, g: 0, b: 127, name: 'Indigo' },
  { r: 127, g: 0, b: 127, name: 'Purple' },
  { r: 127, g: 0, b: 64, name: 'Pink' },
  { r: 127, g: 64, b: 96, name: 'Rose' },
  { r: 127, g: 127, b: 127, name: 'White' },
  { r: 40, g: 40, b: 40, name: 'Dim' },
  { r: 80, g: 80, b: 80, name: 'Gray' },
];

// Convert Launchpad color (0-127) to CSS rgb string
export function lpColorToCSS(r: number, g: number, b: number): string {
  return `rgb(${Math.min(255, Math.round(r * 2))}, ${Math.min(255, Math.round(g * 2))}, ${Math.min(255, Math.round(b * 2))})`;
}

// Check if a color is "off" (black/dark)
export function isColorOff(r: number, g: number, b: number): boolean {
  return r <= 2 && g <= 2 && b <= 2;
}
