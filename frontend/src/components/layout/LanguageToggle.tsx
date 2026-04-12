import React from 'react'
import { useI18n } from '../../i18n/useI18n'

export const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useI18n()
  
  return (
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
  )
}
