/** Export formats. Add an entry here and it shows up in the UI, the converter and the CLI. */

export type FormatId = "gif" | "mp4" | "webm" | "webp" | "apng";

export interface Format {
  id: FormatId;
  label: string;
  ext: string;
  mime: string;
  /** "image" formats preview in an <img>, "video" formats in a <video>. */
  kind: "image" | "video";
  blurb: string;
  /** Filters appended after the look (and after loop handling). */
  tail: string[];
  /** Encoder arguments placed before the output file. */
  args: string[];
  /** GIF only: build a 256-color palette per clip. */
  palette?: boolean;
}

export const formats: Format[] = [
  {
    id: "gif",
    label: "GIF",
    ext: "gif",
    mime: "image/gif",
    kind: "image",
    blurb: "Works everywhere. Biggest files.",
    tail: [],
    args: ["-loop", "0"],
    palette: true,
  },
  {
    id: "mp4",
    label: "MP4",
    ext: "mp4",
    mime: "video/mp4",
    kind: "video",
    blurb: "Tiny and sharp. Best for social and the web.",
    tail: ["format=yuv420p"],
    args: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart"],
  },
  {
    id: "webm",
    label: "WebM",
    ext: "webm",
    mime: "video/webm",
    kind: "video",
    blurb: "Small files for browsers and Discord.",
    tail: ["format=yuv420p"],
    args: ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-deadline", "realtime", "-cpu-used", "6", "-pix_fmt", "yuv420p"],
  },
  {
    id: "webp",
    label: "WebP",
    ext: "webp",
    mime: "image/webp",
    kind: "image",
    blurb: "Animated image, far smaller than GIF.",
    tail: [],
    args: ["-c:v", "libwebp", "-loop", "0", "-q:v", "70", "-compression_level", "3"],
  },
  {
    id: "apng",
    label: "APNG",
    ext: "png",
    mime: "image/png",
    kind: "image",
    blurb: "Animated PNG with full color and no dithering.",
    tail: [],
    args: ["-f", "apng", "-plays", "0"],
  },
];

export function getFormat(id: string): Format {
  return formats.find((f) => f.id === id) ?? formats[0];
}
