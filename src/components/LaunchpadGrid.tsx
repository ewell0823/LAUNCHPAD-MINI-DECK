'use client';

import { useState, useRef } from 'react';
import { ButtonConfig, GRID_ROWS, GRID_COLS, noteForCell, isRoundButton } from '@/lib/types';
import { lpColorToCSS, isColorOff } from '@/lib/colors';

// Returns true if the LED color is bright enough to need dark text
function needsDarkText(r: number, g: number, b: number): boolean {
  // Convert from 0-127 to 0-255, then compute relative luminance
  const luminance = (r * 2 * 0.299 + g * 2 * 0.587 + b * 2 * 0.114);
  return luminance > 140;
}

interface LaunchpadGridProps {
  buttons: Record<string, ButtonConfig>;
  selectedNote: number | null;
  pressedNotes: Set<number>;
  onSelectNote: (note: number) => void;
  onSwapButtons: (fromNote: number, toNote: number) => void;
}

export default function LaunchpadGrid({
  buttons,
  selectedNote,
  pressedNotes,
  onSelectNote,
  onSwapButtons,
}: LaunchpadGridProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragStarted = useRef(false);

  return (
    <div className="launchpad-body">
      <div className="pad-grid">
        {Array.from({ length: GRID_ROWS }, (_, row) =>
          Array.from({ length: GRID_COLS }, (_, col) => {
            const note = noteForCell(row, col);
            const config = buttons[String(note)];
            const isSelected = selectedNote === note;
            const isPressed = pressedNotes.has(note);
            const isRound = isRoundButton(row, col);
            const hasAction = config?.action?.type !== 'none';
            const color = config?.color || { r: 0, g: 0, b: 0 };
            const colorOff = isColorOff(color.r, color.g, color.b);
            const isDragSource = dragFrom === note;
            const isDragTarget = dragOver === note && dragFrom !== note;

            const bgColor = colorOff
              ? 'rgba(255, 255, 255, 0.06)'
              : lpColorToCSS(color.r, color.g, color.b);

            const classes = [
              'pad-button',
              isRound ? 'round' : 'square',
              isSelected ? 'selected' : '',
              isPressed ? 'pressed' : '',
              hasAction ? 'has-action' : '',
              isDragSource ? 'drag-source' : '',
              isDragTarget ? 'drag-target' : '',
            ].filter(Boolean).join(' ');

            return (
              <button
                key={note}
                className={classes}
                draggable={hasAction}
                onClick={() => {
                  if (dragStarted.current) {
                    dragStarted.current = false;
                    return;
                  }
                  onSelectNote(note);
                }}
                onDragStart={(e) => {
                  dragStarted.current = true;
                  setDragFrom(note);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(note));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOver(note);
                }}
                onDragLeave={() => {
                  setDragOver(prev => prev === note ? null : prev);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromNote = Number(e.dataTransfer.getData('text/plain'));
                  if (fromNote && fromNote !== note) {
                    onSwapButtons(fromNote, note);
                  }
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                  setTimeout(() => { dragStarted.current = false; }, 0);
                }}
                title={`Note ${note}${config?.label ? `: ${config.label}` : ''}`}
              >
                <div
                  className="pad-inner"
                  style={{
                    backgroundColor: bgColor,
                    color: !colorOff && needsDarkText(color.r, color.g, color.b)
                      ? 'rgba(0, 0, 0, 0.7)'
                      : 'rgba(255, 255, 255, 0.85)',
                    textShadow: !colorOff && needsDarkText(color.r, color.g, color.b)
                      ? '0 1px 2px rgba(255, 255, 255, 0.2)'
                      : '0 1px 3px rgba(0, 0, 0, 0.8)',
                  }}
                >
                  {config?.label || ''}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
