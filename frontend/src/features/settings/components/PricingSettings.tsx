import React, { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { Badge } from '../../../components/common/Badge'
import { useI18n } from '../../../i18n/useI18n'
import { getPricingConfig, savePricingConfig } from '../api'

type PricingRow = {
  model: string
  provider: string
  prompt_per_million: string
  completion_per_million: string
}

function emptyRow(): PricingRow {
  return {
    model: '',
    provider: '',
    prompt_per_million: '0',
    completion_per_million: '0',
  }
}

export const PricingSettings: React.FC = () => {
  const { t } = useI18n()
  const [rows, setRows] = useState<PricingRow[]>([])
  const [fallbackPrompt, setFallbackPrompt] = useState('0.50')
  const [fallbackCompletion, setFallbackCompletion] = useState('1.50')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: getPricingConfig,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!data) return
    setRows(
      (data.models ?? []).map(item => ({
        model: item.model,
        provider: item.provider,
        prompt_per_million: item.prompt_per_million,
        completion_per_million: item.completion_per_million,
      })),
    )
    setFallbackPrompt(data.fallback?.prompt_per_million ?? '0.50')
    setFallbackCompletion(data.fallback?.completion_per_million ?? '1.50')
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload: string) => savePricingConfig(payload),
    onSuccess: async () => {
      await refetch()
      toast.success(t('result.saved'))
    },
  })

  function updateRow(index: number, patch: Partial<PricingRow>) {
    setRows(current =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    )
  }

  function addRow() {
    setRows(current => [...current, emptyRow()])
  }

  function removeRow(index: number) {
    setRows(current => current.filter((_, rowIndex) => rowIndex !== index))
  }

  function validateNonNegativeDecimal(value: string) {
    const trimmed = String(value || '').trim()
    if (!trimmed) return false
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) && parsed >= 0
  }

  function handleSave() {
    const cleaned = rows
      .map(row => ({
        model: row.model.trim(),
        provider: row.provider.trim(),
        prompt_per_million: row.prompt_per_million.trim(),
        completion_per_million: row.completion_per_million.trim(),
      }))
      .filter(row => row.model)

    if (
      !validateNonNegativeDecimal(fallbackPrompt) ||
      !validateNonNegativeDecimal(fallbackCompletion)
    ) {
      toast.error(t('settings.pricing.validation.fallback'))
      return
    }

    const invalidRow = cleaned.find(
      row =>
        !validateNonNegativeDecimal(row.prompt_per_million) ||
        !validateNonNegativeDecimal(row.completion_per_million),
    )
    if (invalidRow) {
      toast.error(t('settings.pricing.validation.row'))
      return
    }

    const payload = JSON.stringify(
      {
        fallback: {
          prompt_per_million: fallbackPrompt.trim(),
          completion_per_million: fallbackCompletion.trim(),
        },
        models: cleaned,
      },
      null,
      2,
    )

    saveMutation.mutate(payload)
  }

  return (
    <Card
      title={t('settings.pricing.title')}
      subtitle={t('settings.pricing.subtitle')}
      rightSlot={
        <Badge variant={data?.uses_fallback_defaults ? 'warning' : 'info'}>
          {data?.uses_fallback_defaults
            ? t('settings.pricing.badge.defaults')
            : t('settings.pricing.badge.configured')}
        </Badge>
      }
      interactive={false}
    >
      {isLoading ? (
        <div className="text-sm text-slate-500">{t('prompts.loading')}</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField
              label={t('settings.pricing.fallback_prompt')}
              value={fallbackPrompt}
              onChange={setFallbackPrompt}
              placeholder="0.50"
            />
            <InputField
              label={t('settings.pricing.fallback_completion')}
              value={fallbackCompletion}
              onChange={setFallbackCompletion}
              placeholder="1.50"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                {t('settings.pricing.models')}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addRow}
              >
                {t('settings.pricing.add_model')}
              </Button>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-5 text-sm text-slate-500">
                {t('settings.pricing.empty')}
              </div>
            ) : (
              rows.map((row, index) => (
                <div
                  key={`${row.model}-${index}`}
                  className="rounded-[20px] border border-white/70 bg-white/60 p-4 ring-1 ring-black/[0.03]"
                >
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
                    <InputField
                      label={t('settings.pricing.model_name')}
                      value={row.model}
                      onChange={value => updateRow(index, { model: value })}
                      placeholder="gpt-4o-mini"
                    />
                    <InputField
                      label={t('settings.pricing.provider')}
                      value={row.provider}
                      onChange={value => updateRow(index, { provider: value })}
                      placeholder="openai"
                    />
                    <InputField
                      label={t('settings.pricing.prompt_rate')}
                      value={row.prompt_per_million}
                      onChange={value =>
                        updateRow(index, { prompt_per_million: value })
                      }
                      placeholder="0.15"
                    />
                    <InputField
                      label={t('settings.pricing.completion_rate')}
                      value={row.completion_per_million}
                      onChange={value =>
                        updateRow(index, { completion_per_million: value })
                      }
                      placeholder="0.60"
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-rose-600 hover:text-rose-700"
                        onClick={() => removeRow(index)}
                      >
                        {t('settings.pricing.remove')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/60 pt-4">
            <div className="text-sm text-slate-500">
              {t('settings.pricing.helper')}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => refetch()}
              >
                {t('settings.pricing.reload')}
              </Button>
              <Button
                type="button"
                loading={saveMutation.isPending}
                onClick={handleSave}
              >
                {t('settings.pricing.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
