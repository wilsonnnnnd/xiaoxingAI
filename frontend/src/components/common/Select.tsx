import React, { forwardRef } from 'react'

interface Option {
  label: string
  value: string | number
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: Option[]
  error?: string
  required?: boolean
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      error,
      required,
      className = '',
      placeholder,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const baseCls = [
      'w-full appearance-none relative',
      'rounded-2xl',
      'bg-white/78 backdrop-blur-xl',
      error
        ? 'border border-red-300/70'
        : 'border border-white/70 ring-1 ring-black/[0.03] hover:ring-black/[0.05]',
      'text-slate-900',
      'px-4 pr-11 py-2.5 text-[14px]',
      'outline-none transition-all duration-200',
      error
        ? 'focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
        : 'focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_0_0_0.5px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]',
      'disabled:opacity-50 disabled:cursor-not-allowed',
    ].join(' ')

    const hasPlaceholder = Boolean(placeholder)
    const isEmpty =
      hasPlaceholder &&
      (value === '' ||
        value === undefined ||
        value === null ||
        defaultValue === '')

    return (
      <div className={`flex w-full flex-col gap-1.5 ${className}`}>
        {label && (
          <label className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}

        <div className="group relative">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-2xl bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.06)_50%,rgba(255,255,255,0)_100%)]" />

          <select
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            className={`${baseCls} ${isEmpty ? 'text-slate-400' : 'text-slate-900'}`}
            {...props}
          >
            {hasPlaceholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}

            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                className="bg-white text-slate-900"
              >
                {opt.label}
              </option>
            ))}
          </select>

          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <span className="rounded-full border border-white/60 bg-white/55 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all duration-200 group-hover:bg-white/75">
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                className="text-slate-500"
              >
                <path
                  d="M6 8l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>

          <span className="pointer-events-none absolute right-[-18px] top-[-18px] h-16 w-16 rounded-full bg-white/40 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>

        {error && <span className="mt-0.5 text-[11px] text-red-500">{error}</span>}
      </div>
    )
  }
)

Select.displayName = 'Select'