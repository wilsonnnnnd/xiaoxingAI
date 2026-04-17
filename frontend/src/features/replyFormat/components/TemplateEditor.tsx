import React from 'react'
import toast from 'react-hot-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { Switch } from '../../../components/common/Switch'
import { deleteReplyTemplate, updateReplyTemplate } from '../api'
import type { ReplyTemplate } from '../types'

type Props = {
  selected: ReplyTemplate | null
  t: (key: string) => string
  draftName: string
  draftTpl: string
  draftClosing: string
  draftIsDefault: boolean
  setDraftName: (v: string) => void
  setDraftTpl: (v: string) => void
  setDraftClosing: (v: string) => void
  setDraftIsDefault: (v: boolean) => void
}

export const TemplateEditor: React.FC<Props> = ({
  selected,
  t,
  draftName,
  draftTpl,
  draftClosing,
  draftIsDefault,
  setDraftName,
  setDraftTpl,
  setDraftClosing,
  setDraftIsDefault,
}) => {
  const qc = useQueryClient()

  const saveTemplate = useMutation({
    mutationFn: async (tpl: ReplyTemplate) =>
      updateReplyTemplate(tpl.id, {
        name: draftName,
        body_template: draftTpl,
        closing: draftClosing || null,
        is_default: draftIsDefault,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['replyFormat'] })
      toast.success(t('result.saved'))
    },
  })

  const deleteTemplateMut = useMutation({
    mutationFn: async (id: number) => deleteReplyTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['replyFormat'] })
      toast.success(t('reply_format.deleted'))
    },
  })

  const isTemplateDirty = selected
    ? draftName !== selected.name ||
      draftTpl !== selected.body_template ||
      (draftClosing || '') !== (selected.closing ?? '') ||
      draftIsDefault !== Boolean(selected.is_default)
    : false

  const handleReset = () => {
    if (!selected) return
    setDraftName(selected.name)
    setDraftTpl(selected.body_template)
    setDraftClosing(selected.closing ?? '')
    setDraftIsDefault(Boolean(selected.is_default))
  }

  return (
    <section className="rounded-[24px] border border-white/80 bg-[rgba(255,255,255,0.72)] p-4 sm:p-5 backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Template Editor
          </div>
          <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-900">
            {t('reply_format.template_editor')}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {isTemplateDirty && (
            <div className="inline-flex items-center rounded-full border border-white/80 bg-[rgba(217,235,255,0.76)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b3c5d] ring-1 ring-black/[0.03]">
              Unsaved
            </div>
          )}

          <Button
            variant="secondary"
            onClick={handleReset}
            disabled={!isTemplateDirty || saveTemplate.isPending || !selected}
            className="px-4"
          >
            {t('btn.reload')}
          </Button>

          <Button
            onClick={() => selected && saveTemplate.mutate(selected)}
            loading={saveTemplate.isPending}
            disabled={!selected || !isTemplateDirty}
            className="px-5"
          >
            {t('btn.save')}
          </Button>
        </div>
      </div>

      {!selected ? (
        <div className="rounded-[20px] border border-white/80 bg-white/62 px-4 py-5 text-sm text-slate-500 ring-1 ring-black/[0.03]">
          {t('reply_format.select_one')}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InputField
              label={t('reply_format.template_name')}
              value={draftName}
              onChange={setDraftName}
              placeholder={t('reply_format.template_name_placeholder')}
            />

            <InputField
              label={t('reply_format.closing')}
              value={draftClosing}
              onChange={setDraftClosing}
              placeholder={t('reply_format.closing_placeholder')}
            />
          </div>

          <div className="rounded-[20px] border border-white/75 bg-white/58 p-4 backdrop-blur-xl ring-1 ring-black/[0.03]">
            <InputField
              label={t('reply_format.body_template')}
              multi
              rows={10}
              value={draftTpl}
              onChange={setDraftTpl}
              placeholder={t('reply_format.body_template_placeholder')}
              className="font-mono text-[12px] leading-6"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-slate-500 ring-1 ring-black/[0.03]">
                {'{{content}}'}
              </div>
              <div className="inline-flex items-center rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-slate-500 ring-1 ring-black/[0.03]">
                {'{{signature}}'}
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/75 bg-white/58 p-4 backdrop-blur-xl ring-1 ring-black/[0.03]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Switch
                checked={draftIsDefault}
                onChange={setDraftIsDefault}
                label={t('reply_format.set_default')}
              />

              <Button
                variant="secondary"
                onClick={() => deleteTemplateMut.mutate(selected.id)}
                loading={deleteTemplateMut.isPending}
                className="px-4 text-[#7a2e2e] border-[rgba(122,46,46,0.12)] bg-[rgba(255,245,245,0.8)] hover:bg-[rgba(255,240,240,0.95)]"
              >
                {t('reply_format.btn_delete')}
              </Button>
            </div>

            <div className="mt-4 text-[12px] leading-5 text-slate-500">
              {t('reply_format.placeholders')}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}