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
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, required, className = '', ...props }, ref) => {
    const baseCls = 'w-full bg-[#0b0e14] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] outline-none focus:border-[#6366f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    const errorCls = error ? 'border-[#ef4444]' : ''

    return (
      <div className={`flex flex-col gap-1 w-full ${className}`}>
        {label && (
          <label className="text-xs text-[#94a3b8]">
            {label}
            {required && <span className="text-[#ef4444] ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={`${baseCls} ${errorCls}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-[10px] text-[#ef4444]">{error}</span>}
      </div>
    )
  }
)

Select.displayName = 'Select'
