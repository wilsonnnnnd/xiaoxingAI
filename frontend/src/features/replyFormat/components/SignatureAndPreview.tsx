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

export const SignatureAndPreview: React.FC<Props> = ({ signature, t, templateText, closing }) => {
  const qc = useQueryClient()
  const [signatureDraft, setSignatureDraft] = React.useState(signature)
  const [previewContent, setPreviewContent] = React.useState(t('reply_format.sample_content'))

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
  const previewText = applyPreview(templateText, previewContent, signatureDraft, closing)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-[#0b0e14] border border-[#2d3748] rounded-xl p-4">
        <div className="text-sm font-semibold text-[#e2e8f0] mb-3">{t('reply_format.signature')}</div>
        <InputField
          label=""
          multi
          rows={5}
          value={signatureDraft}
          onChange={setSignatureDraft}
          placeholder={t('reply_format.signature_placeholder')}
          className="font-mono text-xs leading-relaxed"
        />
        <div className="flex items-center justify-between mt-3">
          <div className="text-[11px] text-[#64748b]">{t('reply_format.signature_hint')}</div>
          <Button
            onClick={() => saveSignature.mutate()}
            loading={saveSignature.isPending}
            disabled={!isSignatureDirty}
            className="px-4 py-1 text-xs"
          >
            {t('btn.save')}
          </Button>
        </div>
      </div>

      <div className="bg-[#0b0e14] border border-[#2d3748] rounded-xl p-4">
        <div className="text-sm font-semibold text-[#e2e8f0] mb-3">{t('reply_format.preview')}</div>
        <InputField
          label={t('reply_format.preview_content')}
          multi
          rows={4}
          value={previewContent}
          onChange={setPreviewContent}
          className="font-mono text-xs leading-relaxed"
        />
        <div className="mt-3 rounded-lg border border-[#2d3748] bg-[#0b0e14] p-3 max-h-[160px] overflow-auto">
          <pre className="whitespace-pre-wrap text-xs text-[#e2e8f0] font-mono leading-relaxed">{previewText}</pre>
        </div>
      </div>
    </div>
  )
}
