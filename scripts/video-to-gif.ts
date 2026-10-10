#!/usr/bin/env tsx
/**
 * Convert a video to a sped-up GIF (or MP4, WebM, WebP, APNG) using the same looks as the web app.
 *
 *   npm run gif -- input.mp4 [output] [--template grain] [--format gif] [--speed 4]
 *                  [--fps 15] [--width 480] [--start 0] [--length 10]
 *                  [--loop forward|reverse|boomerang] [--grain 24] [--fade 30]
 *
 * Requires ffmpeg on your PATH.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { formats, getFormat } from "../lib/formats";
import { buildArgs, outputSeconds, type LoopMode, type Settings } from "../lib/pipeline";
import { defaultValues, getTemplate, templates } from "../lib/templates";

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) flags[arg.slice(2)] = argv[++i] ?? "";
    else positional.push(arg);
  }
  return { positional, flags };
}

function num(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || (n <= 0 && name !== "start")) {
    console.error(`--${name} must be a positive number (got "${value}")`);
    process.exit(1);
  }
  return n;
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const [input, outArg] = positional;

if (!input || flags.help !== undefined) {
  console.error(
    `Usage: npm run gif -- <input.mp4> [output] [options]\n\n` +
      `Options:\n` +
      `  --template <id>   ${templates.filter((t) => t.status === "ready").map((t) => t.id).join(" | ")} (default grain)\n` +
      `  --format <id>     ${formats.map((f) => f.id).join(" | ")} (default gif)\n` +
      `  --loop <mode>     forward | reverse | boomerang (default forward)\n` +
      `  --speed <n>       playback speed multiplier (default 4)\n` +
      `  --fps <n>         output frames per second (default 15)\n` +
      `  --width <px>      output width (default 480)\n` +
      `  --start <s>       start time in the source (default 0)\n` +
      `  --length <s>      seconds of source to use (default 10)\n` +
      `  --<param> <n>     look parameter, e.g. --grain 30 --fade 50`,
  );
  process.exit(input ? 0 : 1);
}

if (!existsSync(input)) {
  console.error(`File not found: ${input}`);
  process.exit(1);
}

const template = getTemplate(flags.template ?? "grain");
if (template.status !== "ready") {
  console.error(`The "${template.id}" look is not available yet.`);
  process.exit(1);
}

const format = getFormat(flags.format ?? "gif");
const loop = (flags.loop ?? "forward") as LoopMode;
if (!["forward", "reverse", "boomerang"].includes(loop)) {
  console.error(`--loop must be forward, reverse or boomerang (got "${flags.loop}")`);
  process.exit(1);
}

const values = defaultValues(template);
for (const p of template.params) {
  if (flags[p.key] !== undefined) values[p.key] = num(flags[p.key], p.default, p.key);
}

const settings: Settings = {
  templateId: template.id,
  values,
  speed: num(flags.speed, 4, "speed"),
  fps: num(flags.fps, 15, "fps"),
  width: num(flags.width, 480, "width"),
  start: num(flags.start, 0, "start"),
  length: num(flags.length, 10, "length"),
  format: format.id,
  loop,
};

const output =
  outArg ?? join(dirname(input), `${basename(input, extname(input))}-${template.id}.${format.ext}`);

console.log(
  `${template.name} · ${format.label} · ${settings.speed}× · ${settings.fps} fps · ${settings.width}px → ${outputSeconds(settings).toFixed(1)}s ${loop}`,
);

const result = spawnSync("ffmpeg", buildArgs(input, output, settings), { stdio: ["ignore", "ignore", "inherit"] });
if (result.error) {
  console.error("Could not run ffmpeg. Install it and make sure it is on your PATH.");
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Saved ${output}`);
