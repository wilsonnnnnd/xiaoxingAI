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

  return (
    <div className="bg-[#0b0e14] border border-[#2d3748] rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm font-semibold text-[#e2e8f0]">{t('reply_format.template_editor')}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            className="bg-[#334155] hover:bg-[#475569] px-4 py-1 text-xs"
            onClick={() => {
              if (!selected) return
              setDraftName(selected.name)
              setDraftTpl(selected.body_template)
              setDraftClosing(selected.closing ?? '')
              setDraftIsDefault(Boolean(selected.is_default))
            }}
            disabled={!isTemplateDirty || saveTemplate.isPending}
          >
            {t('btn.reload')}
          </Button>
          <Button
            onClick={() => selected && saveTemplate.mutate(selected)}
            loading={saveTemplate.isPending}
            disabled={!selected || !isTemplateDirty}
            className="px-6 py-1 text-xs"
          >
            {t('btn.save')}
          </Button>
        </div>
      </div>

      {!selected ? (
        <div className="text-xs text-[#64748b]">{t('reply_format.select_one')}</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <InputField
            label={t('reply_format.body_template')}
            multi
            rows={10}
            value={draftTpl}
            onChange={setDraftTpl}
            placeholder={t('reply_format.body_template_placeholder')}
            className="font-mono text-xs leading-relaxed"
          />

          <div className="flex items-center justify-between gap-3">
            <Switch checked={draftIsDefault} onChange={setDraftIsDefault} label={t('reply_format.set_default')} />
            <Button
              variant="primary"
              className="bg-[#7f1d1d] hover:bg-[#991b1b] px-4 py-1 text-xs"
              onClick={() => deleteTemplateMut.mutate(selected.id)}
              loading={deleteTemplateMut.isPending}
            >
              {t('reply_format.btn_delete')}
            </Button>
          </div>

          <div className="text-[11px] text-[#64748b]">{t('reply_format.placeholders')}</div>
        </div>
      )}
    </div>
  )
}
