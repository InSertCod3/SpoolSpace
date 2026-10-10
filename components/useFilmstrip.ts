"use client";

import { useEffect, useState } from "react";

/** Grabs evenly spaced thumbnails from a video so the timeline can show what is in it. */
export function useFilmstrip(url: string | null, duration: number, count = 14): string[] {
  const [frames, setFrames] = useState<string[]>([]);

  useEffect(() => {
    setFrames([]);
    if (!url || !duration) return;

    let cancelled = false;
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = url;

    const seek = (t: number) =>
      new Promise<void>((resolve) => {
        const done = () => {
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done);
        video.currentTime = t;
      });

    (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("decode"));
        });
        const w = 120;
        const h = Math.max(1, Math.round((w * video.videoHeight) / Math.max(1, video.videoWidth)));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const out: string[] = [];
        for (let i = 0; i < count; i++) {
          if (cancelled) return;
          await seek(Math.min(duration - 0.05, ((i + 0.5) / count) * duration));
          ctx.drawImage(video, 0, 0, w, h);
          out.push(canvas.toDataURL("image/jpeg", 0.6));
          // Show thumbnails as they arrive instead of waiting for all of them.
          if (!cancelled) setFrames([...out]);
        }
      } catch {
        // No thumbnails is fine: the timeline still works.
      }
    })();

    return () => {
      cancelled = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [url, duration, count]);

  return frames;
}
