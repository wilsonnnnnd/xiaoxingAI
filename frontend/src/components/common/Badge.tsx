import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
}) => {
  const variants = {
    success:
      'bg-emerald-50/80 text-emerald-700 border-emerald-200/70',

    error:
      'bg-red-50/80 text-red-700 border-red-200/70',

    warning:
      'bg-amber-50/80 text-amber-700 border-amber-200/70',

    info:
      'bg-sky-50/80 text-sky-700 border-sky-200/70',

    neutral:
      'bg-slate-100/70 text-slate-600 border-slate-200/70',
  }

  return (
    <div
      className={[
        'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-[-0.01em]',
        'border backdrop-blur-md',

        // ✨ subtle structure（和 Input 一致）
        'ring-1 ring-black/[0.03]',

        // 🌫️ 轻高光（和 Button / Card 一致）
        'relative overflow-hidden',
        variants[variant],
        className,
      ].join(' ')}
    >
      {/* 顶部柔光 */}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.35),rgba(255,255,255,0.08)_50%,rgba(255,255,255,0)_100%)]" />

      <span className="relative">{children}</span>
    </div>
  )
}