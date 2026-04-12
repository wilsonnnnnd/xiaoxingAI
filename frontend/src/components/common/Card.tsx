import React from 'react'

interface CardProps {
  title: string
  badge?: string
  full?: boolean
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ title, badge, full, children }) => {
  return (
    <div className={`bg-[#1e2330] border border-[#2d3748] rounded-xl p-5 flex flex-col gap-3${full ? ' col-span-full' : ''}`}>
      <h2 className="text-sm font-semibold text-[#cbd5e1] flex items-center gap-2 flex-wrap">
        {title}
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1d4ed8] text-[#bfdbfe]">
            {badge}
          </span>
        )}
      </h2>
      {children}
    </div>
  )
}
