import Logo from "@/components/Logo";
import Swatch from "@/components/Swatch";
import { formats } from "@/lib/formats";
import { templates } from "@/lib/templates";

export default function Splash({ onStart }: { onStart: () => void }) {
  // Doubled so the marquee can loop without a visible jump.
  const strip = [...templates, ...templates];

  return (
    <main className="animate-step-in flex h-dvh flex-col overflow-hidden">
      <header className="flex h-20 shrink-0 items-center justify-between px-6 sm:px-10">
        <Logo />
        <span className="flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm font-semibold">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          Runs in your browser
        </span>
      </header>

      <div className="grid min-h-0 flex-1 content-center px-6 sm:px-10">
        <h1 className="max-w-[9ch] font-display text-[clamp(3.25rem,min(12vw,18dvh),9.5rem)] leading-[0.9] font-extrabold tracking-tight">
          Clips in. Loops out.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-mute sm:text-xl">
          Turn any video into a looping GIF, MP4 or WebP. Pick a look, set the speed, and export. Nothing is uploaded.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <button
            type="button"
            onClick={onStart}
            autoFocus
            className="rounded-full bg-ink px-9 py-4 text-lg font-bold text-paper shadow-lift transition-transform hover:scale-[1.04] active:scale-[0.98]"
          >
            Get started
          </button>
          <ul className="flex flex-wrap gap-2" aria-label="Export formats">
            {formats.map((f) => (
              <li key={f.id} className="rounded-full border border-line px-3 py-1 text-sm font-semibold text-mute">
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="shrink-0 overflow-hidden pt-4 pb-8 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]"
      >
        <div className="animate-marquee flex w-max">
          {strip.map((t, i) => (
            <div key={`${t.id}-${i}`} className={`mr-4 w-44 shrink-0 sm:w-52 ${t.status === "soon" ? "opacity-50" : ""}`}>
              <Swatch template={t} className="aspect-[4/3] w-full rounded-3xl shadow-card" />
              <p className="mt-2 px-1 font-display text-base font-bold">{t.name}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
