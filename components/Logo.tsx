export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight ${className}`}>
      <span className="grid size-8 place-items-center rounded-full bg-ink" aria-hidden="true">
        <span className="size-3 rounded-full bg-pop" />
      </span>
      Spool
    </span>
  );
}
