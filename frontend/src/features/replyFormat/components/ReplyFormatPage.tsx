import React, { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../../../i18n/useI18n'
import { createReplyTemplate, getReplyFormat } from '../api'
import type { ReplyFormatState, ReplyTemplate } from '../types'
import { TemplateList } from './TemplateList'
import { SignatureAndPreview } from './SignatureAndPreview'
import { TemplateEditor } from './TemplateEditor'

export const ReplyFormatPage: React.FC = () => {
  const { t } = useI18n()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<ReplyFormatState>({
    queryKey: ['replyFormat'],
    queryFn: getReplyFormat,
    staleTime: 30_000,
  })

  const templates = useMemo(() => data?.templates ?? [], [data])
  const signature = data?.signature ?? ''

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const derivedSelectedId =
    selectedId ??
    data?.default_template_id ??
    templates.find(x => x.is_default)?.id ??
    templates[0]?.id ??
    null
  const selected = derivedSelectedId != null ? templates.find(x => x.id === derivedSelectedId) ?? null : null

  const [draftName, setDraftName] = useState('')
  const [draftTpl, setDraftTpl] = useState('')
  const [draftClosing, setDraftClosing] = useState('')
  const [draftIsDefault, setDraftIsDefault] = useState(false)

  React.useEffect(() => {
    if (selectedId == null && derivedSelectedId != null) {
      setSelectedId(derivedSelectedId)
    }
  }, [derivedSelectedId, selectedId])

  React.useEffect(() => {
    if (derivedSelectedId == null) return
    const tpl = templates.find(x => x.id === derivedSelectedId)
    if (!tpl) return
    setDraftName(tpl.name)
    setDraftTpl(tpl.body_template)
    setDraftClosing(tpl.closing ?? '')
    setDraftIsDefault(Boolean(tpl.is_default))
  }, [derivedSelectedId, templates])

  const createTemplateMut = useMutation({
    mutationFn: async () =>
      createReplyTemplate({
        name: t('reply_format.new_template'),
        body_template: '{{content}}\n\n{{signature}}',
        closing: null,
        is_default: templates.length === 0,
      }),
    onSuccess: (tpl: ReplyTemplate) => {
      qc.invalidateQueries({ queryKey: ['replyFormat'] })
      setSelectedId(tpl.id)
      toast.success(t('reply_format.created'))
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[#64748b]">{t('prompts.loading')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-5 gap-6 min-w-0 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('reply_format.title')}</h1>
          <p className="text-sm text-[#64748b] mt-1">{t('reply_format.subtitle')}</p>
        </div>
      </div>

      <div className="bg-[#1e2330] border border-[#2d3748] rounded-xl p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <TemplateList
            title={t('reply_format.templates')}
            btnNew={t('reply_format.btn_new')}
            noTemplates={t('reply_format.no_templates')}
            defaultLabel={t('reply_format.default')}
            templates={templates}
            selectedId={derivedSelectedId}
            defaultTemplateId={data?.default_template_id ?? null}
            onSelect={setSelectedId}
            onCreate={() => createTemplateMut.mutate()}
            creating={createTemplateMut.isPending}
          />

          <div className="flex flex-col gap-4 lg:col-span-2 min-w-0">
            <SignatureAndPreview
              signature={signature}
              t={t}
              templateText={draftTpl}
              closing={draftClosing}
            />

            <TemplateEditor
              selected={selected}
              t={t}
              draftName={draftName}
              draftTpl={draftTpl}
              draftClosing={draftClosing}
              draftIsDefault={draftIsDefault}
              setDraftName={setDraftName}
              setDraftTpl={setDraftTpl}
              setDraftClosing={setDraftClosing}
              setDraftIsDefault={setDraftIsDefault}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
