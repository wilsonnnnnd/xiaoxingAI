import React from 'react'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../../i18n/useI18n'

interface NavItemProps {
  to: string
  translationKey: string
  className?: string
  end?: boolean
  onClick?: () => void
}

export const NavItem: React.FC<NavItemProps> = ({
  to,
  translationKey,
  className = '',
  end,
  onClick,
}) => {
  const { t } = useI18n()

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 ease-in-out 
        focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white
        ${
          isActive
            // ✅ 激活状态（浅蓝 + 深色字）
            ? 'bg-[rgba(217,235,255,0.9)] text-[#0b3c5d] font-semibold border-l-4 border-sky-300 pl-3'
            // ✅ 未激活（轻灰 + 轻 hover）
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        } ${className}`
      }
    >
      {t(translationKey)}
    </NavLink>
  )
}