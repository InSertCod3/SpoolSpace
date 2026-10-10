"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Controls from "@/components/Controls";
import Timeline from "@/components/Timeline";
import { useFilmstrip } from "@/components/useFilmstrip";
import { convertVideo, formatBytes, getFFmpeg, type ConvertResult } from "@/lib/convert";
import { getFormat } from "@/lib/formats";
import { DEFAULT_SETTINGS, outputSeconds, type Settings } from "@/lib/pipeline";
import { getTemplate } from "@/lib/templates";

const MAX_FILE_MB = 300;
type Status = "idle" | "loading" | "rendering" | "done" | "error";

const round1 = (n: number) => Math.round(n * 10) / 10;

export default function Studio() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [view, setView] = useState<"source" | "result">("source");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const warmed = useRef(false);

  const template = getTemplate(settings.templateId);
  const format = getFormat(settings.format);
  const busy = status === "loading" || status === "rendering";
  const end = round1(settings.start + settings.length);
  const outSeconds = outputSeconds(settings);
  const isEntire = duration > 0 && settings.start === 0 && Math.abs(settings.length - round1(duration)) < 0.05;
  const preview = template.preview?.(settings.values) ?? {};
  const frames = useFilmstrip(sourceUrl, duration);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
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

  const warmEngine = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    getFFmpeg().catch(() => { warmed.current = false; });
  }, []);

  const acceptFile = useCallback((f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("That file is not a video. Drop an MP4, MOV or WebM.");
      setStatus("error");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That video is over ${MAX_FILE_MB} MB. Trim it first or pick a shorter clip.`);
      setStatus("error");
      return;
    }
    setError(null);
    setStatus("idle");
    setResult(null);
    setView("source");
    setProgress(0);
    setDuration(0);
    setFile(f);
    setSourceUrl(URL.createObjectURL(f));
    warmEngine();
  }, [warmEngine]);

  const useSample = async () => {
    try {
      const res = await fetch("/sample.mp4");
      const blob = await res.blob();
      acceptFile(new File([blob], "sample.mp4", { type: "video/mp4" }));
    } catch {
      setError("Could not load the sample clip. Check your connection and try again.");
      setStatus("error");
    }
  };

  const onMetadata = () => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    setDuration(v.duration);
    setSettings((s) => ({ ...s, start: 0, length: round1(Math.min(10, v.duration)) }));
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
    if (!file || busy) return;
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

  const reset = () => {
    setFile(null);
    setSourceUrl(null);
    setResult(null);
    setStatus("idle");
    setError(null);
    setView("source");
    setDuration(0);
    setPlaying(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadName = useMemo(() => {
    const base = file?.name.replace(/\.[^.]+$/, "") ?? "spool";
    return `${base}-${settings.templateId}-${settings.speed}x.${format.ext}`;
  }, [file, settings.templateId, settings.speed, format.ext]);

  const showResult = view === "result" && result;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Stage */}
      <div className="grid gap-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          className={`relative aspect-video overflow-hidden rounded-[28px] shadow-lift transition-shadow ${
            file ? "bg-black" : "bg-wash"
          } ${dragging ? "ring-4 ring-pop" : ""}`}
        >
          {!file && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div className="grid max-w-md justify-items-center gap-4">
                <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Drop a video here</h2>
                <p className="text-mute">MP4, MOV or WebM. It stays on your device.</p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="rounded-full bg-ink px-6 py-3 font-semibold text-paper transition-transform hover:scale-[1.03]"
                  >
                    Choose video
                  </button>
                  <button
                    type="button"
                    onClick={useSample}
                    className="rounded-full border border-ink/15 bg-paper px-6 py-3 font-semibold transition-colors hover:border-ink"
                  >
                    Try a sample clip
                  </button>
                </div>
              </div>
            </div>
          )}

          {file && sourceUrl && !showResult && (
            <>
              <video
                ref={videoRef}
                src={sourceUrl}
                muted
                autoPlay
                playsInline
                onLoadedMetadata={onMetadata}
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
                className="absolute inset-0 size-full object-contain"
              />
            ))}

          {/* Chips on the video */}
          {file && !showResult && (
            <div className="pointer-events-none absolute top-4 left-4 flex gap-2">
              <span className="rounded-full bg-paper/95 px-3 py-1 text-sm font-semibold shadow-sm">{template.name}</span>
              <span className="rounded-full bg-pop px-3 py-1 text-sm font-bold tabular-nums shadow-sm">{settings.speed}×</span>
            </div>
          )}

          {file && result && (
            <div className="absolute top-4 right-4 flex rounded-full bg-paper/95 p-1 text-sm font-semibold shadow-sm">
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-black/85 to-transparent px-5 pt-14 pb-5 text-white">
              <p className="text-sm font-medium">
                <span className="font-bold">{format.label}</span> · {formatBytes(result.bytes)} · {settings.width} px ·{" "}
                {round1(outSeconds)} s · made in {round1(result.elapsedMs / 1000)} s
              </p>
              <a
                href={result.url}
                download={downloadName}
                className="pointer-events-auto rounded-full bg-pop px-5 py-2.5 font-bold text-ink transition-transform hover:scale-[1.03]"
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

        <input ref={inputRef} type="file" accept="video/*" hidden onChange={(e) => acceptFile(e.target.files?.[0])} />

        {file && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-mute">
            <span className="max-w-[32ch] truncate font-semibold text-ink">{file.name}</span>
            {duration > 0 && <span className="tabular-nums">{round1(duration)} s</span>}
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="font-semibold text-ink underline underline-offset-4 disabled:opacity-50"
            >
              Replace video
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="whitespace-pre-line rounded-2xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>

      {/* Controls */}
      <aside className="grid gap-6 rounded-[28px] border border-line bg-paper p-6 shadow-card lg:sticky lg:top-6">
        <Controls settings={settings} disabled={busy} onChange={patch} />

        <div className="grid gap-2">
          <button
            type="button"
            onClick={run}
            disabled={!file || busy}
            className="relative overflow-hidden rounded-full bg-ink px-6 py-4 text-base font-bold text-paper transition-transform enabled:hover:scale-[1.02] disabled:bg-ink/25"
          >
            {busy && (
              <span
                className="absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            )}
            <span className="relative">
              {busy ? "Exporting…" : result && status === "done" ? `Export ${format.label} again` : `Export ${format.label}`}
            </span>
          </button>
          <p className="text-center text-sm text-mute">
            {file
              ? `${round1(outSeconds)} s loop · ${settings.width} px · ${settings.fps} fps${outSeconds > 20 ? " · long clips make big files" : ""}`
              : "Add a video to get started."}
          </p>
        </div>
      </aside>
    </div>
  );
}
