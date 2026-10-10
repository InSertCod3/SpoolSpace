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

type Mode = "start" | "end" | "move" | "seek";

interface Props {
  duration: number;
  start: number;
  end: number;
  current: number;
  playing: boolean;
  disabled?: boolean;
  frames: string[];
  isEntire: boolean;
  onToggle: () => void;
  onRange: (start: number, end: number) => void;
  onSeek: (t: number) => void;
  onEntire: () => void;
}

/**
 * The timeline that sits on the bottom of the video.
 * Drag the yellow handles to trim, drag the middle to slide the clip, click to seek.
 */
export default function Timeline({
  duration,
  start,
  end,
  current,
  playing,
  disabled,
  frames,
  isEntire,
  onToggle,
  onRange,
  onSeek,
  onEntire,
}: Props) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; offset: number; x0: number; t0: number; moved: boolean } | null>(null);

  const timeAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return round1(clamp((clientX - r.left) / r.width, 0, 1) * duration);
  };
  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const role = (e.target as HTMLElement).closest("[data-role]")?.getAttribute("data-role");
    const t = timeAt(e.clientX);
    const mode: Mode = role === "start" || role === "end" ? role : t >= start && t <= end ? "move" : "seek";
    drag.current = { mode, offset: t - start, x0: e.clientX, t0: t, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (mode === "seek") onSeek(clamp(t, start, end));
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || disabled) return;
    const t = timeAt(e.clientX);
    if (Math.abs(e.clientX - d.x0) > 3) d.moved = true;
    if (d.mode === "start") onRange(clamp(t, 0, end - MIN_LENGTH), end);
    else if (d.mode === "end") onRange(start, clamp(t, start + MIN_LENGTH, duration));
    else if (d.mode === "move" && d.moved) {
      const len = end - start;
      const s = round1(clamp(t - d.offset, 0, duration - len));
      onRange(s, round1(s + len));
    } else if (d.mode === "seek") onSeek(clamp(t, start, end));
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    // A click inside the clip (no drag) seeks there.
    if (d && d.mode === "move" && !d.moved) onSeek(clamp(d.t0, start, end));
  };

  const onKey = (which: "start" | "end") => (e: React.KeyboardEvent) => {
    if (disabled) return;
    const step = e.shiftKey ? 1 : 0.1;
    let dir = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") dir = -1;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") dir = 1;
    else return;
    e.preventDefault();
    if (which === "start") onRange(round1(clamp(start + dir * step, 0, end - MIN_LENGTH)), end);
    else onRange(start, round1(clamp(end + dir * step, start + MIN_LENGTH, duration)));
  };

  const handle = (which: "start" | "end") => (
    <div
      data-role={which}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={which === "start" ? "Clip start" : "Clip end"}
      aria-valuemin={which === "start" ? 0 : round1(start + MIN_LENGTH)}
      aria-valuemax={which === "start" ? round1(end - MIN_LENGTH) : round1(duration)}
      aria-valuenow={which === "start" ? start : end}
      aria-valuetext={formatTime(which === "start" ? start : end)}
      onKeyDown={onKey(which)}
      style={{ left: `${pct(which === "start" ? start : end)}%` }}
      className="absolute -top-1.5 -bottom-1.5 z-20 flex w-5 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-md bg-pop shadow-[0_2px_8px_rgb(0_0_0/0.45)] focus-visible:outline-white"
    >
      <span className="h-5 w-0.5 rounded-full bg-ink/70" />
    </div>
  );

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pt-16 pb-4 text-white sm:px-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={playing ? "Pause preview" : "Play preview"}
          className="grid size-10 place-items-center rounded-full bg-white text-ink transition-transform hover:scale-105 disabled:opacity-50"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L3.9 1.1a.6.6 0 0 0-.9.5Z" fill="currentColor" /></svg>
          )}
        </button>
        <p className="min-w-0 flex-1 text-sm font-semibold tabular-nums">
          {formatTime(current)}
          <span className="font-medium text-white/70">
            {" "}· Clip {formatTime(start)} to {formatTime(end)} · {round1(end - start)} s
          </span>
        </p>
        <button
          type="button"
          onClick={onEntire}
          disabled={disabled}
          aria-pressed={isEntire}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
            isEntire ? "bg-pop text-ink" : "bg-white/15 text-white hover:bg-white/25"
          }`}
        >
          Entire video
        </button>
      </div>

      <div className="mx-2.5">
        <div
          ref={track}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={`relative h-14 touch-none select-none rounded-lg bg-white/10 ${disabled ? "opacity-60" : ""}`}
        >
          {/* Filmstrip */}
          <div className="absolute inset-0 flex overflow-hidden rounded-lg">
            {frames.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
            ))}
          </div>

          {/* Everything outside the clip is dimmed */}
          <div className="absolute inset-y-0 left-0 rounded-l-lg bg-black/65" style={{ width: `${pct(start)}%` }} />
          <div className="absolute inset-y-0 right-0 rounded-r-lg bg-black/65" style={{ width: `${100 - pct(end)}%` }} />

          {/* The clip */}
          <div
            data-role="move"
            className="absolute -inset-y-0.5 z-10 cursor-grab border-y-[3px] border-pop active:cursor-grabbing"
            style={{ left: `${pct(start)}%`, width: `${pct(end - start)}%` }}
          />

          {handle("start")}
          {handle("end")}

          {/* Playhead */}
          <div
            className="pointer-events-none absolute -top-2 -bottom-2 z-30 w-0.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgb(0_0_0/0.6)]"
            style={{ left: `${pct(clamp(current, 0, duration))}%` }}
          >
            <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
