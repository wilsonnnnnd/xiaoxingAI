import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '../features/users/api'
import { Sidebar } from './layout/Sidebar'
import { useI18n } from '../i18n/useI18n'

export default function Layout() {
  const location = useLocation()
  const { t } = useI18n()
  const token = localStorage.getItem('auth_token')
  const isPublic = location.pathname === '/' || location.pathname === '/home' || location.pathname === '/help' || location.pathname === '/privacy' || location.pathname === '/terms'
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
      <div className="hidden md:flex">
        <Sidebar me={me} />
      </div>

      <div className={`fixed inset-0 z-40 md:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <Sidebar me={me} className="w-full h-full" onNavigate={() => setSidebarOpen(false)} />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto bg-[#0f172a] flex flex-col min-w-0">
        <div className="md:hidden sticky top-0 z-30 bg-[#0f172a]/80 backdrop-blur-md border-b border-[#1f2a3a]">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[#e2e8f0] bg-[#0b1220] border border-[#1f2a3a] hover:bg-[#111827] transition-colors"
              aria-label="Menu"
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
