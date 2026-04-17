import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMe, updateUser } from '../features/users/api'
import { Sidebar } from './layout/Sidebar'
import { useI18n } from '../i18n/useI18n'
import { legalPolicyVersion } from '../pages/legalContent'

export default function Layout() {
  const location = useLocation()
  const { t, lang, setLang } = useI18n()
  const token = localStorage.getItem('auth_token')
  const isPublic =
    location.pathname === '/' ||
    location.pathname === '/home' ||
    location.pathname === '/help' ||
    location.pathname === '/privacy' ||
    location.pathname === '/terms' ||
    location.pathname === '/oauth/complete'

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [legalNoticeOpen, setLegalNoticeOpen] = useState(() => {
    try {
      return localStorage.getItem('legal_policy_ack') !== legalPolicyVersion
    } catch {
      return true
    }
  })

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 120_000,
    enabled: !!token && location.pathname !== '/oauth/complete',
  })

  useEffect(() => {
    const serverLang =
      me?.ui_lang === 'zh' || me?.ui_lang === 'en' ? me.ui_lang : null

    if (serverLang && serverLang !== lang) {
      setLang(serverLang)
    }
  }, [me, lang, setLang])

  useEffect(() => {
    const serverLang =
      me?.ui_lang === 'zh' || me?.ui_lang === 'en' ? me.ui_lang : null
    const id = me?.id

    if (!id || !token) return
    if (serverLang && serverLang === lang) return
    if (lang !== 'en' && lang !== 'zh') return

    updateUser(Number(id), { ui_lang: lang }).catch(() => {})
  }, [me, lang, token])

  useEffect(() => {
    if (!sidebarOpen) return

    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = original
    }
  }, [sidebarOpen])

  if (!token && !isPublic) {
    return <Navigate to="/login" replace />
  }

  return (
    <div
      className={[
        'relative min-h-screen',
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,252,255,0.96)_52%,rgba(246,249,253,0.95)_100%)]',
      ].join(' ')}
    >
      {/* page ambient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.42),transparent_70%)]" />
      </div>

      <a
        href="#main-content"
        className={[
          'sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[70]',
          'rounded-full px-3 py-2 text-sm',
          'border border-white/80 bg-white/90 backdrop-blur-xl',
          'text-slate-700 ring-1 ring-black/[0.03]',
          'shadow-[0_8px_24px_rgba(15,23,42,0.04)]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.95)] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        ].join(' ')}
      >
        {t('a11y.skip_to_content')}
      </a>

      <div className="relative flex min-h-screen">
        {/* desktop sidebar */}
        <div className="hidden shrink-0 md:flex md:sticky md:top-0 md:h-screen">
          <Sidebar me={me} />
        </div>

        {/* mobile drawer */}
        <div
          className={`fixed inset-0 z-40 md:hidden ${
            sidebarOpen ? '' : 'pointer-events-none'
          }`}
        >
          <div
            className={`absolute inset-0 bg-[rgba(15,23,42,0.14)] backdrop-blur-[2px] transition-opacity duration-200 ${
              sidebarOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />

          <div
            className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] transform transition-transform duration-200 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            role="dialog"
            aria-modal="true"
            aria-label={t('a11y.navigation_drawer')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSidebarOpen(false)
            }}
          >
            <Sidebar
              me={me}
              className="h-full w-full"
              onNavigate={() => setSidebarOpen(false)}
            />
          </div>
        </div>

        {/* content area */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {legalNoticeOpen && (
            <div className="px-4 pt-4 sm:px-6 lg:px-8">
              <div
                className={[
                  'mx-auto flex w-full max-w-6xl items-start justify-between gap-3 rounded-[22px] px-4 py-3 sm:px-5',
                  'border border-white/75 bg-white/76 backdrop-blur-xl',
                  'ring-1 ring-black/[0.03]',
                  'shadow-[0_8px_24px_rgba(15,23,42,0.04)]',
                ].join(' ')}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {t('legal.notice_title')}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">
                    {t('legal.notice_body')}{' '}
                    <Link
                      to="/privacy"
                      className="text-[#0b3c5d] underline decoration-[rgba(217,235,255,0.95)] underline-offset-4"
                    >
                      {t('nav.privacy')}
                    </Link>
                    .
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem(
                        'legal_policy_ack',
                        legalPolicyVersion
                      )
                    } catch {
                      void 0
                    }
                    setLegalNoticeOpen(false)
                  }}
                  className={[
                    'shrink-0 rounded-full px-3 py-2 text-xs font-semibold',
                    'border border-white/80 bg-[rgba(217,235,255,0.9)] text-[#0b3c5d]',
                    'ring-1 ring-black/[0.03]',
                    'shadow-[0_8px_20px_rgba(15,23,42,0.04)]',
                    'transition-all duration-200 hover:brightness-[1.02]',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.95)] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  ].join(' ')}
                >
                  {t('legal.notice_ack')}
                </button>
              </div>
            </div>
          )}

          {/* mobile top bar */}
          <div className="sticky top-0 z-30 border-b border-white/60 bg-white/62 backdrop-blur-xl md:hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  'border border-white/75 bg-white/78 backdrop-blur-xl',
                  'text-slate-700 ring-1 ring-black/[0.03]',
                  'shadow-[0_6px_18px_rgba(15,23,42,0.04)]',
                  'transition-all duration-200 hover:bg-white/86',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.95)] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                ].join(' ')}
                aria-label={t('a11y.open_navigation')}
              >
                ☰
              </button>

              <div className="min-w-0 flex-1 text-center">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {t('app.brand')}
                </div>
              </div>

              <div className="h-10 w-10" />
            </div>
          </div>

          <main
            id="main-content"
            tabIndex={-1}
            className="relative min-w-0 flex-1 focus:outline-none"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}