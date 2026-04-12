import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const variants = {
    success: 'bg-[#052e16] border-[#166534] text-[#86efac]',
    error: 'bg-[#7f1d1d] border-[#ef4444] text-[#fca5a5]',
    warning: 'bg-[#451a03] border-[#92400e] text-[#fcd34d]',
    info: 'bg-[#1e3a8a] border-[#1d4ed8] text-[#bfdbfe]',
    neutral: 'bg-[#0b0e14] border-[#2d3748] text-[#64748b]',
  }

  return (
    <div className={`px-3 py-1.5 rounded-lg text-xs border ${variants[variant]} ${className}`}>
      {children}
    </div>
  )
}
