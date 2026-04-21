import React, { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n/useI18n'
import type { AuthUser } from '../../types'
import type { NavItem as NavConfigItem, NavSection } from '../../config/navigation'
import { filterNavByRole, NAV_ITEMS, NAV_SECTIONS } from '../../config/navigation'
import { LanguageToggle } from './LanguageToggle'
import { NavItem } from './NavItem'

interface SidebarProps {
  me: AuthUser | null | undefined
  className?: string
  onNavigate?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  me,
  className = 'w-64 shrink-0',
  onNavigate,
}) => {
  const { t } = useI18n()
  const [imgOk, setImgOk] = useState(true)
  const location = useLocation()
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})

  const isAdmin = me?.role === 'admin'
  const isAuthed = !!localStorage.getItem('auth_token')
  const role = isAdmin ? 'admin' : 'user'

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    window.location.href = '/home'
  }

  const sectionLabelKey = (s: NavSection) => {
    switch (s) {
      case 'main':
        return 'nav.section.main'
      case 'settings':
        return 'nav.section.settings'
      case 'admin':
        return 'nav.section.admin'
      case 'support':
        return 'nav.section.support'
      case 'legal':
        return 'nav.section.legal'
      default:
        return 'nav.section.main'
    }
  }

  const isPublicPath = (p: string) =>
    p === '/home' || p === '/help' || p === '/privacy' || p === '/terms'

  const navBySection = useMemo(() => {
    const items = filterNavByRole(NAV_ITEMS, role)
      .filter((x) => {
        if (isAuthed) return true
        if (x.path) return isPublicPath(x.path)
        if (x.children) return x.children.some((c) => c.path && isPublicPath(c.path))
        return false
      })
      .map((x) => {
        if (isAuthed) return x
        if (!x.children) return x
        const children = x.children.filter((c) => (c.path ? isPublicPath(c.path) : false))
        return { ...x, children: children.length > 0 ? children : undefined }
      })

    const map: Record<string, NavConfigItem[]> = {}
    for (const s of NAV_SECTIONS) map[s] = []
    for (const item of items) {
      const sec = item.section || 'main'
      map[sec] = [...(map[sec] || []), item]
    }
    return map as Record<NavSection, NavConfigItem[]>
  }, [isAuthed, role])

  const legalItems = navBySection.legal || []

  return (
    <aside
      className={[
        className,
        'relative flex flex-col overflow-hidden',
        'border-r border-white/70',
        'bg-[radial-gradient(circle_at_top_left,rgba(217,235,255,0.72),transparent_22%),radial-gradient(circle_at_88%_10%,rgba(232,242,255,0.7),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(250,252,255,0.9)_46%,rgba(246,250,255,0.94)_100%)]',
        'backdrop-blur-2xl',
        'shadow-[inset_-1px_0_0_rgba(255,255,255,0.65),inset_0_1px_0_rgba(255,255,255,0.75)]',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
      <div className="pointer-events-none absolute -left-12 top-[-32px] h-36 w-36 rounded-full bg-[rgba(217,235,255,0.5)] blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-white/50 blur-3xl" />

      <div className="relative px-4 pb-4 pt-5">
        <div className="rounded-[28px] border border-white/70 bg-[rgba(255,255,255,0.58)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(244,249,255,0.96)_100%)] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_18px_rgba(15,23,42,0.05)]">
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
                    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0' stop-color='%23cfe4ff'/><stop offset='1' stop-color='%2398c6ff'/></linearGradient></defs><rect width='100%' height='100%' rx='18' fill='url(%23g)'/><text x='50%' y='56%' font-size='35' text-anchor='middle' fill='%230b3c5d' font-family='sans-serif'>小</text></svg>`
                    img.dataset.fallback = '1'
                    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
                  }}
                  className="h-full w-full rounded-[14px] object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,rgba(217,235,255,1)_0%,rgba(183,214,255,1)_100%)] text-sm font-semibold text-[#0b3c5d]">
                  小
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-slate-950">
                {t('app.brand')}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">
                {t('sidebar.small')}
              </div>
            </div>

            {onNavigate && (
              <button
                type="button"
                onClick={onNavigate}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-2xl border border-white/70 bg-white/55 text-slate-500 transition-all duration-200 hover:bg-white/80 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:hidden"
                aria-label={t('a11y.close_navigation')}
              >
                ✕
              </button>
            )}
          </div>

          {me && (
            <div className="mt-4 rounded-[22px] border border-white/70 bg-[rgba(248,251,255,0.78)] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d8e9ff] bg-[linear-gradient(180deg,rgba(232,242,255,1)_0%,rgba(217,235,255,1)_100%)] text-[11px] font-semibold text-[#0b3c5d]">
                  {me.email[0].toUpperCase()}
                </div>

                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="truncate text-[12px] font-medium text-slate-800">
                    {me.email}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {isAdmin ? t('sidebar.role.admin') : t('sidebar.role.user')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <nav
        className="flex flex-1 flex-col overflow-y-auto px-3 pb-4"
        aria-label={t('a11y.primary_navigation')}
      >
        {NAV_SECTIONS.filter((s) => s !== 'legal').map((section) => {
          const items = navBySection[section] || []
          if (!items.length) return null

          return (
            <div key={section} className="mb-5">
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                {t(sectionLabelKey(section))}
              </div>

              <div className="space-y-1 rounded-[24px] border border-white/55 bg-[rgba(255,255,255,0.32)] p-2 backdrop-blur-md">
                {items.map((item) => {
                  const hasChildren = !!(item.children && item.children.length > 0)
                  const childActive = !!item.children?.some(
                    (c) => c.path && location.pathname.startsWith(c.path)
                  )
                  const isActive = item.path
                    ? location.pathname.startsWith(item.path)
                    : childActive
                  const isOpen = openIds[item.id] ?? isActive

                  if (!hasChildren) {
                    if (!item.path) return null
                    return (
                      <NavItem
                        key={item.id}
                        to={item.path}
                        translationKey={item.labelKey}
                        end={item.end}
                        onClick={onNavigate}
                      />
                    )
                  }

                  const toggleOpen = () =>
                    setOpenIds((prev) => ({ ...prev, [item.id]: !isOpen }))

                  return (
                    <div key={item.id} className="rounded-[18px]">
                      <NavLink
                        to={item.path || '#'}
                        onClick={(e) => {
                          if (!item.path) {
                            e.preventDefault()
                            toggleOpen()
                            return
                          }
                          onNavigate?.()
                        }}
                        className={() =>
                          [
                            'group flex items-center justify-between gap-3 rounded-[18px] px-3 py-2.5 text-[13px] transition-all duration-200',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                            isActive
                              ? 'bg-[linear-gradient(180deg,rgba(234,244,255,0.96)_0%,rgba(223,238,255,0.96)_100%)] text-[#0b3c5d] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_rgba(15,23,42,0.04)]'
                              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
                          ].join(' ')
                        }
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {t(item.labelKey)}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            toggleOpen()
                          }}
                          className={[
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
                            isActive
                              ? 'border-[#d7e8ff] bg-white/60 text-[#0b3c5d]'
                              : 'border-transparent bg-white/0 text-slate-400 group-hover:border-white/70 group-hover:bg-white/70 group-hover:text-slate-700',
                          ].join(' ')}
                          aria-label={isOpen ? 'Collapse' : 'Expand'}
                        >
                          <span
                            className={[
                              'text-[11px] transition-transform duration-200',
                              isOpen ? 'rotate-90' : 'rotate-0',
                            ].join(' ')}
                          >
                            ▸
                          </span>
                        </button>
                      </NavLink>

                      <div
                        className={[
                          'grid transition-all duration-300 ease-out',
                          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                        ].join(' ')}
                      >
                        <div className="overflow-hidden">
                          <div className="mt-1 space-y-1 pl-3">
                            {item.children?.map((c) => {
                              if (!c.path) return null
                              return (
                                <NavItem
                                  key={c.id}
                                  to={c.path}
                                  translationKey={c.labelKey}
                                  onClick={onNavigate}
                                  className="pl-7"
                                />
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="px-4 pb-4">
        <div className="rounded-[28px] border border-white/70 bg-[rgba(255,255,255,0.58)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          {!!legalItems.length && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
              {legalItems.map((x) =>
                x.path ? (
                  <NavLink
                    key={x.id}
                    to={x.path}
                    onClick={onNavigate}
                    className="rounded transition-colors duration-200 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    {t(x.labelKey)}
                  </NavLink>
                ) : null
              )}
            </div>
          )}

          <div className={legalItems.length ? 'mt-4' : ''}>
            <LanguageToggle userId={me?.id} />
          </div>

          {isAuthed ? (
            <button
              onClick={handleLogout}
              className="mt-4 w-full rounded-[18px] border border-white/70 bg-white/50 py-2.5 text-[12px] font-medium text-slate-600 transition-all duration-200 hover:bg-white/80 hover:text-rose-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {t('btn.logout')}
            </button>
          ) : (
            <NavLink
              to="/login"
              onClick={onNavigate}
              className="mt-4 block w-full rounded-[18px] border border-white/70 bg-white/50 py-2.5 text-center text-[12px] font-medium text-slate-600 transition-all duration-200 hover:bg-white/80 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {t('btn.login')}
            </NavLink>
          )}
        </div>
      </div>
    </aside>
  )
}