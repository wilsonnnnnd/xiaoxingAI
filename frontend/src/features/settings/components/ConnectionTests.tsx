import React from 'react'
import axios from 'axios'
import { api } from '../../../api/client'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { useState } from 'react'
import { useI18n } from '../../../i18n/useI18n'

interface ConnItemProps {
  label: string
  onTest: () => Promise<string>
}

const ConnItem: React.FC<ConnItemProps> = ({ label, onTest }) => {
  const [status, setStatus] = useState<{ cls: string; msg: string }>({ cls: '', msg: '—' })
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    setStatus({ cls: 'text-[#fbbf24]', msg: 'Testing…' })
    try {
      const msg = await onTest()
      setStatus({ cls: 'text-[#86efac]', msg })
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
      setStatus({ cls: 'text-[#fca5a5]', msg: `❌ ${msg}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3 flex flex-col gap-2">
      <span className="text-xs font-semibold text-[#94a3b8]">{label}</span>
      <span className={`text-xs break-all min-h-[1.2em] ${status.cls}`}>{status.msg}</span>
      <Button
        disabled={busy}
        onClick={run}
        variant="primary"
        className="self-start px-3 py-1 text-xs"
      >
        Test
      </Button>
    </div>
  )
}

export const ConnectionTests: React.FC = () => {
  const { t } = useI18n()
  
  return (
    <Card title={t('card.connections')}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ConnItem label="🤖 AI / LLM" onTest={async () => {
          const d = await api.get('/ai/ping').then(r => r.data)
          return `✅ ${d.backend} — ${d.reply}`
        }} />
        <ConnItem label="🗄️ Database" onTest={async () => {
          const d = await api.get('/db/stats').then(r => r.data)
          return `✅ sender:${d.sender_count} logs:${d.log_count}`
        }} />
        <ConnItem label="🔑 Gmail OAuth" onTest={async () => {
          const d = await api.post('/gmail/fetch', { query: 'in:inbox', max_results: 1 }).then(r => r.data)
          return `✅ Fetched ${d.count} email(s)`
        }} />
      </div>
    </Card>
  )
}
