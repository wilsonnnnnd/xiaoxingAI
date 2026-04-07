import { createContext } from 'react'

export type Lang = 'en' | 'zh'
export type Translations = Record<string, string>

export interface I18nCtx {
    lang: Lang
    setLang: (l: Lang) => void
    t: (key: string) => string
}

export const I18nContext = createContext<I18nCtx>({
    lang: 'en',
    setLang: () => { },
    t: (k) => k,
})
