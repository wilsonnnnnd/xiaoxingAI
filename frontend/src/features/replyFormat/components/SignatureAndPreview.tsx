import React from 'react'
import toast from 'react-hot-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { updateReplyFormat } from '../api'
import { applyPreview } from './preview'

type Props = {
  signature: string
  t: (key: string) => string
  templateText: string
  closing: string
}

export const SignatureAndPreview: React.FC<Props> = ({
  signature,
  t,
  templateText,
  closing,
}) => {
  const qc = useQueryClient()
  const [signatureDraft, setSignatureDraft] = React.useState(signature)
  const [previewContent, setPreviewContent] = React.useState(
    t('reply_format.sample_content')
  )

  React.useEffect(() => {
    setSignatureDraft(signature)
  }, [signature])

  const saveSignature = useMutation({
    mutationFn: async () => updateReplyFormat({ signature: signatureDraft }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['replyFormat'] })
      toast.success(t('result.saved'))
    },
  })

  const isSignatureDirty = signatureDraft !== signature
  const previewText = applyPreview(
    templateText,
    previewContent,
    signatureDraft,
    closing
  )

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <section className="rounded-[24px] border border-white/80 bg-[rgba(255,255,255,0.72)] p-4 sm:p-5 backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Signature
            </div>
            <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-900">
              {t('reply_format.signature')}
            </h3>
          </div>

          {isSignatureDirty && (
            <div className="inline-flex items-center rounded-full border border-white/80 bg-[rgba(217,235,255,0.75)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b3c5d] ring-1 ring-black/[0.03]">
              Unsaved
            </div>
          )}
        </div>

        <InputField
          label=""
          multi
          rows={6}
          value={signatureDraft}
          onChange={setSignatureDraft}
          placeholder={t('reply_format.signature_placeholder')}
          className="font-mono text-[12px] leading-6"
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="max-w-[75%] text-[12px] leading-5 text-slate-500">
            {t('reply_format.signature_hint')}
          </p>

          <Button
            onClick={() => saveSignature.mutate()}
            loading={saveSignature.isPending}
            disabled={!isSignatureDirty}
            className="px-4"
          >
            {t('btn.save')}
          </Button>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/80 bg-[rgba(255,255,255,0.72)] p-4 sm:p-5 backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03]">
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Live Preview
          </div>
          <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-900">
            {t('reply_format.preview')}
          </h3>
        </div>

        <InputField
          label={t('reply_format.preview_content')}
          multi
          rows={4}
          value={previewContent}
          onChange={setPreviewContent}
          className="font-mono text-[12px] leading-6"
        />

        <div className="mt-4 rounded-[20px] border border-white/80 bg-white/72 p-4 backdrop-blur-xl ring-1 ring-black/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Output
          </div>

          <div className="max-h-[220px] overflow-auto rounded-[16px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(250,252,255,0.9))] px-3.5 py-3">
            <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-slate-700">
              {previewText}
            </pre>
          </div>
        </div>
      </section>
    </div>
  )
}