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

export const NavItem: React.FC<NavItemProps> = ({ to, translationKey, className = '', end, onClick }) => {
  const { t } = useI18n()
  
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 ease-in-out ${
          isActive 
            ? 'bg-[#071023] text-white font-semibold border-l-4 border-[#60a5fa] pl-3' 
            : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]'
        } ${className}`
      }
    >
      {t(translationKey)}
    </NavLink>
  )
}
