import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useI18n } from '../../../i18n/useI18n'
import { Button } from '../../../components/common/Button'
import { Select } from '../../../components/common/Select'
import { Surface } from '../../../components/common/Surface'
import { Badge } from '../../../components/common/Badge'
import { useConfirmDiscard } from '../../../hooks/useConfirmDiscard'
import { getConfig, saveConfig } from '../api'
import { getMe, getUser, updateUser } from '../../users'
import type { Config } from '../../../types'
import { settingsSchema } from '../types'
import type { SettingsFormInput, SettingsFormValues } from '../types'
import { ConnectionTests } from './ConnectionTests'
import { LLMSettings } from './LLMSettings'
import { GmailSettings } from './GmailSettings'
import { BotSettings } from './BotSettings'
import { ChangePasswordCard } from './ChangePasswordCard'
import toast from 'react-hot-toast'

export const SettingsPage: React.FC = () => {
  const { t, lang } = useI18n()
  const [myId, setMyId] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasLlmKey, setHasLlmKey] = useState(false)
  const [hasRouterKey, setHasRouterKey] = useState(false)
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
      USE_ONLINE_AI: false,
      LLM_MODEL: 'local-model',
      LLM_API_URL: 'http://127.0.0.1:8001/v1/chat/completions',
      LLM_API_KEY: '',
      ROUTER_API_URL: '',
      ROUTER_MODEL: '',
      ROUTER_API_KEY: '',
      GMAIL_MARK_READ: 'true',
      GMAIL_POLL_QUERY: 'is:unread in:inbox category:primary',
      NOTIFY_LANG: 'en',
      min_priority: 'medium',
      max_emails_per_run: 10,
      poll_interval: 300,
    }
  })

  useConfirmDiscard(isDirty, t('prompts.confirm.discard'))

  const currentNotifyLang = watch('NOTIFY_LANG')

  useEffect(() => {
    async function loadData() {
      try {
        const me = await getMe()
        setMyId(me.id)
        setIsAdmin(me.role === 'admin')
        const [user, config] = await Promise.all([
          getUser(me.id),
          me.role === 'admin' ? getConfig() : Promise.resolve(null),
        ])

        // Build a properly typed SettingsFormInput object from config + user
        const cfgRaw = (config ?? {}) as Partial<Config>
        setHasLlmKey(!!cfgRaw.HAS_LLM_API_KEY)
        setHasRouterKey(!!cfgRaw.HAS_ROUTER_API_KEY)
        const values: SettingsFormInput = {
          USE_ONLINE_AI: (cfgRaw.LLM_BACKEND ?? 'local') === 'openai',
          LLM_MODEL: cfgRaw.LLM_MODEL ?? 'local-model',
          LLM_API_URL: cfgRaw.LLM_API_URL ?? 'http://127.0.0.1:8001/v1/chat/completions',
          LLM_API_KEY: '',
          ROUTER_API_URL: cfgRaw.ROUTER_API_URL ?? '',
          ROUTER_MODEL: cfgRaw.ROUTER_MODEL ?? '',
          ROUTER_API_KEY: '',
          GMAIL_MARK_READ: cfgRaw.GMAIL_MARK_READ ?? 'true',
          GMAIL_POLL_QUERY: user.gmail_poll_query ?? cfgRaw.GMAIL_POLL_QUERY ?? 'is:unread in:inbox category:primary',
          NOTIFY_LANG: user.notify_lang === 'zh' ? 'zh' : user.notify_lang === 'en' ? 'en' : 'en',

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
      const { min_priority, max_emails_per_run, poll_interval, GMAIL_POLL_QUERY, NOTIFY_LANG, ...globalConfig } = parsed

      await Promise.all([
        isAdmin ? (async () => {
          type GlobalConfigWithFlag = Partial<Config> & { USE_ONLINE_AI?: boolean }
          const { LLM_API_KEY, ROUTER_API_KEY, USE_ONLINE_AI, ...rest } = globalConfig as unknown as GlobalConfigWithFlag
          const patch: Partial<Config> = { ...(rest as Partial<Config>), LLM_BACKEND: USE_ONLINE_AI ? 'openai' : 'local' }
          if (LLM_API_KEY) patch.LLM_API_KEY = LLM_API_KEY
          if (ROUTER_API_KEY) patch.ROUTER_API_KEY = ROUTER_API_KEY
          const r = await saveConfig(patch)
          const res = r as unknown as { config?: Partial<Config> }
          if (res?.config) {
            setHasLlmKey(!!res.config.HAS_LLM_API_KEY)
            setHasRouterKey(!!res.config.HAS_ROUTER_API_KEY)
          }
        })() : Promise.resolve(),
        myId ? updateUser(myId, { min_priority, max_emails_per_run, poll_interval, gmail_poll_query: GMAIL_POLL_QUERY, notify_lang: NOTIFY_LANG }) : Promise.resolve(),
      ])

      toast.success(t('result.saved'))
      reset({ ...parsed, LLM_API_KEY: '', ROUTER_API_KEY: '' })
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
    <div className="flex flex-col h-full p-4 sm:p-5 gap-6 min-w-0 max-w-5xl mx-auto w-full">
      <Surface title={t('header.title.settings')} eyebrow={t('nav.settings')} badge={t('header.subtitle.settings')}>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">

          <Select
            label={t('label.notify_lang')}
            value={currentNotifyLang}
            onChange={(e) => {
              const newLang = e.target.value as 'en' | 'zh'
              setValue('NOTIFY_LANG', newLang, { shouldDirty: true })
            }}
            className="min-w-[160px]"
            options={[
              { label: 'English', value: 'en' },
              { label: '中文', value: 'zh' },
            ]}
          />
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <ConnectionTests />
          <ChangePasswordCard />

          <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-6">
            {isAdmin && <LLMSettings control={control} hasLlmKey={hasLlmKey} hasRouterKey={hasRouterKey} />}
            <GmailSettings control={control} />

            <div className="sticky bottom-0 -mx-5 px-5 sm:-mx-6 sm:px-6 py-4 bg-white/62 backdrop-blur-xl border-t border-white/60 z-10">
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="submit" loading={isSubmitting} disabled={!isDirty} className="px-8 py-2.5">
                  {t('btn.save')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => reset()} disabled={!isDirty || isSubmitting} className="px-6 py-2.5">
                  {t('btn.reload')}
                </Button>
                {isDirty && (
                  <Badge variant="warning" className="py-2 px-3">
                    {t('settings.unsaved')}
                  </Badge>
                )}
              </div>
            </div>
          </form>

          {myId && <BotSettings userId={myId} />}
        </div>
      </Surface>
    </div>
  )
}
