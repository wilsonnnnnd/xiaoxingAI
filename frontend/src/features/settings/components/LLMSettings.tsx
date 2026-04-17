import React from 'react'
import type { Control } from 'react-hook-form'
import { Card } from '../../../components/common/Card'
import { FormInput } from '../../../components/common/form/FormInput'
import { FormSwitch } from '../../../components/common/form/FormSwitch'
import { useI18n } from '../../../i18n/useI18n'
import type { SettingsFormInput } from '../types'

interface LLMSettingsProps {
  control: Control<SettingsFormInput>
  disabled?: boolean
  hasLlmKey?: boolean
  hasRouterKey?: boolean
}

export const LLMSettings: React.FC<LLMSettingsProps> = ({ control, disabled, hasLlmKey, hasRouterKey }) => {
  const { t } = useI18n()

  return (
    <Card title={t('card.llm')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormSwitch
          name="USE_ONLINE_AI"
          control={control}
          disabled={disabled}
          label={t('settings.llm.use_online')}
          className="self-center"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <FormInput
          name="LLM_MODEL"
          control={control}
          label={t('label.LLM_MODEL')}
          disabled={disabled}
          placeholder="gpt-4o-mini / qwen-max / local-model"
        />
        <FormInput
          name="LLM_API_URL"
          control={control}
          label={t('label.LLM_API_URL')}
          disabled={disabled}
          className="col-span-full"
          placeholder={t('settings.llm.url_placeholder')}
        />
        <FormInput
          name="LLM_API_KEY"
          control={control}
          label={`${t('label.LLM_API_KEY')}${hasLlmKey ? ` (${t('settings.llm.key_set')})` : ''}`}
          type="password"
          disabled={disabled}
          className="col-span-full"
          placeholder={hasLlmKey ? t('settings.llm.key_keep') : t('settings.llm.key_placeholder')}
          autoComplete="off"
        />

        <div className="col-span-full h-px bg-white/60" />

        <FormInput
          name="ROUTER_MODEL"
          control={control}
          label={t('label.ROUTER_MODEL')}
          disabled={disabled}
          placeholder={t('settings.router.placeholder')}
        />
        <FormInput
          name="ROUTER_API_URL"
          control={control}
          label={t('label.ROUTER_API_URL')}
          disabled={disabled}
          className="col-span-full"
          placeholder={t('settings.router.placeholder')}
        />
        <FormInput
          name="ROUTER_API_KEY"
          control={control}
          label={`${t('label.ROUTER_API_KEY')}${hasRouterKey ? ` (${t('settings.llm.key_set')})` : ''}`}
          type="password"
          disabled={disabled}
          className="col-span-full"
          placeholder={hasRouterKey ? t('settings.llm.key_keep') : t('settings.router.key_placeholder')}
          autoComplete="off"
        />
      </div>
    </Card>
  )
}
