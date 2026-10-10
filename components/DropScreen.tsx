"use client";

import { useRef, useState } from "react";
import Logo from "@/components/Logo";

const MAX_FILE_MB = 300;

export default function DropScreen({
  onFile,
  onBack,
}: {
  onFile: (file: File) => void;
  onBack: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("That file is not a video. Drop an MP4, MOV or WebM.");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That video is over ${MAX_FILE_MB} MB. Trim it first or pick a shorter clip.`);
      return;
    }
    setError(null);
    onFile(f);
  };

  const sample = async () => {
    setLoadingSample(true);
    try {
      const res = await fetch("/sample.mp4");
      if (!res.ok) throw new Error("missing");
      const blob = await res.blob();
      accept(new File([blob], "sample.mp4", { type: "video/mp4" }));
    } catch {
      setError("Could not load the sample clip. Check your connection and try again.");
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <main
      className="animate-step-in flex h-dvh flex-col overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files?.[0]);
      }}
    >
      <header className="flex h-20 shrink-0 items-center justify-between px-6 sm:px-10">
        <button type="button" onClick={onBack} aria-label="Back to start" className="rounded-full">
          <Logo />
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-4 py-2 text-sm font-semibold text-mute transition-colors hover:bg-wash hover:text-ink"
        >
          Back
        </button>
      </header>

      <div className="grid min-h-0 flex-1 place-items-center px-6 pb-10 sm:px-10">
        <div
          className={`grid w-full max-w-3xl justify-items-center gap-5 rounded-[36px] px-6 py-16 text-center transition-all sm:py-24 ${
            dragging ? "bg-pop/40 ring-4 ring-pop" : "bg-wash"
          }`}
        >
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">Drop a video here</h1>
          <p className="text-lg text-mute">MP4, MOV or WebM. It stays on your device.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-ink px-8 py-3.5 text-base font-bold text-paper transition-transform hover:scale-[1.04] active:scale-[0.98]"
            >
              Choose video
            </button>
            <button
              type="button"
              onClick={sample}
              disabled={loadingSample}
              className="rounded-full border border-ink/15 bg-paper px-8 py-3.5 text-base font-bold transition-colors hover:border-ink disabled:opacity-60"
            >
              {loadingSample ? "Loading…" : "Try a sample clip"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 max-w-md rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="video/*" hidden onChange={(e) => accept(e.target.files?.[0])} />
    </main>
  );
}
