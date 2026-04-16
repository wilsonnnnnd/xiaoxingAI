import { Card } from '../components/common/Card'
import { useI18n } from '../i18n/useI18n'

export default function Help() {
  const { t } = useI18n()

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">{t('help.title')}</h1>
        <p className="text-sm text-[#94a3b8] mt-2">{t('help.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card title={t('help.getting_started.title')}>
          <div className="text-sm text-[#cbd5e1] leading-6 whitespace-pre-line">
            {t('help.getting_started.body')}
          </div>
        </Card>

        <Card title={t('help.gmail.title')}>
          <div className="text-sm text-[#cbd5e1] leading-6 whitespace-pre-line">
            {t('help.gmail.body')}
          </div>
        </Card>

        <Card title={t('help.telegram.title')}>
          <div className="text-sm text-[#cbd5e1] leading-6 whitespace-pre-line">
            {t('help.telegram.body')}
          </div>
        </Card>

      </div>
    </div>
  )
}
