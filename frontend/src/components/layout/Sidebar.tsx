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

export const Sidebar: React.FC<SidebarProps> = ({
  me,
  className = 'w-60 shrink-0',
  onNavigate,
}) => {
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
    <aside
      className={[
        className,
        'relative flex flex-col overflow-hidden',
        'border-r border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(217,235,255,0.42),transparent_26%),radial-gradient(circle_at_85%_12%,rgba(224,238,255,0.34),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,252,255,0.96)_52%,rgba(246,249,253,0.95)_100%)]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_0_0_0.5px_rgba(15,23,42,0.04)]',
      ].join(' ')}
    >
      {/* top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />

      {/* soft glow */}
      <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-white/50 blur-3xl" />

      {/* Brand */}
      <div className="relative flex items-center gap-3 border-b border-slate-200/70 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_4px_12px_rgba(15,23,42,0.06)]">
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
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0' stop-color='%2393c5fd'/><stop offset='1' stop-color='%2360a5fa'/></linearGradient></defs><rect width='100%' height='100%' rx='16' fill='url(%23g)'/><text x='50%' y='55%' font-size='36' text-anchor='middle' fill='white' font-family='sans-serif'>小</text></svg>`
                img.dataset.fallback = '1'
                img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
              }}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-sky-400 text-sm font-bold text-white">
              小
            </div>
          )}
        </div>

        <div className="min-w-0 overflow-hidden">
          <div className="truncate text-base font-semibold tracking-[-0.02em] text-slate-950">
            {t('app.brand')}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500">
            {t('sidebar.small')}
          </div>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:hidden"
            aria-label={t('a11y.close_navigation')}
          >
            ✕
          </button>
        )}
      </div>

      {/* User Info */}
      {me && (
        <div className="relative flex items-center gap-3 border-b border-slate-200/70 px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-200/70 bg-[linear-gradient(180deg,rgba(224,238,255,0.95)_0%,rgba(217,235,255,0.95)_100%)] text-[11px] font-semibold text-[#0b3c5d] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.06)]">
            {me.email[0].toUpperCase()}
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="truncate text-xs text-slate-800">{me.email}</div>
            <div className="mt-0.5 text-[10px] text-slate-500">
              {isAdmin ? t('sidebar.role.admin') : t('sidebar.role.user')}
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pr-3 py-4"
        aria-label={t('a11y.primary_navigation')}
      >
        {NAV_CONFIG.filter(({ adminOnly }) => !adminOnly || isAdmin)
          .filter(({ to }) =>
            isAuthed
              ? true
              : to === '/home' || to === '/help' || to === '/privacy' || to === '/terms'
          )
          .map(({ to, key, end }) => {
            if (key === 'nav.skill') {
              if (!isAuthed) return null

              return (
                <div key="skill" className="relative" ref={skillRef}>
                  <button
                    type="button"
                    onClick={() => setSkillOpen((v) => !v)}
                    className={[
                      'group relative flex w-full items-center justify-between overflow-hidden rounded-xl px-3 py-2 text-sm',
                      'transition-all duration-200 ease-out',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30',
                      'focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                      skillOpen
                        ? 'border border-sky-200/70 bg-[linear-gradient(180deg,rgba(224,238,255,0.92)_0%,rgba(217,235,255,0.92)_100%)] text-[#0b3c5d] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_2px_rgba(15,23,42,0.04)]'
                        : 'border border-transparent text-slate-500 hover:bg-slate-50/90 hover:text-slate-900',
                    ].join(' ')}
                    aria-haspopup="menu"
                    aria-expanded={skillOpen}
                    aria-controls="nav-skill-menu"
                  >
                    <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04)_50%,rgba(255,255,255,0)_100%)]" />

                    {skillOpen && (
                      <span className="pointer-events-none absolute inset-y-1 left-1 w-1 rounded-full bg-[linear-gradient(180deg,rgba(125,211,252,0.95),rgba(103,232,249,0.9))]" />
                    )}

                    <span className={`relative flex items-center gap-2 ${skillOpen ? 'pl-2' : ''}`}>
                      {t('nav.skill')}
                    </span>

                    <span className="relative text-xs text-slate-400">
                      {skillOpen ? '▾' : '▸'}
                    </span>
                  </button>

                  {skillOpen && (
                    <div
                      id="nav-skill-menu"
                      role="menu"
                      className="mt-2 ml-3 overflow-hidden rounded-2xl border border-white/75 bg-white/80 p-1.5 backdrop-blur-xl shadow-[0_12px_36px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)]"
                    >
                      <NavLink
                        to="/skill/gmail"
                        onClick={() => {
                          setSkillOpen(false)
                          onNavigate?.()
                        }}
                        role="menuitem"
                        className={({ isActive }) =>
                          [
                            'block rounded-xl px-3 py-2 text-sm transition-all duration-200',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30',
                            'focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                            isActive
                              ? 'bg-[rgba(217,235,255,0.92)] text-[#0b3c5d] font-semibold'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                          ].join(' ')
                        }
                      >
                        {t('nav.skill.gmail')}
                      </NavLink>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <NavItem
                key={to}
                to={to}
                translationKey={key}
                end={end}
                onClick={onNavigate}
              />
            )
          })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200/70 px-4 py-3">
        <div className="rounded-2xl border border-white/75 bg-white/62 p-3 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
            <NavLink
              to="/privacy"
              onClick={onNavigate}
              className="rounded transition-colors hover:text-slate-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {t('nav.privacy')}
            </NavLink>

            <NavLink
              to="/terms"
              onClick={onNavigate}
              className="rounded transition-colors hover:text-slate-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {t('nav.terms')}
            </NavLink>
          </div>

          <div className="mt-3">
            <LanguageToggle userId={me?.id} />
          </div>

          {isAuthed ? (
            <button
              onClick={handleLogout}
              className="mt-3 w-full rounded-xl border border-transparent py-2 text-xs text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {t('btn.logout')}
            </button>
          ) : (
            <NavLink
              to="/login"
              onClick={onNavigate}
              className="mt-3 block w-full rounded-xl border border-transparent py-2 text-center text-xs text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {t('btn.login')}
            </NavLink>
          )}
        </div>
      </div>
    </aside>
  )
}
