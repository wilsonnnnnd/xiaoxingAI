import React, { forwardRef } from 'react'

interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string
  error?: string
  onChange?: (checked: boolean) => void
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, error, className = '', onChange, checked, disabled, ...props }, ref) => {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <label
          className={`flex items-center gap-3 group ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
        >
          <div className="relative">
            <input
              ref={ref}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              className="peer sr-only"
              onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
              {...props}
            />

            {/* Track */}
            <div
              className={[
                'w-11 h-6 rounded-full transition-all duration-300',

                // 🌫️ glass base
                checked
                  ? 'bg-[rgba(190,220,255,0.95)]'
                  : 'bg-white/60 backdrop-blur-xl',

                // 🧱 subtle structure
                checked
                  ? 'border border-sky-300/80'
                  : 'border border-white/70 ring-1 ring-black/[0.03]',

                // 🌑 shadow
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_0_0.5px_rgba(15,23,42,0.04)]',

                // hover 微变化
                'group-hover:ring-black/[0.05]',
              ].join(' ')}
            />

            {/* Thumb */}
            <div
              className={[
                'absolute top-1 left-1 h-4 w-4 rounded-full',
                'transition-all duration-300',

                // 🎯 移动
                checked ? 'translate-x-5' : 'translate-x-0',

                // 🎨 颜色
                checked
                  ? 'bg-white'
                  : 'bg-white',

                // 🌑 阴影（关键质感）
                'shadow-[0_2px_6px_rgba(15,23,42,0.15),inset_0_1px_0_rgba(255,255,255,0.9)]',

                // ✨ 微缩放（更有“弹性”）
                'peer-active:scale-95',
              ].join(' ')}
            />

            {/* ✨ 顶部高光 */}
            <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.35),rgba(255,255,255,0.08)_50%,rgba(255,255,255,0)_100%)]" />
          </div>

          {/* Label */}
          {label && (
            <span className="text-[14px] text-slate-700 transition-colors group-hover:text-slate-900">
              {label}
            </span>
          )}
        </label>

        {/* Error */}
        {error && <span className="text-[11px] text-red-500">{error}</span>}
      </div>
    )
  }
)

Switch.displayName = 'Switch'