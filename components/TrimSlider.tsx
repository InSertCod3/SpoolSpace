"use client";

import { useRef } from "react";

const MIN_LENGTH = 0.5;

export function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface Props {
  duration: number;
  start: number;
  end: number;
  disabled?: boolean;
  onChange: (start: number, end: number) => void;
}

/** Two-handle range slider. Drag either handle, drag the bar to move the whole range, or use the arrow keys. */
export default function TrimSlider({ duration, start, end, disabled, onChange }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const grabOffset = useRef(0);

  const timeAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return round1(clamp((clientX - r.left) / r.width, 0, 1) * duration);
  };

  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);

  const onHandleDown = (which: "start" | "end") => (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    void which;
  };

  const onHandleMove = (which: "start" | "end") => (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const t = timeAt(e.clientX);
    if (which === "start") onChange(clamp(t, 0, end - MIN_LENGTH), end);
    else onChange(start, clamp(t, start + MIN_LENGTH, duration));
  };

  const onBarDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    grabOffset.current = timeAt(e.clientX) - start;
  };

  const onBarMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const len = end - start;
    const s = round1(clamp(timeAt(e.clientX) - grabOffset.current, 0, duration - len));
    onChange(s, round1(s + len));
  };

  const onKey = (which: "start" | "end") => (e: React.KeyboardEvent) => {
    if (disabled) return;
    const step = e.shiftKey ? 1 : 0.1;
    let dir = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") dir = -1;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") dir = 1;
    else return;
    e.preventDefault();
    if (which === "start") onChange(round1(clamp(start + dir * step, 0, end - MIN_LENGTH)), end);
    else onChange(start, round1(clamp(end + dir * step, start + MIN_LENGTH, duration)));
  };

  return (
    <div className={`trim${disabled ? " is-disabled" : ""}`}>
      <div className="trim-track" ref={track}>
        <div
          className="trim-range"
          style={{ left: `${pct(start)}%`, width: `${pct(end - start)}%` }}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          aria-hidden="true"
        />
        <div
          className="trim-handle"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label="Clip start"
          aria-valuemin={0}
          aria-valuemax={round1(end - MIN_LENGTH)}
          aria-valuenow={start}
          aria-valuetext={formatTime(start)}
          style={{ left: `${pct(start)}%` }}
          onPointerDown={onHandleDown("start")}
          onPointerMove={onHandleMove("start")}
          onKeyDown={onKey("start")}
        />
        <div
          className="trim-handle"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label="Clip end"
          aria-valuemin={round1(start + MIN_LENGTH)}
          aria-valuemax={round1(duration)}
          aria-valuenow={end}
          aria-valuetext={formatTime(end)}
          style={{ left: `${pct(end)}%` }}
          onPointerDown={onHandleDown("end")}
          onPointerMove={onHandleMove("end")}
          onKeyDown={onKey("end")}
        />
      </div>
      <div className="trim-scale" aria-hidden="true">
        <span>0:00.0</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
