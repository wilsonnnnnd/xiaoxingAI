import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useQueryClient } from '@tanstack/react-query'
import { getGmailWorkStatus } from '../features/gmail/api'
import { useHealthCheck } from '../hooks/useHealthCheck'
import { useWorkerStatus } from '../hooks/useWorkerStatus'
import { DEVELOPER } from '../constants/developer'
import { GitHubIcon, GlobeIcon, LinkedInIcon, MailIcon } from '../components/common/Icons'

export default function Home() {
    const { t } = useI18n()
    const qc = useQueryClient()
    const { ok: apiOk, userCount } = useHealthCheck()
    const token = localStorage.getItem('auth_token')
    const isAuthed = !!token
    const { gmailWorker } = useWorkerStatus()

    useEffect(() => {
        if (!isAuthed) return
        qc.fetchQuery({ queryKey: ['gmailworkstatus'], queryFn: getGmailWorkStatus }).catch(() => { })
    }, [qc, isAuthed])

    const displayUsers = userCount == null ? null : userCount + 10
    const usersText = displayUsers == null ? '—' : String(displayUsers)
    const apiStatusText = apiOk === true ? t('home.status.ok') : apiOk === false ? t('home.status.err') : t('home.status.checking')
    const workerText = gmailWorker?.running ? t('home.worker.running') : t('home.worker.stopped')

    return (
        <div className="relative min-h-full p-4 sm:p-8">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-[#60a5fa] via-[#6366f1] to-[#22c55e]" />
            </div>

            <div className="relative max-w-5xl mx-auto w-full">
                <div className="text-center pt-6 sm:pt-10">
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-4">{t('home.intro.title')}</h1>
                    <p className="text-base sm:text-lg text-[#94a3b8] mb-6 leading-relaxed">{t('home.intro.subtitle')}</p>
                </div>

                <div className="flex justify-center gap-3 mb-8 flex-wrap mt-6">
                    {isAuthed ? (
                        <Link to="/skill" className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] active:bg-[#4338ca] text-white font-semibold transition-colors duration-200">
                            {t('home.intro.open_skill')}
                        </Link>
                    ) : (
                        <Link to="/login" className="px-4 py-2 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] active:bg-[#15803d] text-white font-semibold transition-colors duration-200">
                            {t('btn.login')}
                        </Link>
                    )}

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

                <div className="mt-12 text-left">
                    <h2 className="text-xl font-bold text-white">{t('home.section.what.title')}</h2>
                    <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.section.what.subtitle')}</p>
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                            <div className="text-sm font-bold text-white">{t('home.what.gmail.title')}</div>
                            <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.what.gmail.body')}</p>
                        </div>
                        <div className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                            <div className="text-sm font-bold text-white">{t('home.what.telegram.title')}</div>
                            <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.what.telegram.body')}</p>
                        </div>
                        <div className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                            <div className="text-sm font-bold text-white">{t('home.what.outgoing.title')}</div>
                            <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.what.outgoing.body')}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-10 text-left">
                    <h2 className="text-xl font-bold text-white">{t('home.section.how.title')}</h2>
                    <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.section.how.subtitle')}</p>
                    <ol className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <li className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                            <div className="text-xs text-[#cbd5e1] font-semibold tracking-wide">{t('home.how.step1.title')}</div>
                            <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.how.step1.body')}</p>
                        </li>
                        <li className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                            <div className="text-xs text-[#cbd5e1] font-semibold tracking-wide">{t('home.how.step2.title')}</div>
                            <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.how.step2.body')}</p>
                        </li>
                        <li className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                            <div className="text-xs text-[#cbd5e1] font-semibold tracking-wide">{t('home.how.step3.title')}</div>
                            <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.how.step3.body')}</p>
                        </li>
                        <li className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                            <div className="text-xs text-[#cbd5e1] font-semibold tracking-wide">{t('home.how.step4.title')}</div>
                            <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.how.step4.body')}</p>
                        </li>
                    </ol>
                </div>

                <div className="mt-10 text-left">
                    <h2 className="text-xl font-bold text-white">{t('home.section.data.title')}</h2>
                    <p className="mt-2 text-sm text-[#94a3b8] leading-6">{t('home.section.data.subtitle')}</p>
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                            <div className="text-sm font-bold text-white">{t('home.data.scope.title')}</div>
                            <ul className="mt-2 text-sm text-[#94a3b8] leading-6 list-disc pl-5 space-y-1">
                                <li>{t('home.data.scope.modify')}</li>
                                <li>{t('home.data.scope.send')}</li>
                            </ul>
                        </div>
                        <div className="rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-5">
                            <div className="text-sm font-bold text-white">{t('home.data.storage.title')}</div>
                            <ul className="mt-2 text-sm text-[#94a3b8] leading-6 list-disc pl-5 space-y-1">
                                <li>{t('home.data.storage.no_body')}</li>
                                <li>{t('home.data.storage.tokens')}</li>
                                <li>{t('home.data.storage.metadata')}</li>
                                <li>{t('home.data.storage.attachments')}</li>
                                <li>{t('home.data.storage.outgoing')}</li>
                            </ul>
                        </div>
                    </div>
                </div>



                <footer className="mt-16 border-t border-zinc-800 pt-10 pb-8">
                    <div className="max-w-4xl mx-auto px-4 text-center">

                        <p className="text-xs text-zinc-500 leading-relaxed max-w-2xl mx-auto">
                            {t('home.footer.ack')}
                        </p>

                        <div className="my-6 h-px w-full bg-zinc-800" />

                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-widest text-zinc-600">
                                {t('home.footer.dev.title')}
                            </p>

                            <p className="text-sm font-semibold text-zinc-200">
                                {t('home.footer.dev.line1')}
                            </p>
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
                            <a
                                href={`mailto:${DEVELOPER.email}`}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                aria-label={t('home.footer.link.email')}
                                title={DEVELOPER.email}
                            >
                                <MailIcon className="w-4 h-4" />
                                {t('home.footer.link.email')}
                            </a>
                            <a
                                href={DEVELOPER.website}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                aria-label={t('home.footer.link.resume')}
                                title={DEVELOPER.website}
                            >
                                <GlobeIcon className="w-4 h-4" />
                                {t('home.footer.link.resume')}
                            </a>
                            <a
                                href={DEVELOPER.github}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                aria-label={t('home.footer.link.github')}
                                title={DEVELOPER.github}
                            >
                                <GitHubIcon className="w-4 h-4" />
                                GitHub
                            </a>
                            <a
                                href={DEVELOPER.linkedin}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                aria-label={t('home.footer.link.linkedin')}
                                title={DEVELOPER.linkedin}
                            >
                                <LinkedInIcon className="w-4 h-4" />
                                LinkedIn
                            </a>
                        </div>

                        <div className="mt-6 flex justify-center gap-6 text-sm">
                            <Link
                                to="/privacy"
                                className="text-zinc-400 hover:text-blue-400 transition-colors"
                            >
                                {t('nav.privacy')}
                            </Link>

                            <Link
                                to="/terms"
                                className="text-zinc-400 hover:text-blue-400 transition-colors"
                            >
                                {t('nav.terms')}
                            </Link>
                        </div>

                    </div>
                </footer>
            </div>
        </div>
    )
}
