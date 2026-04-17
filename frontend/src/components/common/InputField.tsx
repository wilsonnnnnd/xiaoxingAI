import React, { forwardRef } from 'react'

interface InputFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>,
    'onChange'
  > {
  label: string
  multi?: boolean
  rows?: number
  error?: string
  required?: boolean
  onChange?: (value: string) => void
}

export const InputField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputFieldProps
>(
  (
    {
      label,
      multi = false,
      rows = 5,
      error,
      required,
      className = '',
      onChange,
      ...props
    },
    ref
  ) => {
    const baseCls = [
      'w-full relative',
      'rounded-2xl',

      // 🌫️ glass base（统一 Card）
      'bg-white/70 backdrop-blur-xl',

      // 🧱 边框（非常轻）
      error
        ? 'border border-red-300/70'
        : 'border border-white/70 ring-1 ring-black/[0.03]',

      // ✍️ 文字系统
      'text-slate-900 placeholder:text-slate-400',

      // 📐 spacing
      'px-3.5 py-2.5 text-[14px]',

      // 🎯 focus（重点）
      'outline-none transition-all duration-200',
      error
        ? 'focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
        : 'focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30',

      // 🌑 subtle shadow（不要重）
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_0_0_0.5px_rgba(15,23,42,0.04)]',

      'disabled:opacity-50 disabled:cursor-not-allowed',
    ].join(' ')

    return (
      <div className={`flex flex-col gap-1.5 w-full ${className}`}>
        {/* Label */}
        <label className="text-[11px] tracking-[0.18em] uppercase text-slate-500">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {/* Input Wrapper（用于光效） */}
        <div className="relative group">
          {/* ✨ 顶部高光线（和 Card / Button 一致） */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent rounded-2xl" />

          {/* 🌫️ 内部柔光 */}
          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.25),rgba(255,255,255,0.05)_50%,rgba(255,255,255,0)_100%)]" />

          {multi ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              rows={rows}
              className={`${baseCls} resize-none`}
              onChange={onChange ? (e) => onChange(e.target.value) : undefined}
              {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className={baseCls}
              onChange={onChange ? (e) => onChange(e.target.value) : undefined}
              {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
            />
          )}

          {/* 💡 hover 微光（很弱） */}
          <span className="pointer-events-none absolute right-[-20px] top-[-20px] h-20 w-20 rounded-full bg-white/40 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>

        {/* Error */}
        {error && (
          <span className="text-[11px] text-red-500 mt-0.5">{error}</span>
        )}
      </div>
    )
  }
)

InputField.displayName = 'InputField'