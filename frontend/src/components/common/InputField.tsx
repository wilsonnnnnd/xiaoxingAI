import React, { forwardRef } from 'react'

interface InputFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'onChange'> {
  label: string
  multi?: boolean
  rows?: number
  error?: string
  required?: boolean
  onChange?: (value: string) => void
}

export const InputField = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputFieldProps>(
  ({ label, multi = false, rows = 5, error, required, className = '', onChange, ...props }, ref) => {
    const cls = `w-full bg-[#0b0e14] border ${
      error ? 'border-[#ef4444]' : 'border-[#2d3748]'
    } rounded-lg px-3 py-2 text-sm text-[#e2e8f0] outline-none placeholder:text-[#475569] focus:border-[#60a5fa] focus:ring-2 focus:ring-[#60a5fa]/20 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed`

    return (
      <div className={`flex flex-col gap-1 w-full ${className}`}>
        <label className="text-xs text-[#94a3b8]">
          {label}
          {required && <span className="text-[#ef4444] ml-1">*</span>}
        </label>
        {multi ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            className={cls}
            rows={rows}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            className={cls}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
        {error && <span className="text-[10px] text-[#ef4444]">{error}</span>}
      </div>
    )
  }
)

InputField.displayName = 'InputField'
