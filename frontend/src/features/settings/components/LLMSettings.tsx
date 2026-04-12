import React from 'react'
import type { Control } from 'react-hook-form'
import { Card } from '../../../components/common/Card'
import { FormInput } from '../../../components/common/form/FormInput'
import { FormSelect } from '../../../components/common/form/FormSelect'
import { useI18n } from '../../../i18n/useI18n'
import type { SettingsFormInput } from '../types'

interface LLMSettingsProps {
  control: Control<SettingsFormInput>
}

export const LLMSettings: React.FC<LLMSettingsProps> = ({ control }) => {
  const { t } = useI18n()

  return (
    <Card title={t('card.llm')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormSelect
          name="LLM_BACKEND"
          control={control}
          label={t('label.LLM_BACKEND')}
          options={[
            { label: t('opt.LLM_BACKEND.local'), value: 'local' },
            { label: t('opt.LLM_BACKEND.openai'), value: 'openai' },
          ]}
        />
        <FormInput
          name="LLM_MODEL"
          control={control}
          label={t('label.LLM_MODEL')}
          placeholder="local-model or gpt-4o-mini"
        />
        <FormInput
          name="LLM_API_URL"
          control={control}
          label={t('label.LLM_API_URL')}
          className="col-span-full"
          placeholder="http://127.0.0.1:8001/v1/chat/completions"
        />
        <FormInput
          name="OPENAI_API_KEY"
          control={control}
          label={`${t('label.OPENAI_API_KEY')} (only for openai)`}
          type="password"
          className="col-span-full"
          placeholder="sk-..."
          autoComplete="off"
        />
      </div>
    </Card>
  )
}
