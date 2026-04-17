import React from 'react'

type CardProps = {
  title?: string
  subtitle?: string
  children?: React.ReactNode
  rightSlot?: React.ReactNode
  footer?: React.ReactNode
  interactive?: boolean
}

export function Card({
  title,
  subtitle,
  children,
  rightSlot,
  footer,
  interactive = true,
}: CardProps) {
  return (
    <div
      className={[
        'group relative rounded-[24px]',
        // ✅ glass base
        'bg-white/70 backdrop-blur-xl',
        'border border-white/70',
        'ring-1 ring-black/[0.03]',
        // ✅ spacing
        'p-5 sm:p-6',
        // ✅ soft shadow（更轻）
        'shadow-[0_8px_24px_rgba(15,23,42,0.04)]',
        // ✅ subtle highlight（Apple感）
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.35),rgba(255,255,255,0.1)_40%,transparent)]',
        // ✅ interaction（非常克制）
        interactive
          ? 'transition-all duration-200 hover:bg-white/80'
          : '',
      ].join(' ')}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        {(title || rightSlot) && (
          <div className="flex items-start justify-between gap-4">
            <div>
              {subtitle && (
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  {subtitle}
                </div>
              )}

              {title && (
                <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-900">
                  {title}
                </h3>
              )}
            </div>

            {rightSlot && <div>{rightSlot}</div>}
          </div>
        )}

        {/* Body */}
        {children && (
          <div className="mt-5 text-sm leading-7 text-slate-600">
            {children}
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/60 pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}