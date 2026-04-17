import { Link } from 'react-router-dom'
import { Card } from '../components/common/Card'
import { Surface } from '../components/common/Surface'
import { useI18n } from '../i18n/useI18n'

export default function Help() {
  const { t } = useI18n()

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <Surface title={t('help.title')} eyebrow={t('nav.help')} badge={t('help.subtitle')}>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-700 text-xs font-semibold ring-1 ring-black/[0.03] transition-colors"
          >
            {t('nav.home')}
          </Link>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-900 text-xs font-semibold ring-1 ring-black/[0.03] transition-colors"
          >
            {t('nav.settings')}
          </Link>
          <Link
            to="/skill/gmail"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-900 text-xs font-semibold ring-1 ring-black/[0.03] transition-colors"
          >
            {t('nav.skill.gmail')}
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4">
          <Card title={t('help.getting_started.title')}>
            <div className="text-sm text-slate-700 leading-7 whitespace-pre-line">
              {t('help.getting_started.body')}
            </div>
          </Card>

          <Card title={t('help.gmail.title')}>
            <div className="text-sm text-slate-700 leading-7 whitespace-pre-line">
              {t('help.gmail.body')}
            </div>
          </Card>

          <Card title={t('help.telegram.title')}>
            <div className="text-sm text-slate-700 leading-7 whitespace-pre-line">
              {t('help.telegram.body')}
            </div>
          </Card>
        </div>
      </Surface>
    </div>
  )
}
