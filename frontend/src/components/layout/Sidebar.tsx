import React, { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../../i18n/useI18n'
import type { AuthUser } from '../../types'
import { NAV_CONFIG } from '../../constants/navigation'
import { LanguageToggle } from './LanguageToggle'
import { NavItem } from './NavItem'

interface SidebarProps {
  me: AuthUser | null | undefined
  className?: string
  onNavigate?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ me, className = 'w-60 shrink-0', onNavigate }) => {
  const { t } = useI18n()
  const [skillOpen, setSkillOpen] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  const skillRef = useRef<HTMLDivElement | null>(null)
  const isAdmin = me?.role === 'admin'
  const isAuthed = !!localStorage.getItem('auth_token')

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (skillRef.current && !skillRef.current.contains(e.target as Node)) {
        setSkillOpen(false)
      }
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    window.location.href = '/home'
  }

  return (
    <aside className={`${className} flex flex-col bg-[#050b16] border-r border-[#1f2a3a] transition-width duration-200`}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#111827]">
        <div className="w-10 h-10 rounded-full bg-white p-0.5 shrink-0 flex items-center justify-center">
          {imgOk ? (
            <img
              src="/xiaoxing_icon.png"
              alt="Xiaoxing"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement
                if (img.dataset.fallback === '1') {
                  setImgOk(false)
                  return
                }
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><defs><linearGradient id='g' x1='0' x2='1' y1='0' x2='1'><stop offset='0' stop-color='%2360a5fa'/><stop offset='1' stop-color='%237c3aed'/></linearGradient></defs><rect width='100%' height='100%' rx='16' fill='url(%23g)'/><text x='50%' y='55%' font-size='36' text-anchor='middle' fill='white' font-family='sans-serif'>小</text></svg>`
                img.dataset.fallback = '1'
                img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
              }}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-[#60a5fa] to-[#7c3aed] flex items-center justify-center text-white font-bold text-sm">小</div>
          )}
        </div>
        <div className="min-w-0 overflow-hidden">
          <div className="text-base font-semibold text-[#e2e8f0] truncate">{t('app.brand')}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5 truncate">{t('sidebar.small')}</div>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="ml-auto md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[#94a3b8] hover:bg-[#0b1220] hover:text-[#e2e8f0] transition-colors"
            aria-label={t('a11y.close_navigation')}
          >
            ✕
          </button>
        )}
      </div>

      {/* User Info */}
      {me && (
        <div className="px-4 py-3 border-b border-[#111827] flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#60a5fa] to-[#7c3aed] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {me.email[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-xs text-[#e2e8f0] truncate">{me.email}</div>
            <div className="text-[10px] text-[#64748b] mt-0.5">
              {isAdmin ? t('sidebar.role.admin') : t('sidebar.role.user')}
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto flex flex-col gap-1 px-2 pr-3" aria-label={t('a11y.primary_navigation')}>
        {NAV_CONFIG.filter(({ adminOnly }) => !adminOnly || isAdmin)
          .filter(({ to }) => (isAuthed ? true : to === '/home' || to === '/help' || to === '/privacy' || to === '/terms'))
          .map(({ to, key, end }) => {
          if (key === 'nav.skill') {
            if (!isAuthed) return null
            return (
              <div key="skill" className="relative" ref={skillRef}>
                <button
                  type="button"
                  onClick={() => setSkillOpen(v => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors duration-150 ease-in-out ${skillOpen ? 'bg-[#3b82f6] text-white font-medium' : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]'}`}
                  aria-haspopup="menu"
                  aria-expanded={skillOpen}
                  aria-controls="nav-skill-menu"
                >
                  <span className="flex items-center gap-2">{t('nav.skill')}</span>
                  <span className="text-xs text-[#94a3b8]">{skillOpen ? '▾' : '▸'}</span>
                </button>
                {skillOpen && (
                  <div id="nav-skill-menu" role="menu" className="mt-1 ml-2 bg-[#071025] border border-[#213347] rounded-md p-1 z-50 shadow-lg">
                    <NavLink
                      to="/skill/gmail"
                      onClick={() => {
                        setSkillOpen(false)
                        onNavigate?.()
                      }}
                      role="menuitem"
                      className={({ isActive }) =>
                        `block px-3 py-1 rounded text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617] ${isActive ? 'bg-[#071023] text-white font-semibold' : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]'}`
                      }
                    >
                      {t('nav.skill.gmail')}
                    </NavLink>
                  </div>
                )}
              </div>
            )
          }
          return <NavItem key={to} to={to} translationKey={key} end={end} onClick={onNavigate} />
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#111827] flex flex-col gap-2">
        <div className="flex items-center justify-center gap-4 text-[11px] text-[#64748b]">
          <NavLink
            to="/privacy"
            onClick={onNavigate}
            className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617] rounded"
          >
            {t('nav.privacy')}
          </NavLink>
          <NavLink
            to="/terms"
            onClick={onNavigate}
            className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617] rounded"
          >
            {t('nav.terms')}
          </NavLink>
        </div>
        <LanguageToggle />
        {isAuthed ? (
          <button
            onClick={handleLogout}
            className="w-full py-2 rounded-md text-xs text-[#94a3b8] hover:bg-[#0b1220] hover:text-[#fca5a5] transition-colors duration-200"
          >
            {t('btn.logout')}
          </button>
        ) : (
          <NavLink
            to="/login"
            onClick={onNavigate}
            className="w-full py-2 rounded-md text-xs text-center text-[#94a3b8] hover:bg-[#0b1220] hover:text-[#e2e8f0] transition-colors duration-200"
          >
            {t('btn.login')}
          </NavLink>
        )}
      </div>
    </aside>
  )
}
