'use client';

import { useState, useCallback } from 'react';
import type { ButtonConfig, Action } from '@/lib/types';
import { displayKey } from '@/lib/types';
import { PRESET_COLORS, lpColorToCSS, isColorOff } from '@/lib/colors';

interface ActionEditorProps {
  note: number;
  config: ButtonConfig;
  onChange: (config: ButtonConfig) => void;
  onTest: () => void;
}

interface AppInfo {
  name: string;
  path: string;
}

const MODIFIER_OPTIONS = [
  { key: 'meta', label: '⌘ Cmd' },
  { key: 'control', label: '⌃ Ctrl' },
  { key: 'alt', label: '⌥ Opt' },
  { key: 'shift', label: '⇧ Shift' },
] as const;

const KEY_OPTIONS = [
  { group: 'Letters', keys: 'abcdefghijklmnopqrstuvwxyz'.split('') },
  { group: 'Numbers', keys: '0123456789'.split('') },
  { group: 'F-Keys', keys: Array.from({ length: 12 }, (_, i) => `f${i + 1}`) },
  { group: 'Navigation', keys: ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'home', 'end', 'pageup', 'pagedown'] },
  { group: 'Special', keys: ['enter', 'tab', 'space', 'escape', 'backspace', 'delete'] },
  { group: 'Symbols', keys: ['-', '=', '[', ']', '\\', ';', "'", ',', '.', '/', '`'] },
];

function ShortcutBuilder({
  keys,
  onChange,
}: {
  keys: string[];
  onChange: (keys: string[]) => void;
}) {
  const modifiers = keys.filter(k => MODIFIER_OPTIONS.some(m => m.key === k));
  const mainKey = keys.find(k => !MODIFIER_OPTIONS.some(m => m.key === k)) || '';

  const toggleModifier = (mod: string) => {
    const newModifiers = modifiers.includes(mod)
      ? modifiers.filter(m => m !== mod)
      : [...modifiers, mod];
    onChange([...newModifiers, ...(mainKey ? [mainKey] : [])]);
  };

  const setMainKey = (key: string) => {
    onChange([...modifiers, ...(key ? [key] : [])]);
  };

  return (
    <div>
      {/* Preview */}
      {keys.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {keys.map((key, i) => (
            <span key={i} className="key-badge">{displayKey(key)}</span>
          ))}
        </div>
      )}

      {/* Modifier toggles */}
      <div className="editor-label">Modifiers</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {MODIFIER_OPTIONS.map(mod => (
          <button
            key={mod.key}
            className={`btn btn-sm ${modifiers.includes(mod.key) ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => toggleModifier(mod.key)}
          >
            {mod.label}
          </button>
        ))}
      </div>

      {/* Key select */}
      <div className="editor-label">Key</div>
      <select
        className="editor-select"
        value={mainKey}
        onChange={e => setMainKey(e.target.value)}
      >
        <option value="">-- Select key --</option>
        {KEY_OPTIONS.map(group => (
          <optgroup key={group.group} label={group.group}>
            {group.keys.map(k => (
              <option key={k} value={k}>{displayKey(k)}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Clear */}
      {keys.length > 0 && (
        <button
          className="btn btn-sm btn-ghost mt-2"
          onClick={() => onChange([])}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function AppSelector({
  appPath,
  appName,
  onChange,
}: {
  appPath: string;
  appName: string;
  onChange: (path: string, name: string) => void;
}) {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadApps = useCallback(async () => {
    if (apps.length > 0) {
      setShowList(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/apps');
      const data = await res.json();
      setApps(data.apps || []);
      setShowList(true);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [apps.length]);

  const filtered = apps.filter(app =>
    app.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {appName && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {appName}
          </span>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => onChange('', '')}
          >
            Clear
          </button>
        </div>
      )}
      <button
        className="btn btn-sm btn-secondary mb-2"
        onClick={loadApps}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Browse Apps'}
      </button>
      {showList && (
        <div>
          <input
            type="text"
            className="editor-input mb-2"
            placeholder="Search apps..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="app-list">
            {filtered.slice(0, 50).map(app => (
              <div
                key={app.path}
                className={`app-item ${app.path === appPath ? 'selected' : ''}`}
                onClick={() => {
                  onChange(app.path, app.name);
                  setShowList(false);
                  setSearch('');
                }}
              >
                {app.name}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="app-item" style={{ color: 'var(--text-muted)' }}>
                No apps found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActionEditor({ note, config, onChange, onTest }: ActionEditorProps) {
  const updateAction = (action: Action) => {
    onChange({ ...config, action });
  };

  const updateColor = (r: number, g: number, b: number) => {
    onChange({ ...config, color: { r, g, b } });
  };

  const updateLabel = (label: string) => {
    onChange({ ...config, label });
  };

  return (
    <div className="editor-panel">
      {/* Header */}
      <div className="editor-section" style={{ background: 'var(--bg-elevated)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Button Settings
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Note {note}
            </p>
          </div>
          <div
            className="w-8 h-8 rounded-lg border"
            style={{
              backgroundColor: isColorOff(config.color.r, config.color.g, config.color.b)
                ? 'rgba(255,255,255,0.06)'
                : lpColorToCSS(config.color.r, config.color.g, config.color.b),
              borderColor: 'var(--border)',
            }}
          />
        </div>
      </div>

      {/* Label */}
      <div className="editor-section">
        <div className="editor-label">Label</div>
        <input
          type="text"
          className="editor-input"
          value={config.label}
          onChange={e => updateLabel(e.target.value)}
          placeholder="Button label"
          maxLength={8}
        />
      </div>

      {/* Action Type */}
      <div className="editor-section">
        <div className="editor-label">Action</div>
        <select
          className="editor-select mb-3"
          value={config.action.type}
          onChange={e => {
            const type = e.target.value as Action['type'];
            switch (type) {
              case 'none':
                updateAction({ type: 'none' });
                break;
              case 'shortcut':
                updateAction({ type: 'shortcut', keys: [] });
                break;
              case 'app_launch':
                updateAction({ type: 'app_launch', appPath: '', appName: '' });
                break;
              case 'run_command':
                updateAction({ type: 'run_command', command: '' });
                break;
              case 'open_url':
                updateAction({ type: 'open_url', url: '' });
                break;
            }
          }}
        >
          <option value="none">None</option>
          <option value="shortcut">Keyboard Shortcut</option>
          <option value="app_launch">Launch App</option>
          <option value="open_url">Open URL</option>
          <option value="run_command">Run Command</option>
        </select>

        {/* Test button */}
        {config.action.type !== 'none' && (
          <button
            className="btn btn-sm btn-primary mb-3 w-full"
            onClick={onTest}
          >
            Test Action
          </button>
        )}

        {/* Action-specific fields */}
        {config.action.type === 'shortcut' && (
          <ShortcutBuilder
            keys={config.action.keys}
            onChange={keys => updateAction({ type: 'shortcut', keys })}
          />
        )}

        {config.action.type === 'app_launch' && (
          <AppSelector
            appPath={config.action.appPath}
            appName={config.action.appName}
            onChange={(appPath, appName) =>
              updateAction({ type: 'app_launch', appPath, appName })
            }
          />
        )}

        {config.action.type === 'open_url' && (
          <div>
            <input
              type="url"
              className="editor-input"
              value={config.action.url}
              onChange={e =>
                updateAction({ type: 'open_url', url: e.target.value })
              }
              placeholder="https://example.com"
            />
          </div>
        )}

        {config.action.type === 'run_command' && (
          <div>
            <textarea
              className="editor-input"
              value={config.action.command}
              onChange={e =>
                updateAction({ type: 'run_command', command: e.target.value })
              }
              placeholder="e.g. open -a Terminal"
              rows={3}
              style={{ resize: 'vertical', fontFamily: 'var(--font-mono), monospace', fontSize: '12px' }}
            />
          </div>
        )}
      </div>

      {/* LED Color */}
      <div className="editor-section">
        <div className="editor-label">LED Color</div>
        <div className="color-grid">
          {PRESET_COLORS.map((preset, i) => {
            const isSelected =
              config.color.r === preset.r &&
              config.color.g === preset.g &&
              config.color.b === preset.b;
            const bg = isColorOff(preset.r, preset.g, preset.b)
              ? 'rgba(255, 255, 255, 0.06)'
              : lpColorToCSS(preset.r, preset.g, preset.b);

            return (
              <button
                key={i}
                className={`color-swatch ${isSelected ? 'selected' : ''}`}
                style={{ backgroundColor: bg }}
                onClick={() => updateColor(preset.r, preset.g, preset.b)}
                title={preset.name}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
