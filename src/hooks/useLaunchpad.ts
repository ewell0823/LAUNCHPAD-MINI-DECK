'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const SYSEX_HEADER = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x0d];
const SYSEX_END = [0xf7];

const DEVICE_SEARCH_NAMES = [
  'LPMiniMK3',
  'Launchpad Mini MK3',
  'Launchpad X',
  'LPX MIDI',
];

// Module-level singleton: requestMIDIAccess should only be called once per page.
let midiAccessPromise: Promise<MIDIAccess> | null = null;

function getMIDIAccess(): Promise<MIDIAccess> {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
    return Promise.reject(new Error('Web MIDI API not supported. Use Chrome or Edge.'));
  }
  if (!midiAccessPromise) {
    midiAccessPromise = navigator.requestMIDIAccess({ sysex: true });
    midiAccessPromise.catch(() => {
      midiAccessPromise = null;
    });
  }
  return midiAccessPromise;
}

async function isMIDIPermissionGranted(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.permissions) return false;
  try {
    const status = await navigator.permissions.query({
      name: 'midi',
      sysex: true,
    } as unknown as PermissionDescriptor);
    return status.state === 'granted';
  } catch {
    return false;
  }
}

export interface LaunchpadState {
  connected: boolean;
  deviceName: string | null;
  connecting: boolean;
  error: string | null;
  supported: boolean;
}

interface LaunchpadCallbacks {
  onNoteOn?: (note: number, velocity: number) => void;
  onNoteOff?: (note: number) => void;
}

function matchesDevice(portName: string | null): boolean {
  if (!portName) return false;
  return DEVICE_SEARCH_NAMES.some(name => portName.includes(name));
}

export function useLaunchpad(callbacks: LaunchpadCallbacks = {}) {
  const [state, setState] = useState<LaunchpadState>({
    connected: false,
    deviceName: null,
    connecting: false,
    error: null,
    supported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
  });

  const outputsRef = useRef<MIDIOutput[]>([]);
  const inputsRef = useRef<MIDIInput[]>([]);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const accessRef = useRef<MIDIAccess | null>(null);
  const stateChangeListenerRef = useRef<((e: Event) => void) | null>(null);

  const handleMIDIMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 3) return;

    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];

    console.log(`[MIDI IN] status=0x${status.toString(16)} note=${note} vel=${velocity}`);

    if (status === 0x90 && velocity > 0) {
      callbacksRef.current.onNoteOn?.(note, velocity);
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      callbacksRef.current.onNoteOff?.(note);
    } else if (status === 0xb0) {
      // Control Change (top row buttons)
      if (velocity > 0) {
        callbacksRef.current.onNoteOn?.(note, velocity);
      } else {
        callbacksRef.current.onNoteOff?.(note);
      }
    }
  }, []);

  // Find Launchpad ports in the MIDIAccess, send Programmer Mode, attach
  // input handlers. Returns true if a Launchpad was found and attached.
  const attachToPorts = useCallback((midiAccess: MIDIAccess): boolean => {
    const matchedInputs: MIDIInput[] = [];
    const matchedOutputs: MIDIOutput[] = [];
    let deviceName: string | null = null;

    for (const [, port] of midiAccess.inputs) {
      if (matchesDevice(port.name)) {
        matchedInputs.push(port);
        if (!deviceName) deviceName = port.name;
      }
    }
    for (const [, port] of midiAccess.outputs) {
      if (matchesDevice(port.name)) {
        matchedOutputs.push(port);
      }
    }

    if (matchedInputs.length === 0 || matchedOutputs.length === 0) {
      return false;
    }

    // Detach previous handlers — after a sleep/reconnect cycle the port
    // objects we held are dead, so always rebind.
    for (const input of inputsRef.current) {
      input.onmidimessage = null;
    }

    inputsRef.current = matchedInputs;
    outputsRef.current = matchedOutputs;

    const sysexProgrammerMode = new Uint8Array([...SYSEX_HEADER, 0x0e, 0x01, ...SYSEX_END]);
    for (const output of matchedOutputs) {
      try {
        output.send(sysexProgrammerMode);
        console.log(`[MIDI] Sent programmer mode to: "${output.name}"`);
      } catch (e) {
        console.warn(`[MIDI] Failed to send programmer mode to "${output.name}":`, e);
      }
    }

    for (const input of matchedInputs) {
      input.onmidimessage = handleMIDIMessage;
      console.log(`[MIDI] Listening on: "${input.name}"`);
    }

    setState({
      connected: true,
      deviceName: deviceName || 'Launchpad Mini MK3',
      connecting: false,
      error: null,
      supported: true,
    });
    return true;
  }, [handleMIDIMessage]);

  const markDisconnected = useCallback(() => {
    for (const input of inputsRef.current) {
      input.onmidimessage = null;
    }
    inputsRef.current = [];
    outputsRef.current = [];
    setState(s => ({
      ...s,
      connected: false,
      deviceName: null,
      connecting: false,
    }));
  }, []);

  // Wire up MIDIAccess.statechange so the UI auto-reattaches when the
  // Launchpad returns after Mac sleep (or USB replug) and goes offline
  // when it disappears.
  const ensureStateChangeListener = useCallback((midiAccess: MIDIAccess) => {
    if (accessRef.current === midiAccess && stateChangeListenerRef.current) return;

    if (accessRef.current && stateChangeListenerRef.current) {
      accessRef.current.removeEventListener(
        'statechange',
        stateChangeListenerRef.current as EventListener,
      );
    }

    const listener = (e: Event) => {
      const event = e as MIDIConnectionEvent;
      const port = event.port;
      if (!matchesDevice(port?.name ?? null)) return;

      console.log(`[MIDI] statechange: "${port?.name}" -> ${port?.state}`);

      if (port?.state === 'connected') {
        attachToPorts(midiAccess);
      } else if (port?.state === 'disconnected') {
        // Another matching port may still be live; re-scan first.
        if (!attachToPorts(midiAccess)) {
          markDisconnected();
        }
      }
    };

    midiAccess.addEventListener('statechange', listener);
    accessRef.current = midiAccess;
    stateChangeListenerRef.current = listener;
  }, [attachToPorts, markDisconnected]);

  const connect = useCallback(async () => {
    setState(s => ({ ...s, connecting: true, error: null }));

    try {
      const midiAccess = await getMIDIAccess();

      console.log('[MIDI] Available inputs:');
      for (const [id, port] of midiAccess.inputs) {
        console.log(`  - ${id}: "${port.name}" (${port.manufacturer})`);
      }
      console.log('[MIDI] Available outputs:');
      for (const [id, port] of midiAccess.outputs) {
        console.log(`  - ${id}: "${port.name}" (${port.manufacturer})`);
      }

      ensureStateChangeListener(midiAccess);

      if (!attachToPorts(midiAccess)) {
        throw new Error('Launchpad Mini MK3 not found. Connect the device and retry.');
      }
    } catch (err) {
      setState(s => ({
        ...s,
        connected: false,
        deviceName: null,
        connecting: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      }));
    }
  }, [attachToPorts, ensureStateChangeListener]);

  const disconnect = useCallback(() => {
    for (const input of inputsRef.current) {
      input.onmidimessage = null;
    }
    inputsRef.current = [];

    const sysexExitProgrammer = new Uint8Array([...SYSEX_HEADER, 0x0e, 0x00, ...SYSEX_END]);
    for (const output of outputsRef.current) {
      try {
        output.send(sysexExitProgrammer);
      } catch {
        // Device may already be disconnected
      }
    }
    outputsRef.current = [];

    setState(s => ({
      ...s,
      connected: false,
      deviceName: null,
      connecting: false,
      error: null,
    }));
  }, []);

  const setLED = useCallback((note: number, r: number, g: number, b: number) => {
    const msg = new Uint8Array([...SYSEX_HEADER, 0x03, 0x03, note, r, g, b, ...SYSEX_END]);
    for (const output of outputsRef.current) {
      try {
        output.send(msg);
      } catch {
        // Ignore send errors
      }
    }
  }, []);

  const clearAllLEDs = useCallback(() => {
    for (let row = 1; row <= 9; row++) {
      for (let col = 1; col <= 9; col++) {
        const note = row * 10 + col;
        const msg = new Uint8Array([...SYSEX_HEADER, 0x03, 0x03, note, 0, 0, 0, ...SYSEX_END]);
        for (const output of outputsRef.current) {
          try {
            output.send(msg);
          } catch {
            // Ignore
          }
        }
      }
    }
  }, []);

  // Auto-connect on mount when MIDI permission is already granted.
  // First-time users still need to click Connect (the permission prompt
  // requires a user gesture).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const granted = await isMIDIPermissionGranted();
      if (cancelled || !granted) return;

      setState(s => (s.connected ? s : { ...s, connecting: true }));
      try {
        const midiAccess = await getMIDIAccess();
        if (cancelled) return;
        ensureStateChangeListener(midiAccess);
        if (!attachToPorts(midiAccess)) {
          // Permission ok, but Launchpad not currently plugged in.
          // statechange will re-attach when it appears.
          setState(s => ({ ...s, connecting: false }));
        }
      } catch {
        if (!cancelled) {
          setState(s => ({ ...s, connecting: false }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attachToPorts, ensureStateChangeListener]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const input of inputsRef.current) {
        input.onmidimessage = null;
      }
      const sysexExit = new Uint8Array([...SYSEX_HEADER, 0x0e, 0x00, ...SYSEX_END]);
      for (const output of outputsRef.current) {
        try {
          output.send(sysexExit);
        } catch {
          // Ignore
        }
      }
      if (accessRef.current && stateChangeListenerRef.current) {
        accessRef.current.removeEventListener(
          'statechange',
          stateChangeListenerRef.current as EventListener,
        );
        accessRef.current = null;
        stateChangeListenerRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    setLED,
    clearAllLEDs,
  };
}
