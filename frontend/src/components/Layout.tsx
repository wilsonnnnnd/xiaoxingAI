import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { useState, useRef, useEffect } from 'react'

const NAV = [
  { to: '/home', key: 'nav.home' },
  { to: '/skill', key: 'nav.skill' },
  { to: '/settings', key: 'nav.settings' },
  { to: '/prompts', key: 'nav.prompts' },
  { to: '/debug', key: 'nav.debug' },
]

export default function Layout() {
  const { t, lang, setLang } = useI18n()
  const [skillOpen, setSkillOpen] = useState(false)
  const [imgOk, setImgOk] = useState(true)
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
      <aside className="w-56 shrink-0 flex flex-col bg-[#0f1724] border-r border-[#273347] transition-width duration-200">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1f2a3a]">
          {imgOk ? (
            <div className="w-10 h-10 rounded-full bg-white p-0.5 shrink-0 flex items-center justify-center">
              <img
                src="./../../public/xiaoxing_icon.png"
                alt="Xiaoxing"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement
                  if (img.dataset.fallback === '1') {
                    setImgOk(false)
                    return
                  }
                  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0' stop-color='%2360a5fa'/><stop offset='1' stop-color='%237c3aed'/></linearGradient></defs><rect width='100%' height='100%' rx='16' fill='url(%23g)'/><text x='50%' y='55%' font-size='36' text-anchor='middle' fill='white' font-family='sans-serif'>小</text></svg>`
                  img.dataset.fallback = '1'
                  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
                }}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-white p-0.5 shrink-0 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#60a5fa] to-[#7c3aed] flex items-center justify-center text-white font-bold text-sm">小</div>
            </div>
          )}
          <div className="min-w-0 overflow-hidden">
            <div className="text-base font-semibold text-[#e2e8f0] truncate">{t('app.brand')}</div>
            <div className="text-xs text-[#94a3b8] mt-0.5 truncate">{t('sidebar.small')}</div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto flex flex-col gap-1 px-2 pr-3">
          {NAV.map(({ to, key }) => {
            if (key === 'nav.skill') {
              return (
                <div key="skill" className="relative" ref={skillRef}>
                  <button
                    onClick={() => setSkillOpen(v => !v)}
                    aria-expanded={skillOpen}
                    aria-controls="skill-menu"
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors duration-150 ease-in-out ${skillOpen ? 'bg-[#3b82f6] text-white font-medium' : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]'}`}
                  >
                    <span className="flex items-center gap-2">{t('nav.skill')}</span>
                    <span className="text-xs text-[#94a3b8]">{skillOpen ? '▾' : '▸'}</span>
                  </button>
                  {skillOpen && (
                    <div id="skill-menu" className="mt-1 ml-2 bg-[#071025] border border-[#213347] rounded-md p-1 z-50 shadow-lg">
                      <NavLink
                        to="/skill/gmail"
                        className={({ isActive }) =>
                          `block px-3 py-1 rounded text-sm transition-colors duration-150 ${isActive ? 'bg-[#071023] text-white font-semibold' : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]'}`
                        }
                      >
                        {t('nav.skill.gmail')}
                      </NavLink>
                      <NavLink
                        to="/skill/chat"
                        className={({ isActive }) =>
                          `block px-3 py-1 rounded text-sm transition-colors duration-150 ${isActive ? 'bg-[#071023] text-white font-semibold' : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]'}`
                        }
                      >
                        {t('nav.skill.chat')}
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
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 ease-in-out ${isActive ? 'bg-[#071023] text-white font-semibold border-l-4 border-[#60a5fa] pl-3' : 'text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0]'}`
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
                className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${lang === l
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
