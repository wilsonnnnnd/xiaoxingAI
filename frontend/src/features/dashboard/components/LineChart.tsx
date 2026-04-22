type Point = { date: string; value: number }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function fmtDateShort(date: string) {
  const s = String(date || '')
  if (s.length >= 10) return s.slice(5, 10)
  return s
}

function ChartEmptyState({
  title,
  message,
  placeholder = false,
}: {
  title: string
  message: string
  placeholder?: boolean
}) {
  return (
    <div
      className={[
        'flex h-full min-h-[140px] flex-col justify-center px-5 py-6',
        placeholder ? 'bg-slate-50/55' : 'bg-white/30',
      ].join(' ')}
    >
      <div className="text-sm font-medium text-slate-700">{title}</div>
      <div className="mt-2 max-w-[28rem] text-sm leading-6 text-slate-500">
        {message}
      </div>
    </div>
  )
}

export function LineChart({
  data,
  height = 140,
  stroke = 'rgba(11,60,93,0.72)',
  fill = 'rgba(217,235,255,0.55)',
  valueSuffix,
  emptyTitle = 'No data available',
  emptyMessage = 'Data will appear here once activity is recorded.',
  placeholder = false,
}: {
  data: Point[]
  height?: number
  stroke?: string
  fill?: string
  valueSuffix?: string
  emptyTitle?: string
  emptyMessage?: string
  placeholder?: boolean
}) {
  const width = 520
  const padX = 18
  const padY = 14

  const values = data.map(d => Number(d.value || 0))
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)

  const innerW = width - padX * 2
  const innerH = height - padY * 2

  const n = data.length
  const xStep = n <= 1 ? 0 : innerW / (n - 1)

  const scaleY = (v: number) => {
    if (max === min) return padY + innerH / 2
    const t = (v - min) / (max - min)
    return padY + (1 - t) * innerH
  }

  const points = data
    .map((d, i) => {
      const x = padX + i * xStep
      const y = scaleY(Number(d.value || 0))
      return `${clamp(x, padX, width - padX)},${clamp(y, padY, height - padY)}`
    })
    .join(' ')

  const area = points
    ? `${points} ${padX + (n - 1) * xStep},${height - padY} ${padX},${height - padY}`
    : ''

  const first = data[0]?.date
  const last = data[data.length - 1]?.date
  const maxLabel = `${max.toLocaleString()}${valueSuffix ?? ''}`

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <div className="tabular-nums">{fmtDateShort(first)}</div>
        <div className="tabular-nums">{data.length ? maxLabel : ''}</div>
        <div className="tabular-nums">{fmtDateShort(last)}</div>
      </div>
      <div
        className={[
          'mt-2 overflow-hidden rounded-[18px] border border-white/70 backdrop-blur-xl ring-1 ring-black/[0.03]',
          placeholder ? 'bg-slate-50/70' : 'bg-white/60',
        ].join(' ')}
      >
        {data.length === 0 ? (
          <ChartEmptyState
            title={emptyTitle}
            message={emptyMessage}
            placeholder={placeholder}
          />
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="block h-[140px] w-full"
            role="img"
          >
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fill} />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <polyline
              points={`${padX},${height - padY} ${width - padX},${height - padY}`}
              fill="none"
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="1"
            />
            <polyline
              points={`${padX},${height / 2} ${width - padX},${height / 2}`}
              fill="none"
              stroke="rgba(148,163,184,0.16)"
              strokeWidth="1"
            />
            {area ? (
              <polygon points={area} fill="url(#chartFill)" stroke="none" />
            ) : null}
            <polyline
              points={points}
              fill="none"
              stroke={stroke}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </div>
  )
}

export function MultiLineChart({
  series,
  height = 160,
  emptyTitle = 'No data available',
  emptyMessage = 'Tracked model activity will appear here once attribution is available.',
  placeholder = false,
}: {
  series: { name: string; data: Point[]; stroke: string }[]
  height?: number
  emptyTitle?: string
  emptyMessage?: string
  placeholder?: boolean
}) {
  const width = 520
  const padX = 18
  const padY = 14

  const all = series.flatMap(s => s.data)
  const values = all.map(d => Number(d.value || 0))
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)

  const innerW = width - padX * 2
  const innerH = height - padY * 2

  const n = Math.max(...series.map(s => s.data.length), 0)
  const xStep = n <= 1 ? 0 : innerW / (n - 1)

  const scaleY = (v: number) => {
    if (max === min) return padY + innerH / 2
    const t = (v - min) / (max - min)
    return padY + (1 - t) * innerH
  }

  const first = series[0]?.data?.[0]?.date
  const last = series[0]?.data?.[series[0]?.data.length - 1]?.date

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {series.map(s => (
            <div key={s.name} className="inline-flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.stroke }}
              />
              <span>{s.name}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-slate-500 tabular-nums">
          {all.length ? `${fmtDateShort(first)} to ${fmtDateShort(last)}` : ''}
        </div>
      </div>
      <div
        className={[
          'mt-2 overflow-hidden rounded-[18px] border border-white/70 backdrop-blur-xl ring-1 ring-black/[0.03]',
          placeholder ? 'bg-slate-50/70' : 'bg-white/60',
        ].join(' ')}
      >
        {all.length === 0 ? (
          <ChartEmptyState
            title={emptyTitle}
            message={emptyMessage}
            placeholder={placeholder}
          />
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="block h-[160px] w-full"
            role="img"
          >
            <polyline
              points={`${padX},${height - padY} ${width - padX},${height - padY}`}
              fill="none"
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="1"
            />
            <polyline
              points={`${padX},${height / 2} ${width - padX},${height / 2}`}
              fill="none"
              stroke="rgba(148,163,184,0.16)"
              strokeWidth="1"
            />
            {series.map(s => {
              const pts = s.data
                .map((d, i) => {
                  const x = padX + i * xStep
                  const y = scaleY(Number(d.value || 0))
                  return `${clamp(x, padX, width - padX)},${clamp(y, padY, height - padY)}`
                })
                .join(' ')
              return (
                <polyline
                  key={s.name}
                  points={pts}
                  fill="none"
                  stroke={s.stroke}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
