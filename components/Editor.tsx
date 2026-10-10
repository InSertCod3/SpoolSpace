"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import Controls from "@/components/Controls";
import Timeline from "@/components/Timeline";
import { useFilmstrip } from "@/components/useFilmstrip";
import { convertVideo, formatBytes, type ConvertResult } from "@/lib/convert";
import { getFormat } from "@/lib/formats";
import { DEFAULT_SETTINGS, outputSeconds, type Settings } from "@/lib/pipeline";
import { getTemplate } from "@/lib/templates";

type Status = "idle" | "loading" | "rendering" | "done" | "error";

const round1 = (n: number) => Math.round(n * 10) / 10;

export default function Editor({ file, onReplace }: { file: File; onReplace: () => void }) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [view, setView] = useState<"source" | "result">("source");
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [previewFailed, setPreviewFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const metaDone = useRef(false);

  const template = getTemplate(settings.templateId);
  const format = getFormat(settings.format);
  const busy = status === "loading" || status === "rendering";
  const end = round1(settings.start + settings.length);
  const outSeconds = outputSeconds(settings);
  const isEntire = duration > 0 && settings.start === 0 && Math.abs(settings.length - round1(duration)) < 0.05;
  const preview = template.preview?.(settings.values) ?? {};
  const frames = useFilmstrip(sourceUrl, duration);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  // Preview the speed live.
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = Math.min(16, settings.speed);
  }, [settings.speed, sourceUrl, view]);

  // Jump to the start of the clip whenever the trim changes.
  useEffect(() => {
    const v = videoRef.current;
    if (v && v.readyState > 0) v.currentTime = settings.start;
    setCurrent(settings.start);
  }, [settings.start, settings.length]);

  // Keep the preview inside the clip and keep the playhead moving.
  useEffect(() => {
    if (!playing || view !== "source") return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        if (v.currentTime >= end || v.currentTime < settings.start - 0.3) v.currentTime = settings.start;
        setCurrent(v.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, view, end, settings.start]);

  const patch = useCallback((next: Partial<Settings>) => setSettings((s) => ({ ...s, ...next })), []);
  const setRange = useCallback(
    (start: number, endTime: number) => setSettings((s) => ({ ...s, start, length: round1(endTime - start) })),
    [],
  );

  const onMetadata = () => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    setDuration(v.duration);
    if (!metaDone.current) {
      // First load: start with the first 10 seconds selected.
      metaDone.current = true;
      setSettings((s) => ({ ...s, start: 0, length: round1(Math.min(10, v.duration)) }));
    } else {
      // The video was re-mounted (switching back from the result): keep the trim.
      v.currentTime = settings.start;
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = t;
    setCurrent(t);
  };

  const run = async () => {
    if (busy) return;
    setError(null);
    setStatus("loading");
    setProgress(0);
    try {
      const out = await convertVideo(file, settings, (p) => {
        setStatus("rendering");
        setProgress(p);
      });
      setResult(out);
      setView("result");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while exporting.");
      setStatus("error");
    }
  };

  const downloadName = useMemo(() => {
    const base = file.name.replace(/\.[^.]+$/, "");
    return `${base}-${settings.templateId}-${settings.speed}x.${format.ext}`;
  }, [file, settings.templateId, settings.speed, format.ext]);

  const showResult = view === "result" && result;
  const summary = `${round1(outSeconds)} s loop · ${settings.width} px · ${settings.fps} fps`;

  return (
    <main className="animate-step-in flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-3 px-4 sm:px-6">
        <button type="button" onClick={onReplace} disabled={busy} aria-label="Back to choose another video" className="rounded-full disabled:opacity-50">
          <Logo className="text-xl" />
        </button>
        <div className="ml-2 flex min-w-0 flex-1 items-center gap-3 text-sm text-mute">
          <span className="max-w-[28ch] truncate font-semibold text-ink">{file.name}</span>
          {duration > 0 && <span className="hidden tabular-nums sm:inline">{round1(duration)} s</span>}
          <button
            type="button"
            onClick={onReplace}
            disabled={busy}
            className="font-semibold text-ink underline underline-offset-4 disabled:opacity-50"
          >
            Replace
          </button>
        </div>
        <p className="hidden text-sm text-mute tabular-nums md:block">{summary}</p>
        <button
          type="button"
          onClick={run}
          disabled={busy || (duration === 0 && !previewFailed)}
          className="relative overflow-hidden rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-paper transition-transform enabled:hover:scale-[1.03] disabled:bg-ink/30"
        >
          {busy && (
            <span
              className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          )}
          <span className="relative">
            {busy ? "Exporting…" : result && status === "done" ? `Export ${format.label} again` : `Export ${format.label}`}
          </span>
        </button>
      </header>

      {error && (
        <p role="alert" className="mx-4 mb-2 shrink-0 whitespace-pre-line rounded-2xl border border-danger/25 bg-danger/5 px-4 py-2.5 text-sm font-semibold text-danger sm:mx-6">
          {error}
        </p>
      )}

      {/* Workspace */}
      <div className="grid min-h-0 flex-1 gap-4 px-4 pb-4 sm:px-6 sm:pb-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)]">
        {/* Stage */}
        <div className="relative aspect-video min-h-0 overflow-hidden rounded-[28px] bg-black shadow-lift lg:aspect-auto lg:h-full">
          {sourceUrl && !showResult && (
            <>
              <video
                ref={videoRef}
                src={sourceUrl}
                muted
                autoPlay
                playsInline
                onLoadedMetadata={onMetadata}
                onError={() => setPreviewFailed(true)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                  seek(settings.start);
                  void videoRef.current?.play().catch(() => {});
                }}
                style={{ filter: preview.filter }}
                className="absolute inset-0 size-full object-contain"
              />
              {preview.grain ? (
                <div
                  aria-hidden="true"
                  className="grain-layer animate-grain-shift pointer-events-none absolute inset-0"
                  style={{ opacity: preview.grain }}
                />
              ) : null}
              {previewFailed && duration === 0 && (
                <div role="status" className="absolute inset-0 grid place-items-center p-6 text-center text-white">
                  <div className="grid max-w-sm gap-2">
                    <p className="font-display text-2xl font-bold">Your browser can't preview this video</p>
                    <p className="text-white/75">
                      It uses a format this browser can't play, like HEVC. Spool can still convert it, using the first 10 seconds. Adjust the look and speed, then export.
                    </p>
                  </div>
                </div>
              )}
              {duration > 0 && (
                <Timeline
                  duration={duration}
                  start={settings.start}
                  end={end}
                  current={current}
                  playing={playing}
                  disabled={busy}
                  frames={frames}
                  isEntire={isEntire}
                  onToggle={togglePlay}
                  onRange={setRange}
                  onSeek={seek}
                  onEntire={() => setRange(0, round1(duration))}
                />
              )}
              <div className="pointer-events-none absolute top-4 left-4 flex gap-2">
                <span className="rounded-full bg-paper/95 px-3 py-1 text-sm font-semibold shadow-sm">{template.name}</span>
                <span className="rounded-full bg-pop px-3 py-1 text-sm font-bold tabular-nums shadow-sm">{settings.speed}×</span>
              </div>
            </>
          )}

          {showResult &&
            (format.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.url} alt="Your exported loop" className="absolute inset-0 size-full object-contain" />
            ) : (
              <video
                src={result.url}
                autoPlay
                loop
                muted
                playsInline
                controls
                className="absolute inset-0 size-full object-contain pb-16"
              />
            ))}

          {result && (
            <div className="absolute top-4 right-4 z-30 flex rounded-full bg-paper/95 p-1 text-sm font-semibold shadow-sm">
              {(["source", "result"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3.5 py-1 ${view === v ? "bg-ink text-paper" : "text-mute hover:text-ink"}`}
                >
                  {v === "source" ? "Original" : "Result"}
                </button>
              ))}
            </div>
          )}

          {showResult && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-black/90 to-transparent px-5 pt-14 pb-5 text-white">
              <p className="text-sm font-medium">
                <span className="font-bold">{format.label}</span> · {formatBytes(result.bytes)} · {settings.width} px ·{" "}
                {round1(outSeconds)} s · made in {round1(result.elapsedMs / 1000)} s
              </p>
              <a
                href={result.url}
                download={downloadName}
                className="rounded-full bg-pop px-5 py-2.5 font-bold text-ink transition-transform hover:scale-[1.03]"
              >
                Download {format.label}
              </a>
            </div>
          )}

          {busy && (
            <div role="status" aria-live="polite" className="absolute inset-0 z-40 grid place-items-center bg-black/45 backdrop-blur-sm">
              <div className="grid w-[min(320px,80%)] gap-3 rounded-3xl bg-paper p-5 shadow-lift">
                <p className="font-display text-lg font-bold">
                  {status === "loading" ? "Warming up the converter" : `Exporting ${format.label}`}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-wash">
                  <div
                    className="h-full rounded-full bg-pop transition-[width] duration-300"
                    style={{ width: `${Math.max(5, progress * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-mute tabular-nums">
                  {status === "loading" ? "First run takes a few seconds." : `${Math.round(progress * 100)}%`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside className="flex min-h-0 flex-col rounded-[28px] border border-line bg-paper p-5 shadow-card">
          <Controls settings={settings} disabled={busy} onChange={patch} />
        </aside>
      </div>
    </main>
  );
}
