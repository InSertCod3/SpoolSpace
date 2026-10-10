"use client";

import { useState } from "react";
import Swatch from "@/components/Swatch";
import { formats, getFormat } from "@/lib/formats";
import { outputSeconds, type LoopMode, type Settings } from "@/lib/pipeline";
import { defaultValues, getTemplate, templates } from "@/lib/templates";

const SPEEDS = [0.5, 1, 2, 4, 8, 16];
const WIDTHS = [320, 480, 640, 800];
const FPS = [10, 15, 24, 30];
const LOOPS: { id: LoopMode; label: string; hint: string }[] = [
  { id: "forward", label: "Forward", hint: "Plays start to end, then repeats." },
  { id: "reverse", label: "Reverse", hint: "Plays end to start, then repeats." },
  { id: "boomerang", label: "Boomerang", hint: "Plays forward, then back, again and again." },
];

type Tab = "look" | "speed" | "export";
const TABS: { id: Tab; label: string }[] = [
  { id: "look", label: "Look" },
  { id: "speed", label: "Speed" },
  { id: "export", label: "Export" },
];

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-wash p-1">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={String(o.id)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={`rounded-full px-2 py-2 text-sm font-semibold tabular-nums transition-colors ${
              on ? "bg-ink text-paper shadow-sm" : "text-mute hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-bold">{label}</p>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid gap-0.5">
      <span className="flex justify-between text-sm font-bold">
        {label}
        <output className="font-medium text-mute tabular-nums">{display ?? value}</output>
      </span>
      <input
        type="range"
        className="slider-ink"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

interface Props {
  settings: Settings;
  disabled: boolean;
  onChange: (patch: Partial<Settings>) => void;
}

/** Three tabs so every control fits on one screen without scrolling. */
export default function Controls({ settings, disabled, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("look");
  const template = getTemplate(settings.templateId);
  const format = getFormat(settings.format);
  const loop = LOOPS.find((l) => l.id === settings.loop) ?? LOOPS[0];
  const heavy = template.params.some((p) => p.key === "grain" || p.key === "noise") && format.id === "gif";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div role="tablist" aria-label="Editor sections" className="grid shrink-0 grid-cols-3 gap-1 rounded-full bg-wash p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`rounded-full py-2 text-sm font-bold transition-colors ${
              tab === t.id ? "bg-ink text-paper shadow-sm" : "text-mute hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className={`grid min-h-0 flex-1 content-start gap-5 overflow-y-auto pr-1 ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        {tab === "look" && (
          <>
            <div className="grid grid-cols-5 gap-x-2 gap-y-3">
              {templates.map((t) => {
                const soon = t.status === "soon";
                const on = t.id === settings.templateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={soon}
                    aria-pressed={on}
                    onClick={() => onChange({ templateId: t.id, values: defaultValues(t) })}
                    className={`group grid gap-1.5 text-center ${soon ? "opacity-40" : ""}`}
                  >
                    <Swatch
                      template={t}
                      className={`aspect-square w-full rounded-xl transition-all ${
                        on ? "ring-2 ring-ink ring-offset-2" : "group-hover:scale-[1.06]"
                      }`}
                    />
                    <span className={`truncate text-xs leading-tight ${on ? "font-bold" : "font-semibold text-mute"}`}>
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-mute">{template.tagline}.</p>
            {template.params.map((p) => (
              <SliderField
                key={p.key}
                label={p.label}
                min={p.min}
                max={p.max}
                step={p.step}
                value={settings.values[p.key] ?? p.default}
                onChange={(v) => onChange({ values: { ...settings.values, [p.key]: v } })}
              />
            ))}
          </>
        )}

        {tab === "speed" && (
          <>
            <Field label="Playback speed">
              <Segmented
                label="Speed"
                value={settings.speed}
                options={SPEEDS.map((s) => ({ id: s, label: `${s}×` }))}
                onChange={(speed) => onChange({ speed })}
              />
            </Field>
            <SliderField
              label="Fine tune"
              min={0.5}
              max={16}
              step={0.5}
              value={settings.speed}
              display={`${settings.speed}×`}
              onChange={(speed) => onChange({ speed })}
            />
            <Field label="Loop style">
              <Segmented
                label="Loop style"
                value={settings.loop}
                options={LOOPS.map((l) => ({ id: l.id, label: l.label }))}
                onChange={(l) => onChange({ loop: l })}
              />
              <p className="text-sm text-mute">{loop.hint}</p>
            </Field>
            <p className="rounded-2xl bg-wash px-4 py-3 text-sm font-semibold tabular-nums">
              Result plays for {Math.round(outputSeconds(settings) * 10) / 10} s
            </p>
          </>
        )}

        {tab === "export" && (
          <>
            <Field label="Format">
              <div role="group" aria-label="Format" className="grid grid-cols-5 gap-1.5">
                {formats.map((f) => {
                  const on = f.id === settings.format;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onChange({ format: f.id })}
                      className={`rounded-xl border py-2.5 text-sm font-bold transition-colors ${
                        on ? "border-ink bg-pop text-ink" : "border-line bg-paper text-mute hover:border-ink hover:text-ink"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-mute">{format.blurb}</p>
            </Field>
            <Field label="Width in pixels">
              <Segmented
                label="Width"
                value={settings.width}
                options={WIDTHS.map((w) => ({ id: w, label: `${w}` }))}
                onChange={(width) => onChange({ width })}
              />
            </Field>
            <Field label="Frame rate">
              <Segmented
                label="Frame rate"
                value={settings.fps}
                options={FPS.map((f) => ({ id: f, label: `${f}` }))}
                onChange={(fps) => onChange({ fps })}
              />
            </Field>
            {heavy && (
              <p className="rounded-2xl bg-pop/40 px-4 py-3 text-sm font-medium">
                Grain changes every frame, so GIFs get big. MP4 or WebP keep the same look at a fraction of the size.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
