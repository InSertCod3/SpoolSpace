/**
 * Look registry.
 *
 * A look (template) is a named effect applied on top of the base speed / fps / scale
 * pipeline. To add one, append an entry to `templates`. The UI, the browser converter
 * and the CLI all read from this file, so nothing else needs to change.
 */

export type ParamDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
};

export type TemplateValues = Record<string, number>;

/** Approximation of a look using CSS, for the live preview on the source video. */
export interface PreviewStyle {
  filter?: string;
  /** 0 to 1, how visible the animated grain layer is. */
  grain?: number;
}

export interface Template {
  id: string;
  name: string;
  tagline: string;
  /** "ready" looks can be rendered; "soon" ones show up on the shelf only. */
  status: "ready" | "soon";
  /** CSS background for the swatch, and an optional grain overlay strength (0 to 1). */
  swatch: { background: string; grain?: number; filter?: string };
  params: ParamDef[];
  /** ffmpeg video filters, applied after speed, fps and scale. */
  filters: (values: TemplateValues, ctx: { width: number }) => string[];
  preview?: (values: TemplateValues) => PreviewStyle;
}

const SUN = "linear-gradient(160deg, #ffd978 0%, #ff7f57 45%, #2c40c9 100%)";

const grainFilter = (amount: number) =>
  amount > 0 ? [`noise=alls=${Math.round(amount)}:allf=t+u`] : [];

export const templates: Template[] = [
  {
    id: "clean",
    name: "Clean",
    tagline: "Your clip, just faster",
    status: "ready",
    swatch: { background: SUN },
    params: [],
    filters: () => [],
  },
  {
    id: "grain",
    name: "Grain",
    tagline: "Faded film with live grain",
    status: "ready",
    swatch: { background: SUN, grain: 0.7, filter: "saturate(0.7)" },
    params: [
      { key: "grain", label: "Grain", min: 0, max: 60, step: 1, default: 24 },
      { key: "fade", label: "Faded color", min: 0, max: 100, step: 1, default: 30 },
    ],
    filters: ({ grain = 24, fade = 30 }) => [
      `eq=contrast=1.06:saturation=${(1 - (fade / 100) * 0.6).toFixed(2)}`,
      ...grainFilter(grain),
    ],
    preview: ({ grain = 24, fade = 30 }) => ({
      filter: `contrast(1.06) saturate(${(1 - (fade / 100) * 0.6).toFixed(2)})`,
      grain: Math.min(0.75, grain / 60),
    }),
  },
  {
    id: "noir",
    name: "Noir",
    tagline: "Black and white, heavy shadows",
    status: "ready",
    swatch: { background: "linear-gradient(160deg, #e9e9e9 0%, #777 50%, #101010 100%)", grain: 0.5 },
    params: [
      { key: "contrast", label: "Contrast", min: 100, max: 170, step: 1, default: 125 },
      { key: "grain", label: "Grain", min: 0, max: 50, step: 1, default: 16 },
    ],
    filters: ({ contrast = 125, grain = 16 }) => [
      "hue=s=0",
      `eq=contrast=${(contrast / 100).toFixed(2)}:brightness=-0.02`,
      "vignette=PI/5",
      ...grainFilter(grain),
    ],
    preview: ({ contrast = 125, grain = 16 }) => ({
      filter: `grayscale(1) contrast(${(contrast / 100).toFixed(2)})`,
      grain: Math.min(0.75, grain / 60),
    }),
  },
  {
    id: "vhs",
    name: "VHS",
    tagline: "Color bleed and tape noise",
    status: "ready",
    swatch: {
      background:
        "repeating-linear-gradient(0deg, rgba(255,255,255,.14) 0 2px, transparent 2px 5px), linear-gradient(160deg, #ff5fa2 0%, #7b5cff 55%, #2ad4ff 100%)",
    },
    params: [
      { key: "bleed", label: "Color bleed", min: 0, max: 8, step: 1, default: 3 },
      { key: "noise", label: "Tape noise", min: 0, max: 30, step: 1, default: 10 },
    ],
    filters: ({ bleed = 3, noise = 10 }) => [
      ...(bleed > 0 ? [`rgbashift=rh=${-bleed}:bh=${bleed}`] : []),
      "eq=saturation=1.25:contrast=1.08",
      ...(noise > 0 ? [`noise=alls=${Math.round(noise)}:allf=t`] : []),
    ],
    preview: ({ noise = 10 }) => ({
      filter: "saturate(1.25) contrast(1.08)",
      grain: Math.min(0.6, noise / 50),
    }),
  },
  {
    id: "sepia",
    name: "Sepia",
    tagline: "Warm, old-photo tones",
    status: "ready",
    swatch: { background: "linear-gradient(160deg, #f3d9a8 0%, #b98550 55%, #4a2c16 100%)", grain: 0.35 },
    params: [{ key: "grain", label: "Grain", min: 0, max: 40, step: 1, default: 10 }],
    filters: ({ grain = 10 }) => [
      "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0",
      "vignette=PI/4.5",
      ...grainFilter(grain),
    ],
    preview: ({ grain = 10 }) => ({ filter: "sepia(1)", grain: Math.min(0.6, grain / 50) }),
  },
  {
    id: "pixel",
    name: "Pixel",
    tagline: "Chunky 8-bit blocks",
    status: "ready",
    swatch: {
      background: "conic-gradient(#2aa87c 25%, #1b6f55 0 50%, #52d3a4 0 75%, #2aa87c 0) 0 0 / 18px 18px",
    },
    params: [{ key: "size", label: "Block size", min: 2, max: 24, step: 1, default: 8 }],
    filters: ({ size = 8 }, { width }) => [
      `scale=trunc(iw/${Math.round(size)}/2)*2:-2:flags=neighbor`,
      `scale=${width}:-2:flags=neighbor`,
    ],
  },
  {
    id: "pop",
    name: "Pop",
    tagline: "Saturated and punchy",
    status: "ready",
    swatch: { background: "linear-gradient(160deg, #ffe14d 0%, #ff4d6d 50%, #3a2cff 100%)" },
    params: [{ key: "boost", label: "Boost", min: 0, max: 100, step: 1, default: 50 }],
    filters: ({ boost = 50 }) => [
      `eq=saturation=${(1 + (boost / 100) * 1.2).toFixed(2)}:contrast=1.1`,
      "unsharp=5:5:0.8:5:5:0",
    ],
    preview: ({ boost = 50 }) => ({
      filter: `saturate(${(1 + (boost / 100) * 1.2).toFixed(2)}) contrast(1.1)`,
    }),
  },
  {
    id: "dream",
    name: "Dream",
    tagline: "Soft glow, lifted colors",
    status: "ready",
    swatch: { background: "linear-gradient(160deg, #ffd6f0 0%, #c9b6ff 50%, #9ee7ff 100%)", filter: "blur(1px)" },
    params: [{ key: "soft", label: "Softness", min: 0, max: 100, step: 1, default: 40 }],
    filters: ({ soft = 40 }) => [
      `gblur=sigma=${(0.4 + (soft / 100) * 2.4).toFixed(2)}`,
      "eq=brightness=0.05:saturation=1.25",
    ],
    preview: ({ soft = 40 }) => ({
      filter: `blur(${(soft / 100 * 1.6).toFixed(1)}px) brightness(1.06) saturate(1.25)`,
    }),
  },
  {
    id: "halftone",
    name: "Halftone",
    tagline: "Print dots, one ink",
    status: "soon",
    swatch: { background: "radial-gradient(circle, #141414 38%, transparent 40%) 0 0 / 9px 9px, #f2e3b5" },
    params: [],
    filters: () => [],
  },
  {
    id: "glitch",
    name: "Glitch",
    tagline: "Signal tears and jumps",
    status: "soon",
    swatch: { background: "linear-gradient(90deg, #00f0ff 0 33%, #ff2d6f 33% 66%, #141414 66%)" },
    params: [],
    filters: () => [],
  },
];

export function getTemplate(id: string): Template {
  return templates.find((t) => t.id === id) ?? templates[0];
}

export function defaultValues(template: Template): TemplateValues {
  return Object.fromEntries(template.params.map((p) => [p.key, p.default]));
}
