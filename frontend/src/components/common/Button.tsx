import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'telegram'
  loading?: boolean
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  loading, 
  disabled, 
  className = '',
  ...props 
}) => {
  const baseCls = "px-4 py-1.5 text-sm font-semibold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
  const variantCls = variant === 'telegram' ? 'bg-[#0088cc] hover:bg-[#006fa8] active:bg-[#005f90]' : 'bg-[#6366f1] hover:bg-[#4f46e5] active:bg-[#4338ca]'
  
  return (
    <button
      disabled={disabled || loading}
      className={`${baseCls} ${variantCls} ${className}`}
      {...props}
    >
      {children}
      {loading && <span className="ml-2 text-xs">…</span>}
    </button>
  )
}
