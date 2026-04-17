import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useQueryClient } from '@tanstack/react-query'
import { getGmailWorkStatus } from '../features/gmail/api'
import { useHealthCheck } from '../hooks/useHealthCheck'
import { useWorkerStatus } from '../hooks/useWorkerStatus'
import { DEVELOPER } from '../constants/developer'
import { GitHubIcon, GlobeIcon, LinkedInIcon, MailIcon } from '../components/common/Icons'

type SurfaceProps = {
    className?: string
    children: React.ReactNode
}

function Surface({ className = '', children }: SurfaceProps) {
    return (
        <div
            className={[
                'rounded-[24px] border border-white/70 bg-white/72 backdrop-blur-xl',
                'ring-1 ring-black/[0.03]',
                'shadow-[0_8px_24px_rgba(15,23,42,0.04)]',
                'bg-[linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0.1)_42%,transparent)]',
                className,
            ].join(' ')}
        >
            {children}
        </div>
    )
}

type StatCardProps = {
    label: string
    value: string
    suffix?: string
    note?: string
}

function StatCard({ label, value, suffix, note }: StatCardProps) {
    return (
        <Surface className="p-5 sm:p-6 transition-all duration-200 hover:bg-white/80">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>

            <div className="mt-4 flex items-end gap-2">
                <div className="text-4xl font-semibold tracking-[-0.05em] text-slate-900 tabular-nums sm:text-5xl">
                    {value}
                </div>
                {suffix ? <div className="pb-1 text-lg font-semibold text-slate-500">{suffix}</div> : null}
            </div>

            {note ? <div className="mt-4 text-xs leading-5 text-slate-500">{note}</div> : null}
        </Surface>
    )
}

type StatusCardProps = {
    label: string
    statusText: string
    active?: boolean
    muted?: boolean
}

function StatusCard({ label, statusText, active = false, muted = false }: StatusCardProps) {
    return (
        <Surface className="p-5 sm:p-6 transition-all duration-200 hover:bg-white/80">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>

            <div className="mt-4 flex items-center gap-3">
                <span
                    className={[
                        'h-2.5 w-2.5 rounded-full shrink-0',
                        muted ? 'bg-slate-300' : active ? 'bg-[rgba(217,235,255,1)]' : 'bg-slate-300',
                    ].join(' ')}
                />
                <span className="text-sm text-slate-600">{statusText}</span>
            </div>
        </Surface>
    )
}

type InfoCardProps = {
    title: string
    body: string
}

function InfoCard({ title, body }: InfoCardProps) {
    return (
        <Surface className="p-5 sm:p-6 transition-all duration-200 hover:bg-white/80">
            <div className="text-sm font-semibold tracking-[-0.01em] text-slate-900">{title}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
        </Surface>
    )
}

type StepCardProps = {
    step: string
    body: string
}

function StepCard({ step, body }: StepCardProps) {
    return (
        <Surface className="p-5 sm:p-6 transition-all duration-200 hover:bg-white/80">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{step}</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
        </Surface>
    )
}

function FooterLink({ href, title, label, children }: { href: string; title: string; label: string; children: React.ReactNode }) {
    return (
        <a
            href={href}
            target={href.startsWith('mailto:') ? undefined : '_blank'}
            rel={href.startsWith('mailto:') ? undefined : 'noreferrer'}
            className={[
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold',
                'border border-white/70 bg-white/72 backdrop-blur-xl',
                'text-slate-600 ring-1 ring-black/[0.03]',
                'shadow-[0_6px_18px_rgba(15,23,42,0.04)]',
                'transition-all duration-200 hover:bg-white/82 hover:text-slate-900',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.9)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(248,250,252,1)]',
            ].join(' ')}
            aria-label={label}
            title={title}
        >
            {children}
            {label}
        </a>
    )
}

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
    const apiStatusText =
        apiOk === true ? t('home.status.ok') : apiOk === false ? t('home.status.err') : t('home.status.checking')
    const workerText = gmailWorker?.running ? t('home.worker.running') : t('home.worker.stopped')

    return (
        <div
            className="relative min-h-screen px-4 py-6 sm:px-8 sm:py-8
            bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,252,255,0.96)_52%,rgba(246,249,253,0.95)_100%)]
            "
        >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.45),transparent_70%)]" >

                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,252,255,0.96)_52%,rgba(246,249,253,0.95)_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.45),transparent_70%)]" />
            </div>

            <div className="relative mx-auto max-w-6xl">
                <section className="pt-4 sm:pt-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div
                                className={[
                                    'inline-flex items-center gap-2 rounded-full px-3 py-1',
                                    'border border-white/70 bg-white/72 backdrop-blur-xl',
                                    'text-[11px] uppercase tracking-[0.22em] text-slate-600',
                                    'ring-1 ring-black/[0.03] shadow-[0_6px_18px_rgba(15,23,42,0.04)]',
                                ].join(' ')}
                            >
                                <span className="inline-block h-2 w-2 rounded-full bg-[rgba(217,235,255,1)]" />
                                Product Surface
                            </div>

                            <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[0.96] tracking-[-0.06em] text-slate-900 sm:text-5xl">
                                {t('home.intro.title')}
                            </h1>

                            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                                {t('home.intro.subtitle')}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {isAuthed ? (
                                <Link
                                    to="/skill"
                                    className={[
                                        'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold',
                                        'bg-[rgba(217,235,255,0.92)] text-[#0b3c5d]',
                                        'border border-white/80 ring-1 ring-black/[0.03]',
                                        'shadow-[0_8px_20px_rgba(15,23,42,0.04)]',
                                        'transition-all duration-200 hover:brightness-[1.02]',
                                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.9)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(248,250,252,1)]',
                                    ].join(' ')}
                                >
                                    {t('home.intro.open_skill')}
                                </Link>
                            ) : (
                                <Link
                                    to="/login"
                                    className={[
                                        'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold',
                                        'bg-[rgba(217,235,255,0.92)] text-[#0b3c5d]',
                                        'border border-white/80 ring-1 ring-black/[0.03]',
                                        'shadow-[0_8px_20px_rgba(15,23,42,0.04)]',
                                        'transition-all duration-200 hover:brightness-[1.02]',
                                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.9)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(248,250,252,1)]',
                                    ].join(' ')}
                                >
                                    {t('btn.login')}
                                </Link>
                            )}
                        </div>
                    </div>
                </section>

                <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label={t('home.stats.users')}
                        value={usersText}
                        suffix={displayUsers != null ? '+' : undefined}
                        note={t('home.section.what.subtitle')}
                    />

                    <StatusCard label={t('home.stats.service')} statusText={apiStatusText} active={apiOk === true} muted={apiOk == null} />

                    <StatusCard
                        label={t('home.stats.gmail_worker')}
                        statusText={isAuthed ? workerText : t('home.stats.login_required')}
                        active={!!gmailWorker?.running}
                        muted={!isAuthed || !gmailWorker?.running}
                    />
                </section>

                <section className="mt-12">
                    <div className="max-w-2xl">
                        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-900">{t('home.section.what.title')}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{t('home.section.what.subtitle')}</p>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <InfoCard title={t('home.what.gmail.title')} body={t('home.what.gmail.body')} />
                        <InfoCard title={t('home.what.telegram.title')} body={t('home.what.telegram.body')} />
                        <InfoCard title={t('home.what.outgoing.title')} body={t('home.what.outgoing.body')} />
                    </div>
                </section>

                <section className="mt-12">
                    <div className="max-w-2xl">
                        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-900">{t('home.section.how.title')}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{t('home.section.how.subtitle')}</p>
                    </div>

                    <ol className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <li>
                            <StepCard step={t('home.how.step1.title')} body={t('home.how.step1.body')} />
                        </li>
                        <li>
                            <StepCard step={t('home.how.step2.title')} body={t('home.how.step2.body')} />
                        </li>
                        <li>
                            <StepCard step={t('home.how.step3.title')} body={t('home.how.step3.body')} />
                        </li>
                        <li>
                            <StepCard step={t('home.how.step4.title')} body={t('home.how.step4.body')} />
                        </li>
                    </ol>
                </section>

                <section className="mt-12">
                    <div className="max-w-2xl">
                        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-900">{t('home.section.data.title')}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{t('home.section.data.subtitle')}</p>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Surface className="p-5 sm:p-6 transition-all duration-200 hover:bg-white/80">
                            <div className="text-sm font-semibold tracking-[-0.01em] text-slate-900">{t('home.data.scope.title')}</div>
                            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-600 marker:text-slate-400">
                                <li>{t('home.data.scope.modify')}</li>
                                <li>{t('home.data.scope.send')}</li>
                            </ul>
                        </Surface>

                        <Surface className="p-5 sm:p-6 transition-all duration-200 hover:bg-white/80">
                            <div className="text-sm font-semibold tracking-[-0.01em] text-slate-900">{t('home.data.storage.title')}</div>
                            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-600 marker:text-slate-400">
                                <li>{t('home.data.storage.no_body')}</li>
                                <li>{t('home.data.storage.tokens')}</li>
                                <li>{t('home.data.storage.metadata')}</li>
                                <li>{t('home.data.storage.attachments')}</li>
                                <li>{t('home.data.storage.outgoing')}</li>
                            </ul>
                        </Surface>
                    </div>
                </section>

                <footer className="mt-16 border-t border-white/60 pt-10 pb-8">
                    <div className="mx-auto max-w-4xl px-4 text-center">
                        <p className="mx-auto max-w-2xl text-xs leading-relaxed text-slate-500">{t('home.footer.ack')}</p>

                        <div className="my-6 h-px w-full bg-white/60" />

                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('home.footer.dev.title')}</p>
                            <p className="text-sm font-semibold text-slate-900">{t('home.footer.dev.line1')}</p>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                            <FooterLink href={`mailto:${DEVELOPER.email}`} title={DEVELOPER.email} label={t('home.footer.link.email')}>
                                <MailIcon className="h-4 w-4" />
                            </FooterLink>

                            <FooterLink href={DEVELOPER.website} title={DEVELOPER.website} label={t('home.footer.link.resume')}>
                                <GlobeIcon className="h-4 w-4" />
                            </FooterLink>

                            <FooterLink href={DEVELOPER.github} title={DEVELOPER.github} label="GitHub">
                                <GitHubIcon className="h-4 w-4" />
                            </FooterLink>

                            <FooterLink href={DEVELOPER.linkedin} title={DEVELOPER.linkedin} label="LinkedIn">
                                <LinkedInIcon className="h-4 w-4" />
                            </FooterLink>
                        </div>

                        <div className="mt-6 flex justify-center gap-6 text-sm">
                            <Link to="/privacy" className="text-slate-500 transition-colors hover:text-slate-900">
                                {t('nav.privacy')}
                            </Link>

                            <Link to="/terms" className="text-slate-500 transition-colors hover:text-slate-900">
                                {t('nav.terms')}
                            </Link>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    )
}
