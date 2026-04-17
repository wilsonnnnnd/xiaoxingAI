import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useQueryClient } from '@tanstack/react-query'
import { getGmailWorkStatus } from '../features/gmail/api'
import { useHealthCheck } from '../hooks/useHealthCheck'
import { useWorkerStatus } from '../hooks/useWorkerStatus'

export default function Home() {
    const { t } = useI18n()
    const qc = useQueryClient()
    const { ok: apiOk, userCount } = useHealthCheck()
    const token = localStorage.getItem('auth_token')
    const isAuthed = !!token
    const { gmailWorker } = useWorkerStatus()

    // Initial fetch to populate caches
    useEffect(() => {
        if (!isAuthed) return
        qc.fetchQuery({ queryKey: ['gmailworkstatus'], queryFn: getGmailWorkStatus }).catch(() => {})
    }, [qc, isAuthed])

    const displayUsers = userCount == null ? null : userCount + 10
    const usersText = displayUsers == null ? '—' : String(displayUsers)
    const apiStatusText = apiOk === true ? t('home.status.ok') : apiOk === false ? t('home.status.err') : t('home.status.checking')
    const workerText = gmailWorker?.running ? t('home.worker.running') : t('home.worker.stopped')

    return (
        <div className="relative flex items-center justify-center h-full p-4 sm:p-8 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-[#60a5fa] via-[#6366f1] to-[#22c55e]" />
            </div>

            <div className="relative max-w-5xl w-full text-center">
                <h1 className="text-4xl font-bold text-white tracking-tight mb-4">{t('home.intro.title')}</h1>
                <p className="text-base sm:text-lg text-[#94a3b8] mb-8 leading-relaxed">{t('home.intro.subtitle')}</p>

                <div className="flex justify-center gap-3 mb-8 flex-wrap">
                    {isAuthed ? (
                        <Link to="/skill" className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] active:bg-[#4338ca] text-white font-semibold transition-colors duration-200">
                            {t('home.intro.open_skill')}
                        </Link>
                    ) : (
                        <Link to="/login" className="px-4 py-2 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] active:bg-[#15803d] text-white font-semibold transition-colors duration-200">
                            {t('btn.login')}
                        </Link>
                    )}
                    <Link to="/help" className="px-4 py-2 rounded-lg bg-[#0b1220] border border-[#1f2a3a] hover:border-[#334155] text-[#e2e8f0] font-semibold transition-colors duration-200">
                        {t('nav.help')}
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="relative overflow-hidden rounded-2xl border border-[#1f2a3a] bg-[#0b1220]">
                        <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-[#60a5fa] via-[#6366f1] to-[#22c55e]" />
                        <div className="relative p-5 text-left">
                            <div className="text-xs text-[#cbd5e1] font-semibold tracking-wide">{t('home.stats.users')}</div>
                            <div className="mt-2 flex items-end justify-end gap-2">
                                <div className="text-6xl font-extrabold tabular-nums tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-[#cbd5e1] drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]">
                                    {usersText}
                                </div>
                                {displayUsers != null && (
                                    <div className="pb-2 text-xl font-bold text-[#e2e8f0] opacity-90">+</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5 text-left">
                        <div className="text-xs text-[#cbd5e1] font-semibold tracking-wide">{t('home.stats.service')}</div>
                        <div className="mt-3 flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${apiOk === true ? 'bg-[#22c55e]' : apiOk === false ? 'bg-[#ef4444]' : 'bg-[#64748b]'}`} />
                            <span className="text-sm text-[#94a3b8]">{apiStatusText}</span>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5 text-left">
                        <div className="text-xs text-[#cbd5e1] font-semibold tracking-wide">{t('home.stats.gmail_worker')}</div>
                        {isAuthed ? (
                            <div className="mt-3 flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${gmailWorker?.running ? 'bg-[#22c55e]' : 'bg-[#64748b]'}`} />
                                <span className="text-sm text-[#94a3b8]">{workerText}</span>
                            </div>
                        ) : (
                            <div className="mt-3 text-sm text-[#64748b]">{t('home.stats.login_required')}</div>
                        )}
                    </div>
                </div>

                <div className="mt-10 text-left grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                        <div className="text-sm font-bold text-white">{t('home.about.brand_title')}</div>
                        <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.about.brand_body')}</p>
                        <div className="mt-3 text-xs text-[#64748b]">
                            {t('home.about.hosted_on')} <span className="text-[#e2e8f0]">https://xiaoxingai.online</span>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                        <div className="text-sm font-bold text-white">{t('home.about.features_title')}</div>
                        <ul className="mt-2 text-sm text-[#94a3b8] leading-6 list-disc pl-5 space-y-1">
                            <li>{t('home.about.features.gmail')}</li>
                            <li>{t('home.about.features.telegram')}</li>
                            <li>{t('home.about.features.outgoing')}</li>
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                        <div className="text-sm font-bold text-white">{t('home.about.data_title')}</div>
                        <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.about.data_body')}</p>
                        <div className="mt-4 flex items-center gap-3 flex-wrap">
                            <Link
                                to="/privacy"
                                className="px-3 py-2 rounded-lg bg-[#0b1220] border border-[#1f2a3a] hover:border-[#334155] text-[#e2e8f0] text-sm font-semibold transition-colors duration-200"
                            >
                                {t('home.about.privacy_link')}
                            </Link>
                            <Link
                                to="/terms"
                                className="px-3 py-2 rounded-lg bg-[#0b1220] border border-[#1f2a3a] hover:border-[#334155] text-[#e2e8f0] text-sm font-semibold transition-colors duration-200"
                            >
                                {t('home.about.terms_link')}
                            </Link>
                        </div>
                        <div className="mt-3 text-xs text-[#64748b] leading-5">{t('home.about.no_login_note')}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
