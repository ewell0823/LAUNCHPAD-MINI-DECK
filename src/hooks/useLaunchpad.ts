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

  const connect = useCallback(async () => {
    setState(s => ({ ...s, connecting: true, error: null }));

    try {
      if (!navigator.requestMIDIAccess) {
        throw new Error('Web MIDI API not supported. Use Chrome or Edge.');
      }

      const midiAccess = await navigator.requestMIDIAccess({ sysex: true });

      // Log all available MIDI ports
      console.log('[MIDI] Available inputs:');
      for (const [id, port] of midiAccess.inputs) {
        console.log(`  - ${id}: "${port.name}" (${port.manufacturer})`);
      }
      console.log('[MIDI] Available outputs:');
      for (const [id, port] of midiAccess.outputs) {
        console.log(`  - ${id}: "${port.name}" (${port.manufacturer})`);
      }

      // Collect ALL matching inputs and outputs
      const matchedInputs: MIDIInput[] = [];
      const matchedOutputs: MIDIOutput[] = [];
      let deviceName: string | null = null;

      for (const [, port] of midiAccess.inputs) {
        if (matchesDevice(port.name)) {
          matchedInputs.push(port);
          if (!deviceName) deviceName = port.name;
          console.log(`[MIDI] Matched input: "${port.name}"`);
        }
      }

      for (const [, port] of midiAccess.outputs) {
        if (matchesDevice(port.name)) {
          matchedOutputs.push(port);
          console.log(`[MIDI] Matched output: "${port.name}"`);
        }
      }

      if (matchedInputs.length === 0 || matchedOutputs.length === 0) {
        throw new Error('Launchpad Mini MK3 not found. Connect the device and retry.');
      }

      inputsRef.current = matchedInputs;
      outputsRef.current = matchedOutputs;

      // Enter Programmer Mode on ALL outputs
      const sysexProgrammerMode = new Uint8Array([...SYSEX_HEADER, 0x0e, 0x01, ...SYSEX_END]);
      for (const output of matchedOutputs) {
        try {
          output.send(sysexProgrammerMode);
          console.log(`[MIDI] Sent programmer mode to: "${output.name}"`);
        } catch (e) {
          console.warn(`[MIDI] Failed to send programmer mode to "${output.name}":`, e);
        }
      }

      // Listen on ALL inputs
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
    } catch (err) {
      setState(s => ({
        ...s,
        connected: false,
        deviceName: null,
        connecting: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      }));
    }
  }, [handleMIDIMessage]);

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
