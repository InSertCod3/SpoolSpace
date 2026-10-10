"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TrimSlider, { formatTime } from "@/components/TrimSlider";
import { convertToGif, formatBytes, type ConvertResult } from "@/lib/convert";
import {
  DEFAULT_SETTINGS,
  defaultValues,
  getTemplate,
  outputSeconds,
  templates,
  type Settings,
} from "@/lib/templates";

const SPEED_PRESETS = [1, 2, 4, 8];
const FPS_OPTIONS = [10, 15, 24];
const WIDTH_OPTIONS = [320, 480, 640, 800];
const MAX_FILE_MB = 300;

type Status = "idle" | "loading" | "rendering" | "done" | "error";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export default function Workbench() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [view, setView] = useState<"source" | "gif">("source");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const warmed = useRef(false);

  const template = getTemplate(settings.templateId);
  const busy = status === "loading" || status === "rendering";
  const outSeconds = outputSeconds(settings);

  // Revoke object URLs when they are replaced or the page closes.
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  // Preview the speed live on the source video.
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = Math.min(16, settings.speed);
  }, [settings.speed, sourceUrl, view]);

  // Keep the preview inside the selected range.
  const seekToStart = useCallback(() => {
    const v = videoRef.current;
    if (v) v.currentTime = settings.start;
  }, [settings.start]);

  useEffect(() => {
    seekToStart();
  }, [seekToStart, settings.length]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime >= end || v.currentTime < settings.start - 0.3) {
      v.currentTime = settings.start;
      if (v.paused) void v.play().catch(() => {});
    }
  };

  const setRange = useCallback((start: number, endTime: number) => {
    setSettings((s) => ({ ...s, start, length: round1(endTime - start) }));
  }, []);

  const patch = useCallback((next: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...next }));
  }, []);

  const warmEngine = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    import("@/lib/convert").then((m) => m.getFFmpeg()).catch(() => { warmed.current = false; });
  }, []);

  const acceptFile = useCallback((f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("That file isn't a video. Drop an MP4, MOV or WebM.");
      setStatus("error");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That video is over ${MAX_FILE_MB} MB. Trim it first, or pick a shorter clip.`);
      setStatus("error");
      return;
    }
    setError(null);
    setStatus("idle");
    setResult(null);
    setView("source");
    setProgress(0);
    setFile(f);
    setSourceUrl(URL.createObjectURL(f));
    warmEngine();
  }, [warmEngine]);

  const onMetadata = () => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    setDuration(v.duration);
    setSettings((s) => ({ ...s, start: 0, length: round1(Math.min(10, v.duration)) }));
  };

  const run = async () => {
    if (!file || busy) return;
    setError(null);
    setStatus("loading");
    setProgress(0);
    try {
      const out = await convertToGif(file, settings, (p) => {
        setStatus("rendering");
        setProgress(p);
      });
      setResult(out);
      setView("gif");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while rendering.");
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
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadName = useMemo(() => {
    const base = file?.name.replace(/\.[^.]+$/, "") ?? "spool";
    return `${base}-${settings.templateId}-${settings.speed}x.gif`;
  }, [file, settings.templateId, settings.speed]);

  const grain = template.id === "grain" ? settings.values.grain ?? 0 : 0;
  const fade = template.id === "grain" ? settings.values.fade ?? 0 : 0;
  const previewStyle = {
    filter: `contrast(1.06) saturate(${(1 - (fade / 100) * 0.6).toFixed(2)})`,
  };

  const end = round1(settings.start + settings.length);
  const isEntire = duration > 0 && settings.start === 0 && Math.abs(settings.length - round1(duration)) < 0.05;

  return (
    <section className="bench" aria-label="Video to GIF converter">
      {/* Stage */}
      <div className="stage-col">
        <div className="reel">
          <div className="sprockets" aria-hidden="true" />
          <div
            className={`frame${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              acceptFile(e.dataTransfer.files?.[0]);
            }}
          >
            {!file && (
              <button type="button" className="drop" onClick={() => inputRef.current?.click()}>
                <span className="drop-title">Drop a video here</span>
                <span className="drop-sub">or choose a file. MP4, MOV and WebM work best.</span>
                <span className="drop-cta">Choose video</span>
              </button>
            )}

            {file && sourceUrl && view === "source" && (
              <div className="media">
                <video
                  ref={videoRef}
                  src={sourceUrl}
                  style={previewStyle}
                  muted
                  autoPlay
                  playsInline
                  onLoadedMetadata={onMetadata}
                  onTimeUpdate={onTimeUpdate}
                  onEnded={() => { seekToStart(); void videoRef.current?.play().catch(() => {}); }}
                />
                {grain > 0 && (
                  <div
                    className="grain-overlay"
                    style={{ opacity: Math.min(0.75, grain / 60) }}
                    aria-hidden="true"
                  />
                )}
              </div>
            )}

            {file && result && view === "gif" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="media gif" src={result.url} alt="The rendered GIF" />
            )}

            {busy && (
              <div className="rendering" role="status" aria-live="polite">
                <span className="rendering-label">
                  {status === "loading" ? "Starting the converter" : `Rendering ${Math.round(progress * 100)}%`}
                </span>
                <span className="meter"><span style={{ width: `${Math.max(4, progress * 100)}%` }} /></span>
              </div>
            )}
          </div>
          <div className="sprockets" aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />

        <div className="stage-bar">
          {file ? (
            <>
              <div className="tabs" role="tablist" aria-label="Preview">
                <button
                  role="tab"
                  aria-selected={view === "source"}
                  className={view === "source" ? "on" : ""}
                  onClick={() => setView("source")}
                >
                  Video
                </button>
                <button
                  role="tab"
                  aria-selected={view === "gif"}
                  className={view === "gif" ? "on" : ""}
                  disabled={!result}
                  onClick={() => setView("gif")}
                >
                  GIF
                </button>
              </div>
              <p className="file-meta">
                <span className="file-name">{file.name}</span>
                {duration > 0 && <span>{round1(duration)} s source</span>}
              </p>
              <button className="quiet" onClick={reset} disabled={busy}>Replace video</button>
            </>
          ) : (
            <p className="file-meta">Nothing is uploaded. Conversion happens on this device.</p>
          )}
        </div>

        {error && (
          <p className="error" role="alert">{error}</p>
        )}

        {file && duration > 0 && (
          <div className="trim-panel">
            <div className="trim-head">
              <p className="trim-title">Clip</p>
              <p className="trim-readout">
                {formatTime(settings.start)} to {formatTime(end)}
                <span> · {round1(settings.length)} s of {round1(duration)} s</span>
              </p>
              <div className="trim-presets">
                <button
                  type="button"
                  className={isEntire ? "on" : ""}
                  aria-pressed={isEntire}
                  disabled={busy}
                  onClick={() => setRange(0, round1(duration))}
                >
                  Entire video
                </button>
                <button
                  type="button"
                  disabled={busy || duration <= 0.5}
                  onClick={() => setRange(settings.start, round1(Math.min(duration, settings.start + 3)))}
                >
                  3 s
                </button>
                <button
                  type="button"
                  disabled={busy || duration <= 0.5}
                  onClick={() => setRange(settings.start, round1(Math.min(duration, settings.start + 5)))}
                >
                  5 s
                </button>
              </div>
            </div>
            <TrimSlider
              duration={duration}
              start={settings.start}
              end={end}
              disabled={busy}
              onChange={setRange}
            />
            <p className="hint">
              Your GIF will play for {round1(outSeconds)} s at {settings.speed}× speed.
              {outSeconds > 20 && " That is a long loop, so expect a large file and a slower render."}
            </p>
          </div>
        )}

        {result && status === "done" && (
          <div className="result">
            <div>
              <p className="result-title">Your GIF is ready</p>
              <p className="result-meta">
                {formatBytes(result.bytes)} · {settings.width} px wide · {round1(outSeconds)} s loop · made in {round1(result.elapsedMs / 1000)} s
              </p>
            </div>
            <a className="primary" href={result.url} download={downloadName}>Download GIF</a>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="controls">
        <fieldset className="group">
          <legend>Look</legend>
          <div className="looks">
            {templates.map((t) => {
              const soon = t.status === "soon";
              const selected = t.id === settings.templateId;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`look look-${t.id}${selected ? " is-selected" : ""}`}
                  aria-pressed={selected}
                  disabled={soon}
                  onClick={() => patch({ templateId: t.id, values: defaultValues(t) })}
                >
                  <span className="swatch" aria-hidden="true" />
                  <span className="look-name">{t.name}</span>
                  <span className="look-tag">{soon ? "Coming soon" : t.tagline}</span>
                </button>
              );
            })}
          </div>

          {template.params.map((p) => (
            <label className="slider" key={p.key}>
              <span className="slider-head">
                <span>{p.label}</span>
                <output>{settings.values[p.key] ?? p.default}</output>
              </span>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={settings.values[p.key] ?? p.default}
                onChange={(e) =>
                  patch({ values: { ...settings.values, [p.key]: Number(e.target.value) } })
                }
              />
            </label>
          ))}
        </fieldset>

        <fieldset className="group">
          <legend>Speed</legend>
          <div className="seg" role="group" aria-label="Speed presets">
            {SPEED_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={settings.speed === s}
                className={settings.speed === s ? "on" : ""}
                onClick={() => patch({ speed: s })}
              >
                {s}×
              </button>
            ))}
          </div>
          <label className="slider">
            <span className="slider-head">
              <span>Custom</span>
              <output>{settings.speed}×</output>
            </span>
            <input
              type="range"
              min={0.5}
              max={16}
              step={0.5}
              value={settings.speed}
              onChange={(e) => patch({ speed: Number(e.target.value) })}
            />
          </label>
        </fieldset>


        <fieldset className="group">
          <legend>Quality</legend>
          <div className="seg" role="group" aria-label="Frame rate">
            {FPS_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={settings.fps === f}
                className={settings.fps === f ? "on" : ""}
                onClick={() => patch({ fps: f })}
              >
                {f} fps
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Width">
            {WIDTH_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={settings.width === w}
                className={settings.width === w ? "on" : ""}
                onClick={() => patch({ width: w })}
              >
                {w} px
              </button>
            ))}
          </div>
          {template.id === "grain" && (
            <p className="hint">Grain adds detail to every frame, so files get larger. Try 480 px and 15 fps first.</p>
          )}
        </fieldset>

        <button
          type="button"
          className="primary make"
          disabled={!file || busy}
          onClick={run}
        >
          {busy ? "Rendering…" : result ? "Render again" : "Make GIF"}
        </button>
        {!file && <p className="hint center">Add a video to get started.</p>}
      </div>
    </section>
  );
}
