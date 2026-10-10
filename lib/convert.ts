import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { getFormat, type Format } from "./formats";
import { buildArgs, type Settings } from "./pipeline";

let ffmpegPromise: Promise<FFmpeg> | null = null;

/** Loads ffmpeg.wasm once per page. Everything is served from our own origin. */
export function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpeg();
      // Absolute URLs: the bundler rewrites import.meta.url to a file:// path,
      // so root-relative URLs would resolve against the local disk.
      const base = `${window.location.origin}/ffmpeg`;
      await ffmpeg.load({
        coreURL: `${base}/ffmpeg-core.js`,
        wasmURL: `${base}/ffmpeg-core.wasm`,
        classWorkerURL: `${base}/worker/worker.js`,
      });
      return ffmpeg;
    })();
    ffmpegPromise.catch(() => {
      ffmpegPromise = null;
    });
  }
  return ffmpegPromise;
}

export interface ConvertResult {
  blob: Blob;
  url: string;
  bytes: number;
  elapsedMs: number;
  format: Format;
}

export async function convertVideo(
  file: File,
  settings: Settings,
  onProgress: (fraction: number) => void,
): Promise<ConvertResult> {
  const started = performance.now();
  const format = getFormat(settings.format);
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const input = `input.${ext}`;
  const output = `out.${format.ext}`;
  const logs: string[] = [];

  const onProg = ({ progress }: { progress: number }) =>
    onProgress(Math.min(1, Math.max(0, progress)));
  const onLog = ({ message }: { message: string }) => {
    logs.push(message);
    if (logs.length > 40) logs.shift();
  };

  ffmpeg.on("progress", onProg);
  ffmpeg.on("log", onLog);

  try {
    await ffmpeg.writeFile(input, await fetchFile(file));
    const code = await ffmpeg.exec(buildArgs(input, output, settings));
    if (code !== 0) {
      throw new Error(
        `Could not export ${format.label}. Try another format, or an MP4 (H.264) source.\n` +
          logs.slice(-3).join("\n"),
      );
    }
    const data = (await ffmpeg.readFile(output)) as Uint8Array;
    const blob = new Blob([data as unknown as BlobPart], { type: format.mime });
    onProgress(1);
    return {
      blob,
      url: URL.createObjectURL(blob),
      bytes: blob.size,
      elapsedMs: performance.now() - started,
      format,
    };
  } finally {
    ffmpeg.off("progress", onProg);
    ffmpeg.off("log", onLog);
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
