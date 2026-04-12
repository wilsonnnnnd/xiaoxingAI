import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useI18n } from '../../../i18n/useI18n'
import { Button } from '../../../components/common/Button'
import { Select } from '../../../components/common/Select'
import { useConfirmDiscard } from '../../../hooks/useConfirmDiscard'
import { getConfig, saveConfig } from '../api'
import { getMe, getUser, updateUser } from '../../users'
import { settingsSchema } from '../types'
import type { SettingsFormInput, SettingsFormValues } from '../types'
import { ConnectionTests } from './ConnectionTests'
import { LLMSettings } from './LLMSettings'
import { GmailSettings } from './GmailSettings'
import { BotSettings } from './BotSettings'
import toast from 'react-hot-toast'

export const SettingsPage: React.FC = () => {
  const { t, lang, setLang } = useI18n()
  const [myId, setMyId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
    setValue,
    watch
  } = useForm<SettingsFormInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      LLM_BACKEND: 'local',
      LLM_MODEL: '',
      LLM_API_URL: '',
      OPENAI_API_KEY: '',
      GMAIL_MARK_READ: 'true',
      GMAIL_POLL_QUERY: 'is:unread in:inbox',
      UI_LANG: lang,
      min_priority: 'medium',
      max_emails_per_run: 10,
      poll_interval: 300,
    }
  })

  useConfirmDiscard(isDirty, t('prompts.confirm.discard'))

  const currentUiLang = watch('UI_LANG')

  useEffect(() => {
    async function loadData() {
      try {
        const [config, me] = await Promise.all([getConfig(), getMe()])
        setMyId(me.id)
        const user = await getUser(me.id)

        // Build a properly typed SettingsFormInput object from config + user
        const cfgRaw = config as unknown as Partial<Record<string, string>>
        const values: SettingsFormInput = {
          LLM_BACKEND: cfgRaw.LLM_BACKEND ?? 'local',
          LLM_MODEL: cfgRaw.LLM_MODEL ?? '',
          LLM_API_URL: cfgRaw.LLM_API_URL ?? '',
          OPENAI_API_KEY: cfgRaw.OPENAI_API_KEY ?? '',
          GMAIL_MARK_READ: cfgRaw.GMAIL_MARK_READ ?? 'true',
          GMAIL_POLL_QUERY: cfgRaw.GMAIL_POLL_QUERY ?? 'is:unread in:inbox',
          UI_LANG: cfgRaw.UI_LANG === 'zh' ? 'zh' : 'en',

          min_priority: ['high', 'medium', 'low'].includes(user.min_priority) ? (user.min_priority as SettingsFormInput['min_priority']) : 'medium',
          max_emails_per_run: user.max_emails_per_run ?? 10,
          poll_interval: user.poll_interval ?? 300,
        }

        reset(values)
      } catch {
        /* handled globally */
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [reset, lang])

  const onSave = async (data: SettingsFormInput) => {
    try {
      const parsed: SettingsFormValues = settingsSchema.parse(data)
      const { min_priority, max_emails_per_run, poll_interval, ...globalConfig } = parsed

      await Promise.all([
        saveConfig(globalConfig),
        myId ? updateUser(myId, { min_priority, max_emails_per_run, poll_interval }) : Promise.resolve()
      ])

      toast.success(t('result.saved'))
      if (parsed.UI_LANG !== lang) {
        setLang(parsed.UI_LANG)
      }
      reset(parsed)
    } catch {
      /* handled globally */
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[#64748b]">{t('prompts.loading')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-5 gap-6 min-w-0 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('header.title.settings')}</h1>
          <p className="text-sm text-[#64748b] mt-1">{t('header.subtitle.settings')}</p>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <Select
            label={t('label.ui_lang')}
            value={currentUiLang}
            onChange={(e) => {
              const newLang = e.target.value as 'en' | 'zh'
              setValue('UI_LANG', newLang, { shouldDirty: true })
            }}
            className="min-w-[120px]"
            options={[
              { label: 'English', value: 'en' },
              { label: '中文', value: 'zh' },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <ConnectionTests />

        <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-6">
          <LLMSettings control={control} />
          <GmailSettings control={control} />

          <div className="flex items-center gap-3 sticky bottom-0 py-4 bg-[#0f172a]/80 backdrop-blur-md border-t border-[#2d3748] -mx-5 px-5 z-10">
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!isDirty}
              className="px-8 py-2.5"
            >
              {t('btn.save')}
            </Button>
            <Button
              type="button"
              variant="primary"
              className="bg-[#334155] hover:bg-[#475569] px-6 py-2.5"
              onClick={() => reset()}
              disabled={!isDirty || isSubmitting}
            >
              {t('btn.reload')}
            </Button>
            {isDirty && (
              <span className="text-xs text-[#fbbf24] ml-2 animate-pulse">
                ● You have unsaved changes
              </span>
            )}
          </div>
        </form>

        {myId && <BotSettings userId={myId} />}
      </div>
    </div>
  )
}
