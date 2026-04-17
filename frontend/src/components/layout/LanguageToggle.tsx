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
          className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
            lang === l
              // ✅ 选中状态（浅蓝 + 深色字）
              ? 'bg-[rgba(217,235,255,0.9)] text-[#0b3c5d] border border-sky-200/70'
              // ✅ 未选中（轻灰 + 轻 hover）
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          {l === 'en' ? 'EN' : '中文'}
        </button>
      ))}
    </div>
  )
}