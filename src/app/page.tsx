'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLaunchpad } from '@/hooks/useLaunchpad';
import LaunchpadGrid from '@/components/LaunchpadGrid';
import ActionEditor from '@/components/ActionEditor';
import {
  type LaunchpadConfig,
  type ButtonConfig,
  createDefaultConfig,
  createDefaultButton,
  noteForCell,
  GRID_ROWS,
  GRID_COLS,
} from '@/lib/types';

const STORAGE_KEY = 'launchpad-editor-config';

function loadConfigFromStorage(): LaunchpadConfig {
  if (typeof window === 'undefined') return createDefaultConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LaunchpadConfig;
      if (parsed.buttons) return parsed;
    }
  } catch {
    // ignore
  }
  return createDefaultConfig();
}

function saveConfigToStorage(config: LaunchpadConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore (quota exceeded, etc.)
  }
}

export default function Home() {
  const [config, setConfig] = useState<LaunchpadConfig>(createDefaultConfig);
  const [selectedNote, setSelectedNote] = useState<number | null>(null);
  const [pressedNotes, setPressedNotes] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const configRef = useRef(config);
  configRef.current = config;

  // Execute the action for a button
  const executeAction = useCallback((note: number) => {
    const buttonConfig = configRef.current.buttons[String(note)];
    if (buttonConfig && buttonConfig.action.type !== 'none') {
      fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: buttonConfig.action }),
      }).catch(() => {
        // API not available (e.g. deployed on Vercel) — ignore
      });
    }
  }, []);

  // Handle MIDI note events
  const handleNoteOn = useCallback((note: number, _velocity: number) => {
    setPressedNotes(prev => new Set(prev).add(note));
    executeAction(note);
  }, [executeAction]);

  const handleNoteOff = useCallback((note: number) => {
    setPressedNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  const launchpad = useLaunchpad({
    onNoteOn: handleNoteOn,
    onNoteOff: handleNoteOff,
  });

  // Load config: localStorage first, fallback to server config for migration
  useEffect(() => {
    const stored = loadConfigFromStorage();
    const hasLocalData = Object.values(stored.buttons).some(b => b.action.type !== 'none');

    if (hasLocalData) {
      setConfig(stored);
      setLoading(false);
      return;
    }

    // localStorage is empty — try migrating from server config
    fetch('/api/config')
      .then(res => {
        if (!res.ok) throw new Error('no server config');
        return res.json();
      })
      .then((data: LaunchpadConfig) => {
        if (data?.buttons) {
          setConfig(data);
          saveConfigToStorage(data);
        }
      })
      .catch(() => {
        // No server config available (e.g. deployed) — use defaults
      })
      .finally(() => setLoading(false));
  }, []);

  // Sync LEDs when config changes and device is connected
  useEffect(() => {
    if (!launchpad.connected) return;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const note = noteForCell(row, col);
        const btn = config.buttons[String(note)];
        if (btn) {
          launchpad.setLED(note, btn.color.r, btn.color.g, btn.color.b);
        }
      }
    }
  }, [config, launchpad.connected, launchpad.setLED]);

  // Save to localStorage
  const saveConfig = useCallback((newConfig: LaunchpadConfig) => {
    saveConfigToStorage(newConfig);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  }, []);

  const handleButtonChange = useCallback((note: number, buttonConfig: ButtonConfig) => {
    setConfig(prev => {
      const next = {
        ...prev,
        buttons: { ...prev.buttons, [String(note)]: buttonConfig },
      };
      saveConfig(next);
      return next;
    });

    // Update LED immediately
    if (launchpad.connected) {
      launchpad.setLED(note, buttonConfig.color.r, buttonConfig.color.g, buttonConfig.color.b);
    }
  }, [launchpad, saveConfig]);

  const handleSwapButtons = useCallback((fromNote: number, toNote: number) => {
    setConfig(prev => {
      const fromConfig = prev.buttons[String(fromNote)] || createDefaultButton();
      const toConfig = prev.buttons[String(toNote)] || createDefaultButton();
      const next = {
        ...prev,
        buttons: {
          ...prev.buttons,
          [String(fromNote)]: toConfig,
          [String(toNote)]: fromConfig,
        },
      };
      saveConfig(next);
      return next;
    });
    setSelectedNote(toNote);
  }, [saveConfig]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'launchpad-config.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [config]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as LaunchpadConfig;
        if (imported.buttons) {
          setConfig(imported);
          saveConfig(imported);
        }
      } catch {
        // Ignore invalid files
      }
    };
    input.click();
  }, [saveConfig]);

  const selectedConfig = selectedNote
    ? config.buttons[String(selectedNote)] || createDefaultButton()
    : null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight">
            LaunchPad Editor
          </h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{
            background: 'var(--accent-dim)',
            color: 'var(--accent-hover)',
          }}>
            Mini MK3
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Save Status */}
          {saveStatus === 'saved' && (
            <span className="text-xs" style={{ color: 'var(--success)' }}>
              Saved
            </span>
          )}

          {/* Import/Export */}
          <div className="flex gap-1">
            <button className="btn btn-sm btn-ghost" onClick={handleImport}>
              Import
            </button>
            <button className="btn btn-sm btn-ghost" onClick={handleExport}>
              Export
            </button>
          </div>

          {/* Connection */}
          <div className="flex items-center gap-2">
            <span className={`status-dot ${
              launchpad.connected ? 'connected' :
              launchpad.connecting ? 'connecting' : 'disconnected'
            }`} />
            {launchpad.connected ? (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {launchpad.deviceName}
                </span>
                <button className="btn btn-sm btn-ghost" onClick={launchpad.disconnect}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                className="btn btn-sm btn-primary"
                onClick={launchpad.connect}
                disabled={launchpad.connecting || !launchpad.supported}
              >
                {launchpad.connecting ? 'Connecting...' :
                  !launchpad.supported ? 'MIDI Not Supported' : 'Connect'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {launchpad.error && (
        <div
          className="px-6 py-2 text-xs"
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}
        >
          {launchpad.error}
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Grid Panel */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div style={{ width: '100%', maxWidth: '540px' }}>
            <LaunchpadGrid
              buttons={config.buttons}
              selectedNote={selectedNote}
              pressedNotes={pressedNotes}
              onSelectNote={setSelectedNote}
              onSwapButtons={handleSwapButtons}
            />
          </div>
        </div>

        {/* Editor Panel */}
        <div
          className="shrink-0 overflow-y-auto p-4"
          style={{
            width: '320px',
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
          }}
        >
          {selectedNote && selectedConfig ? (
            <ActionEditor
              note={selectedNote}
              config={selectedConfig}
              onChange={(newConfig) => handleButtonChange(selectedNote, newConfig)}
              onTest={() => executeAction(selectedNote)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--bg-elevated)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Select a button
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Click a pad on the grid to configure its action
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
