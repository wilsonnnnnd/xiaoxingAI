import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useI18nStore } from './store'

export function I18nProvider({ children }: { children: ReactNode }) {
  const { lang, setLang } = useI18nStore()

  // Sync backend config only as initial fallback (when user has no saved preference)
  useEffect(() => {
    const persisted = localStorage.getItem('ui_lang')
    if (persisted) return
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => { if (cfg.UI_LANG === 'zh' || cfg.UI_LANG === 'en') setLang(cfg.UI_LANG) })
      .catch(() => {})
  }, [setLang])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return <>{children}</>
}
