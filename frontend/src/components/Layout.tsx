import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { useState, useRef, useEffect } from 'react'

const NAV = [
  { to: '/home',     key: 'nav.home' },
  { to: '/skill',    key: 'nav.skill' },
  { to: '/settings', key: 'nav.settings' },
  { to: '/prompts',  key: 'nav.prompts' },
  { to: '/debug',    key: 'nav.debug' },
]

export default function Layout() {
  const { t, lang, setLang } = useI18n()
  const [skillOpen, setSkillOpen] = useState(false)
  const skillRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (skillRef.current && !skillRef.current.contains(e.target as Node)) {
        setSkillOpen(false)
      }
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col bg-[#1e293b] border-r border-[#334155]">
        <div className="px-4 py-5 border-b border-[#334155]">
          <div className="text-base font-semibold text-[#e2e8f0]">{t('app.brand')}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5">{t('sidebar.small')}</div>
        </div>

        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
          {NAV.map(({ to, key }) => {
            if (key === 'nav.skill') {
              return (
                <div key="skill" className="relative" ref={skillRef}>
                  <button
                    onClick={() => setSkillOpen(v => !v)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${skillOpen ? 'bg-[#3b82f6] text-white font-medium' : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]'}`}
                  >
                    {t('nav.skill')}
                  </button>
                  {skillOpen && (
                    <div className="mt-1 ml-2 bg-[#0b1220] border border-[#334155] rounded-md p-1 z-50">
                      <NavLink
                        to="/skill"
                        className={({ isActive }) =>
                          `block px-3 py-1 rounded text-sm ${isActive ? 'bg-[#3b82f6] text-white' : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]'}`
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
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-[#3b82f6] text-white font-medium'
                      : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]'
                  }`
                }
              >
                {t(key)}
              </NavLink>
            )
          })}
        </nav>

        {/* Lang toggle */}
        <div className="px-4 py-3 border-t border-[#334155]">
          <div className="flex gap-1">
            {(['en', 'zh'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                  lang === l
                    ? 'bg-[#3b82f6] text-white'
                    : 'text-[#94a3b8] hover:bg-[#334155]'
                }`}
              >
                {l === 'en' ? 'EN' : '中文'}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-[#0f172a] flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}
