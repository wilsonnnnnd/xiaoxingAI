import React, { forwardRef } from 'react'

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string
  error?: string
  onChange?: (checked: boolean) => void
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, error, className = '', onChange, ...props }, ref) => {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <label className="flex items-center gap-3 cursor-pointer group w-fit">
          <div className="relative">
            <input
              ref={ref}
              type="checkbox"
              className="sr-only"
              onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
              {...props}
            />
            <div
              className={`block w-10 h-6 rounded-full transition-colors ${
                props.checked ? 'bg-[#3b82f6]' : 'bg-[#2d3748]'
              } ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <div
              className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                props.checked ? 'translate-x-4' : ''
              }`}
            />
          </div>
          {label && (
            <span className="text-sm text-[#e2e8f0] group-hover:text-white transition-colors">
              {label}
            </span>
          )}
        </label>
        {error && <span className="text-[10px] text-[#ef4444]">{error}</span>}
      </div>
    )
  }
)

Switch.displayName = 'Switch'
