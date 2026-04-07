import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { en } from './en'
import { zh } from './zh'

export type Lang = 'en' | 'zh'

const catalogs: Record<Lang, Record<string, string>> = { en, zh }

interface I18nStore {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set, get) => ({
      lang: 'en',
      setLang: (l) => set({ lang: l }),
      t: (key) => {
        const { lang } = get()
        return catalogs[lang][key] ?? catalogs.en[key] ?? key
      },
    }),
    {
      name: 'ui_lang',
      // Only persist the lang value, not functions
      partialize: (state) => ({ lang: state.lang }),
    },
  ),
)
