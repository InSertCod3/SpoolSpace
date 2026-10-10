import { getFormat, type FormatId } from "./formats";
import { defaultValues, getTemplate, type TemplateValues } from "./templates";

export type LoopMode = "forward" | "reverse" | "boomerang";

export interface Settings {
  templateId: string;
  values: TemplateValues;
  /** Playback speed multiplier, e.g. 4 = four times faster. */
  speed: number;
  fps: number;
  /** Output width in pixels; height follows the aspect ratio. */
  width: number;
  /** Where to start in the source video, in seconds. */
  start: number;
  /** How much of the source to use, in seconds (before speed-up). */
  length: number;
  format: FormatId;
  loop: LoopMode;
}

export const DEFAULT_SETTINGS: Settings = {
  templateId: "grain",
  values: defaultValues(getTemplate("grain")),
  speed: 4,
  fps: 15,
  width: 480,
  start: 0,
  length: 10,
  format: "gif",
  loop: "forward",
};

/** The ffmpeg filter graph for the given settings. */
export function buildFilterGraph(s: Settings): string {
  const template = getTemplate(s.templateId);
  const format = getFormat(s.format);

  let graph = [
    `setpts=PTS/${s.speed}`,
    `fps=${s.fps}`,
    `scale=${s.width}:-2:flags=lanczos`,
    ...template.filters(s.values, { width: s.width }),
  ].join(",");

  if (s.loop === "reverse") graph += ",reverse";
  if (s.loop === "boomerang") graph += ",split[f][r];[r]reverse[rr];[f][rr]concat=n=2:v=1:a=0";

  if (format.palette) {
    graph +=
      ",split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle";
  } else if (format.tail.length) {
    graph += "," + format.tail.join(",");
  }
  return graph;
}

/** Full ffmpeg argument list (without the leading "ffmpeg"). */
export function buildArgs(input: string, output: string, s: Settings): string[] {
  const format = getFormat(s.format);
  return [
    "-y",
    "-ss", String(s.start),
    "-t", String(s.length),
    "-i", input,
    "-an",
    "-vf", buildFilterGraph(s),
    ...format.args,
    output,
  ];
}

/** Length of the finished loop in seconds. */
export function outputSeconds(s: Pick<Settings, "length" | "speed" | "loop">): number {
  return (s.length / s.speed) * (s.loop === "boomerang" ? 2 : 1);
}
