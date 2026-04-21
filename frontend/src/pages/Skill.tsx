import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'

export default function SkillIndex() {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center h-full p-4 sm:p-8">
      <div className="max-w-3xl text-center">
        <h1 className="text-3xl font-bold text-black mb-4">{t('nav.skill')}</h1>
        <p className="text-lg text-[#94a3b8] mb-6">{t('skill.index.description')}</p>
        <div className="flex justify-center gap-4 flex-wrap">
          <Link to="/skill/gmail" className="px-4 py-2 rounded bg-[#3b82f6] text-white font-semibold">{t('nav.skill.gmail')}</Link>
        </div>
      </div>
    </div>
  )
}
