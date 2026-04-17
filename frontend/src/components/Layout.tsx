import { useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '../features/users/api'
import { Sidebar } from './layout/Sidebar'
import { useI18n } from '../i18n/useI18n'
import { legalPolicyVersion } from '../pages/legalContent'

export default function Layout() {
  const location = useLocation()
  const { t } = useI18n()
  const token = localStorage.getItem('auth_token')
  const isPublic = location.pathname === '/' || location.pathname === '/home' || location.pathname === '/help' || location.pathname === '/privacy' || location.pathname === '/terms'
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
    enabled: !!token,
  })

  if (!token && !isPublic) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 bg-[#0b1220] text-white border border-[#1f2a3a] rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
      >
        {t('a11y.skip_to_content')}
      </a>
      <div className="hidden md:flex">
        <Sidebar me={me} />
      </div>

      <div className={`fixed inset-0 z-40 md:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
        <div
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          aria-label={t('a11y.navigation_drawer')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSidebarOpen(false)
          }}
        >
          <Sidebar me={me} className="w-full h-full" onNavigate={() => setSidebarOpen(false)} />
        </div>
      </div>

      <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto bg-[#0f172a] flex flex-col min-w-0 focus:outline-none">
        {legalNoticeOpen && (
          <div className="px-4 py-3 border-b border-[#1f2a3a] bg-[#0b1220]">
            <div className="max-w-5xl mx-auto w-full flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{t('legal.notice_title')}</div>
                <div className="text-xs text-[#94a3b8] mt-1 leading-5">
                  {t('legal.notice_body')}{' '}
                  <Link to="/privacy" className="text-[#60a5fa] hover:underline">
                    {t('nav.privacy')}
                  </Link>
                  .
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('legal_policy_ack', legalPolicyVersion)
                  } catch {
                    void 0
                  }
                  setLegalNoticeOpen(false)
                }}
                className="shrink-0 px-3 py-2 rounded-lg bg-[#0f172a] border border-[#1f2a3a] hover:border-[#334155] text-[#e2e8f0] text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
              >
                {t('legal.notice_ack')}
              </button>
            </div>
          </div>
        )}
        <div className="md:hidden sticky top-0 z-30 bg-[#0f172a]/80 backdrop-blur-md border-b border-[#1f2a3a]">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[#e2e8f0] bg-[#0b1220] border border-[#1f2a3a] hover:bg-[#111827] transition-colors"
              aria-label={t('a11y.open_navigation')}
            >
              ☰
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-sm font-semibold text-[#e2e8f0] truncate">{t('app.brand')}</div>
            </div>
            <div className="w-10 h-10" />
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
