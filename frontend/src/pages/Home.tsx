import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { getHealth, getGmailWorkStatus, getChatWorkStatus } from '../api'

export default function Home() {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [apiOk, setApiOk] = useState<boolean | null>(null)

    // Initial fetch to populate caches
    useEffect(() => {
        qc.fetchQuery({ queryKey: ['gmailworkstatus'], queryFn: getGmailWorkStatus }).catch(() => {})
        qc.fetchQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus }).catch(() => {})
    }, [qc])

    // Health check polling
    useEffect(() => {
        const check = () => getHealth().then(() => setApiOk(true)).catch(() => setApiOk(false))
        check()
        const id = setInterval(check, 15_000)
        return () => clearInterval(id)
    }, [])

    // WebSocket subscriptions for worker and bot statuses
    useEffect(() => {
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
        const wWorker = new WebSocket(`${proto}://${window.location.host}/api/ws/worker/status`)
        const wBot = new WebSocket(`${proto}://${window.location.host}/api/ws/bot/status`)

        wWorker.onmessage = (e) => {
            try { qc.setQueryData(['gmailworkstatus'], JSON.parse(e.data)) } catch 
            {
                /* ignore */
            }
        }
        wBot.onmessage = (e) => {
            try { qc.setQueryData(['chatworkstatus'], JSON.parse(e.data)) } catch {
                /* ignore */
            }
        }

        return () => {
            try { wWorker.close() } catch {
                /* ignore */
            }
            try { wBot.close() } catch {
                /* ignore */
            }
        }
    }, [qc])

    // react-query hooks to read status (will react to cache updates)
    const { data: worker } = useQuery({ queryKey: ['gmailworkstatus'], queryFn: getGmailWorkStatus, enabled: false })
    const { data: bot } = useQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus, enabled: false })

    return (
        <div className="flex items-center justify-center h-full p-8">
            <div className="max-w-3xl text-center">
                <h1 className="text-3xl font-bold text-white mb-4">{t('home.intro.title')}</h1>
                <p className="text-lg text-[#94a3b8] mb-6">{t('home.intro.subtitle')}</p>
                <div className="flex justify-center gap-3 mb-6">
                    <Link to="/skill" className="px-4 py-2 rounded bg-[#3b82f6] text-white font-semibold">{t('home.intro.open_skill')}</Link>
                </div>

                <div className="flex items-center gap-3 justify-center">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2330] border border-[#2d3748] rounded-lg text-xs text-[#94a3b8]">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${apiOk === true ? 'bg-[#22c55e]' : apiOk === false ? 'bg-[#ef4444]' : 'bg-[#64748b]'}`} />
                        <span>{apiOk === true ? t('home.status.ok') : apiOk === false ? t('home.status.err') : t('home.status.checking')}</span>
                    </div>

                    <div className={`px-3 py-1.5 rounded-lg text-xs border ${worker?.running ? 'bg-[#052e16] border-[#166534] text-[#86efac]' : 'bg-[#0b0e14] border-[#2d3748] text-[#64748b]'}`}>
                        {'Gmail: ' + (worker?.running ? t('home.worker.running') : t('home.worker.stopped'))}
                    </div>

                    <div className={`px-3 py-1.5 rounded-lg text-xs border ${bot?.running ? 'bg-[#052e16] border-[#166534] text-[#86efac]' : 'bg-[#0b0e14] border-[#2d3748] text-[#64748b]'}`}>
                        {'Bot: ' + (bot?.running ? t('home.worker.running') : t('home.worker.stopped'))}
                    </div>
                </div>
            </div>
        </div>
    )
}
