import React, { useState } from 'react'
import axios from 'axios'
import { api } from '../../../api/client'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { Badge } from '../../../components/common/Badge'
import { useI18n } from '../../../i18n/useI18n'

interface ConnItemProps {
  label: string
  onTest: () => Promise<string>
}

const ConnItem: React.FC<ConnItemProps> = ({ label, onTest }) => {
  const [status, setStatus] = useState<{
    variant: 'neutral' | 'success' | 'warning' | 'error'
    msg: string
  }>({
    variant: 'neutral',
    msg: 'Ready to test',
  })
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    setStatus({ variant: 'warning', msg: 'Testing connection…' })

    try {
      const msg = await onTest()
      setStatus({ variant: 'success', msg })
    } catch (e: unknown) {
      let msg = 'Unknown error'

      if (axios.isAxiosError(e)) {
        const axiosDetail = e.response?.data?.detail
        msg = axiosDetail ?? e.message ?? String(e)
      } else if (e instanceof Error) {
        msg = e.message
      } else {
        msg = String(e)
      }

      setStatus({ variant: 'error', msg: `❌ ${msg}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[24px] border border-white/80 bg-[rgba(255,255,255,0.68)] p-4 backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Connection
          </div>

          <div className="mt-1 text-sm font-semibold tracking-[-0.01em] text-slate-900">
            {label}
          </div>

          <div className="mt-3">
            <Badge variant={status.variant} className="w-fit max-w-full">
              <span className="block break-words font-mono text-[11px] leading-5 tabular-nums">
                {status.msg}
              </span>
            </Badge>
          </div>
        </div>

        <Button
          disabled={busy}
          onClick={run}
          variant="secondary"
          className="
            shrink-0 px-4
            bg-[rgba(217,235,255,0.95)]
            border border-black/80
            text-[#0b3c5d]
            ring-1 ring-black/[0.05]
            hover:bg-[rgba(217,235,255,1)]
            shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]
          "
        >
          {busy ? 'Testing…' : 'Test'}
        </Button>
      </div>
    </div>
  )
}

export const ConnectionTests: React.FC = () => {
  const { t } = useI18n()

  return (
    <Card
      title={t('card.connections')}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ConnItem
          label="🤖 AI / LLM"
          onTest={async () => {
            const d = await api.get('/ai/ping').then(r => r.data)
            return `✅ ${d.backend} — ${d.reply}`
          }}
        />

        <ConnItem
          label="🗄️ Database"
          onTest={async () => {
            const d = await api.get('/db/stats').then(r => r.data)
            return `✅ sender:${d.sender_count} logs:${d.log_count}`
          }}
        />

        <ConnItem
          label="🔑 Gmail OAuth"
          onTest={async () => {
            const d = await api
              .post('/gmail/fetch', { query: 'in:inbox', max_results: 1 })
              .then(r => r.data)
            return `✅ Fetched ${d.count} email(s)`
          }}
        />
      </div>
    </Card>
  )
}