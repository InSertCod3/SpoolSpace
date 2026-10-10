# Spool

Video in, loop out. Pick a look, set the speed, trim on the timeline, export GIF, MP4, WebM, WebP or APNG. Everything runs in the browser with ffmpeg.wasm, so videos never leave the device and there is no server cost per conversion.

Built with Next.js 15, React 19 and Tailwind CSS 4.

## Run it

```bash
npm install     # also copies the ffmpeg.wasm core into public/ffmpeg
npm run dev     # http://localhost:3000
```

## Where things live

| File | What it does |
| --- | --- |
| `lib/templates.ts` | The looks (Grain, Noir, VHS, Sepia, Pixel, Pop, Dream, and the "soon" shelf) |
| `lib/formats.ts` | Export formats and their encoder settings |
| `lib/pipeline.ts` | Builds the ffmpeg filter graph and arguments from the settings |
| `lib/convert.ts` | Runs ffmpeg.wasm in the browser |
| `components/App.tsx` | The three steps: splash, drop a video, editor |
| `components/Splash.tsx` | Splash screen with the Get started button |
| `components/DropScreen.tsx` | "Drop a video here" screen with a sample clip |
| `components/Editor.tsx` | The one-screen editor: stage, preview and export flow |
| `components/Timeline.tsx` | The trim timeline overlaid on the video |
| `components/Controls.tsx` | Side panel with Look, Speed and Export tabs |
| `app/globals.css` | Tailwind theme tokens (colors, fonts, shadows) |

## Add a look

Append an entry to `templates` in `lib/templates.ts`:

```ts
{
  id: "glitch",
  name: "Glitch",
  tagline: "Signal tears and jumps",
  status: "ready",
  swatch: { background: "linear-gradient(90deg, #00f0ff, #ff2d6f)" },
  params: [{ key: "shift", label: "Shift", min: 0, max: 12, step: 1, default: 4 }],
  filters: ({ shift = 4 }) => [`rgbashift=rh=${shift}:bv=${-shift}`],
  preview: () => ({ filter: "saturate(1.3)" }), // optional CSS approximation for the live preview
}
```

The side panel, the converter, the CLI and the splash screen all read from this list.

## Add a format

Append an entry to `formats` in `lib/formats.ts` with its extension, mime type, trailing filters and encoder arguments.

## CLI

Needs ffmpeg on your PATH.

```bash
npm run gif -- clip.mp4 out.mp4 --template vhs --format mp4 --speed 4 --loop boomerang --bleed 4
```

## Notes

- Speed-up uses `setpts=PTS/speed`, then `fps`, `scale` and the look's filters. GIF export uses a two-pass palette for clean colors.
- Reverse and boomerang buffer the clip in memory, so keep those clips short.
- The sample clip in `public/sample.mp4` is generated with ffmpeg's `mandelbrot` source.
