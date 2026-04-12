import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useQueryClient } from '@tanstack/react-query'
import { getGmailWorkStatus } from '../features/gmail/api'
import { getChatWorkStatus } from '../features/chat/api'
import { useHealthCheck } from '../hooks/useHealthCheck'
import { useWorkerStatus } from '../hooks/useWorkerStatus'
import { Badge } from '../components/common/Badge'

export default function Home() {
    const { t } = useI18n()
    const qc = useQueryClient()
    const apiOk = useHealthCheck()
    const { gmailWorker, chatBot } = useWorkerStatus()

    // Initial fetch to populate caches
    useEffect(() => {
        qc.fetchQuery({ queryKey: ['gmailworkstatus'], queryFn: getGmailWorkStatus }).catch(() => {})
        qc.fetchQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus }).catch(() => {})
    }, [qc])

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

                    <Badge variant={gmailWorker?.running ? 'success' : 'neutral'}>
                        {'Gmail: ' + (gmailWorker?.running ? t('home.worker.running') : t('home.worker.stopped'))}
                    </Badge>

                    <Badge variant={chatBot?.running ? 'success' : 'neutral'}>
                        {'Bot: ' + (chatBot?.running ? t('home.worker.running') : t('home.worker.stopped'))}
                    </Badge>
                </div>
            </div>
        </div>
    )
}
