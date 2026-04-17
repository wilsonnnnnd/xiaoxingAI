
type KpiTone = 'sky' | 'emerald' | 'violet'
export function KpiCard({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone: KpiTone
}) {
  const toneMap: Record<KpiTone, string> = {
    sky: 'bg-[rgba(217,235,255,0.6)] text-[#0b3c5d]',
    emerald: 'bg-[rgba(220,245,230,0.6)] text-emerald-700',
    violet: 'bg-[rgba(235,230,255,0.6)] text-violet-700',
  }

  return (
    <div
      className={[
        'group relative rounded-[24px]',
        // ✅ glass
        'bg-white/70 backdrop-blur-xl',
        'border border-white/70',
        'ring-1 ring-black/[0.03]',
        // ✅ spacing
        'p-5',
        // ✅ soft shadow
        'shadow-[0_8px_24px_rgba(15,23,42,0.04)]',
        // ✅ material highlight
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.35),rgba(255,255,255,0.1)_40%,transparent)]',
        // ✅ subtle hover
        'transition-all duration-200 hover:bg-white/80',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
            {label}
          </div>

          <div className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-900 tabular-nums sm:text-5xl">
            {value}
          </div>
        </div>

        {/* ✅ tone badge（替代渐变） */}
        <div
          className={[
            'rounded-full px-2.5 py-1 text-[11px] font-medium',
            'border border-white/60',
            toneMap[tone],
          ].join(' ')}
        >
          Live
        </div>
      </div>

      {/* 底部信息 */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="text-xs leading-5 text-slate-500">{note}</div>

        {/* ✅ 极弱分隔（不是渐变） */}
        <div className="h-px flex-1 bg-slate-200/60" />
      </div>
    </div>
  )
}