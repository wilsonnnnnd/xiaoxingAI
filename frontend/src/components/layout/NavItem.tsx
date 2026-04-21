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
        [
          'group flex items-center gap-3 px-3 py-2.5 rounded-[18px]',
          'text-[13px] font-medium tracking-[-0.01em]',
          'transition-all duration-200 ease-out',

          // 🔹 默认态
          'text-slate-600',

          // 🔹 hover（非常轻）
          'hover:bg-white/70 hover:text-slate-900',

          // 🔹 active（统一成 skill 风格）
          isActive
            ? [
                'bg-[linear-gradient(180deg,rgba(234,244,255,0.96)_0%,rgba(223,238,255,0.96)_100%)]',
                'text-[#0b3c5d]',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_12px_rgba(15,23,42,0.04)]',
              ].join(' ')
            : '',

          // 🔹 focus（统一）
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white',

          className,
        ].join(' ')
      }
    >
      <span className="truncate">{t(translationKey)}</span>
    </NavLink>
  )
}