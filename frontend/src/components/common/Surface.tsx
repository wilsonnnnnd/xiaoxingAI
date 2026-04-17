export function Surface({
  title,
  eyebrow,
  badge,
  children,
}: {
  title: string
  eyebrow?: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/50 bg-white/78 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />
      <div className="pointer-events-none absolute right-[-20px] top-[-20px] h-28 w-28 rounded-full bg-sky-100/60 blur-3xl" />

      <div className="relative mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">
            {title}
          </h2>
        </div>

        {badge ? (
          <div className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {badge}
          </div>
        ) : null}
      </div>

      <div className="relative">{children}</div>
    </div>
  )
}
