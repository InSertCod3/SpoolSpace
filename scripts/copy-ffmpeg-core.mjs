// Copies the single-threaded ffmpeg.wasm core and the ffmpeg worker into /public
// so the browser loads everything from our own origin (no CDN, no COOP/COEP headers).
import { mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const coreSrc = join(root, "node_modules", "@ffmpeg", "core", "dist", "esm");
const workerSrc = join(root, "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
const coreDest = join(root, "public", "ffmpeg");
const workerDest = join(coreDest, "worker");

if (!existsSync(coreSrc) || !existsSync(workerSrc)) {
  console.warn("[copy-ffmpeg-core] @ffmpeg packages not installed yet, skipping");
  process.exit(0);
}

mkdirSync(workerDest, { recursive: true });

for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  copyFileSync(join(coreSrc, file), join(coreDest, file));
}
for (const file of readdirSync(workerSrc)) {
  if (file.endsWith(".js")) copyFileSync(join(workerSrc, file), join(workerDest, file));
}
console.log("[copy-ffmpeg-core] copied ffmpeg core and worker to public/ffmpeg");
