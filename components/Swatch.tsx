import type { Template } from "@/lib/templates";

/** A small colored tile that hints at what a look does. */
export default function Swatch({ template, className = "" }: { template: Template; className?: string }) {
  const { background, grain, filter } = template.swatch;
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden ${className}`}
      style={{ background, filter }}
    >
      {grain ? <div className="grain-layer absolute inset-0" style={{ opacity: grain }} /> : null}
    </div>
  );
}
