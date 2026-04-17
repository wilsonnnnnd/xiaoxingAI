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

  const selected =
    derivedSelectedId != null
      ? templates.find(x => x.id === derivedSelectedId) ?? null
      : null

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
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="rounded-full border border-white/80 bg-[rgba(255,255,255,0.82)] px-4 py-2 text-sm text-slate-600 backdrop-blur-xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03]">
          {t('prompts.loading')}
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto flex h-full min-w-0 w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.45),transparent_72%)]" />

      <header className="relative rounded-[28px] border border-white/80 bg-[rgba(255,255,255,0.72)] p-6 sm:p-7 backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03]">
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 ring-1 ring-black/[0.03]">
            Reply Format Studio
          </div>

          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[32px]">
              {t('reply_format.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {t('reply_format.subtitle')}
            </p>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[rgba(255,255,255,0.78)] backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03]">
        <div className="border-b border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.08)_55%,transparent)] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Templates Workspace
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {templates.length} {templates.length === 1 ? 'template' : 'templates'}
              </div>
            </div>

            <div className="inline-flex items-center rounded-full border border-white/80 bg-[rgba(217,235,255,0.7)] px-3 py-1.5 text-[11px] font-medium text-[#0b3c5d] ring-1 ring-black/[0.03]">
              Signature ready
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 lg:p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="min-w-0">
              <div className="rounded-[24px] border border-white/80 bg-[rgba(255,255,255,0.62)] p-4 backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] sm:p-5">
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
              </div>
            </aside>

            <div className="flex min-w-0 flex-col gap-5">
              <div className="rounded-[24px] border border-white/80 bg-[rgba(255,255,255,0.62)] p-4 backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] sm:p-5">
                <SignatureAndPreview
                  signature={signature}
                  t={t}
                  templateText={draftTpl}
                  closing={draftClosing}
                />
              </div>

              <div className="rounded-[24px] border border-white/80 bg-[rgba(255,255,255,0.68)] p-4 backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] sm:p-5">
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
      </section>
    </div>
  )
}