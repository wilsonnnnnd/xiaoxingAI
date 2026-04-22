import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useQueryClient } from '@tanstack/react-query'
import { getGmailWorkStatus } from '../features/gmail/api'
import { useHealthCheck } from '../hooks/useHealthCheck'
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
                'relative overflow-hidden rounded-[28px] border border-white/70',
                'bg-[rgba(255,255,255,0.72)] backdrop-blur-[18px]',
                'ring-1 ring-black/[0.035]',
                'shadow-[0_12px_40px_rgba(15,23,42,0.05)]',
                'before:pointer-events-none before:absolute before:inset-0',
                'before:bg-[linear-gradient(180deg,rgba(255,255,255,0.52)_0%,rgba(255,255,255,0.16)_38%,transparent_100%)]',
                className,
            ].join(' ')}
        >
            <div className="relative">{children}</div>
        </div>
    )
}


type InfoCardProps = {
    title: string
    body: string
}

function InfoCard({ title, body }: InfoCardProps) {
    return (
        <Surface className="h-full p-5 sm:p-6 transition-all duration-300 hover:-translate-y-[1px] hover:bg-white/82">
            <div className="text-sm font-semibold tracking-[-0.02em] text-slate-900">{title}</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
        </Surface>
    )
}

type StepCardProps = {
    step: string
    body: string
    index: string
}

function StepCard({ step, body, index }: StepCardProps) {
    return (
        <Surface className="h-full p-5 sm:p-6 transition-all duration-300 hover:bg-white/82">
            <div className="flex items-start justify-between gap-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{step}</div>
                <div className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-slate-500">
                    {index}
                </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">{body}</p>
        </Surface>
    )
}

function SectionHeader({
    eyebrow,
    title,
    body,
}: {
    eyebrow?: string
    title: string
    body: string
}) {
    return (
        <div className="max-w-2xl">
            {eyebrow ? (
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{eyebrow}</div>
            ) : null}
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[28px]">
                {title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-[15px]">{body}</p>
        </div>
    )
}

function FooterLink({
    href,
    title,
    label,
    children,
}: {
    href: string
    title: string
    label: string
    children: React.ReactNode
}) {
    return (
        <a
            href={href}
            target={href.startsWith('mailto:') ? undefined : '_blank'}
            rel={href.startsWith('mailto:') ? undefined : 'noreferrer'}
            className={[
                'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold',
                'border border-white/70 bg-white/72 backdrop-blur-xl',
                'text-slate-600 ring-1 ring-black/[0.03]',
                'shadow-[0_6px_18px_rgba(15,23,42,0.04)]',
                'transition-all duration-200 hover:bg-white/84 hover:text-slate-900',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.95)]',
                'focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(248,250,252,1)]',
            ].join(' ')}
            aria-label={label}
            title={title}
        >
            {children}
            {label}
        </a>
    )
}

function PrimaryAction({ to, children }: { to: string; children: React.ReactNode }) {
    return (
        <Link
            to={to}
            className={[
                'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold',
                'bg-[rgba(217,235,255,0.96)] text-[#0b3c5d]',
                'border border-white/80 ring-1 ring-black/[0.03]',
                'shadow-[0_10px_24px_rgba(15,23,42,0.05)]',
                'transition-all duration-200 hover:-translate-y-[1px] hover:brightness-[1.015]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.95)]',
                'focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(248,250,252,1)]',
            ].join(' ')}
        >
            {children}
        </Link>
    )
}

export default function Home() {
    const { t } = useI18n()
    const qc = useQueryClient()
    const { ok: apiOk } = useHealthCheck()
    const token = localStorage.getItem('auth_token')
    const isAuthed = !!token
    useEffect(() => {
        if (!isAuthed) return
        qc.fetchQuery({ queryKey: ['gmailworkstatus'], queryFn: getGmailWorkStatus }).catch(() => { })
    }, [qc, isAuthed])

    const apiStatusText =
        apiOk === true
            ? t('home.status.ok')
            : apiOk === false
                ? t('home.status.err')
                : t('home.status.checking')


    return (
        <div
            className={[
                'relative min-h-screen overflow-hidden px-4 py-6 sm:px-8 sm:py-8',
                'bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,251,255,0.97)_48%,rgba(244,248,253,0.96)_100%)]',
            ].join(' ')}
        >
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.62),transparent_48%)]" />
                <div className="absolute left-[-8%] top-[16%] h-[340px] w-[340px] rounded-full bg-[rgba(217,235,255,0.22)] blur-3xl" />
                <div className="absolute right-[-6%] top-[28%] h-[280px] w-[280px] rounded-full bg-[rgba(231,243,255,0.22)] blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-6xl">
                <section className="pt-2 sm:pt-6">
                    <Surface className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
                        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_320px] lg:items-end">
                            <div>
                                <h1 className="mt-5 max-w-3xl text-[42px] font-semibold leading-[0.92] tracking-[-0.07em] text-slate-900 sm:text-[56px] lg:text-[64px]">
                                    {t('home.intro.title')}
                                </h1>

                                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                                    {t('home.intro.subtitle')}
                                </p>

                                <div className="mt-6 flex flex-wrap gap-3">
                                    {isAuthed ? (
                                        <PrimaryAction to="/skill">{t('home.intro.open_skill')}</PrimaryAction>
                                    ) : (
                                        <PrimaryAction to="/login">{t('btn.login')}</PrimaryAction>
                                    )}

                                    <Link
                                        to="/privacy"
                                        className="inline-flex items-center justify-center rounded-full border border-white/75 bg-white/65 px-4 py-2.5 text-sm font-semibold text-slate-600 ring-1 ring-black/[0.03] transition-all duration-200 hover:bg-white/82 hover:text-slate-900"
                                    >
                                        {t('nav.privacy')}
                                    </Link>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">

                                <Surface className="p-4 sm:p-5">
                                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                        {t('home.stats.service')}
                                    </div>
                                    <div className="mt-3 flex items-center gap-3">
                                        <span
                                            className={[
                                                'h-2.5 w-2.5 rounded-full',
                                                apiOk === true ? 'bg-emerald-500' : apiOk === false ? 'bg-rose-500' : 'bg-slate-300',
                                            ].join(' ')}
                                        />
                                        <span className="text-sm font-medium text-slate-700">{apiStatusText}</span>
                                    </div>
                                </Surface>
                            </div>
                        </div>
                    </Surface>
                </section>

                <section className="mt-16">
                    <SectionHeader
                        eyebrow="Overview"
                        title={t('home.section.what.title')}
                        body={t('home.section.what.subtitle')}
                    />

                    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <InfoCard title={t('home.what.gmail.title')} body={t('home.what.gmail.body')} />
                        <InfoCard title={t('home.what.telegram.title')} body={t('home.what.telegram.body')} />
                        <InfoCard title={t('home.what.outgoing.title')} body={t('home.what.outgoing.body')} />
                    </div>
                </section>

                <section className="mt-16">
                    <SectionHeader
                        eyebrow="Flow"
                        title={t('home.section.how.title')}
                        body={t('home.section.how.subtitle')}
                    />

                    <ol className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <li>
                            <StepCard index="01" step={t('home.how.step1.title')} body={t('home.how.step1.body')} />
                        </li>
                        <li>
                            <StepCard index="02" step={t('home.how.step2.title')} body={t('home.how.step2.body')} />
                        </li>
                        <li>
                            <StepCard index="03" step={t('home.how.step3.title')} body={t('home.how.step3.body')} />
                        </li>
                        <li>
                            <StepCard index="04" step={t('home.how.step4.title')} body={t('home.how.step4.body')} />
                        </li>
                    </ol>
                </section>

                <section className="mt-16">
                    <SectionHeader
                        eyebrow="Trust & Data"
                        title={t('home.section.data.title')}
                        body={t('home.section.data.subtitle')}
                    />

                    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Surface className="p-5 sm:p-6 transition-all duration-300 hover:bg-white/82">
                            <div className="text-sm font-semibold tracking-[-0.02em] text-slate-900">
                                {t('home.data.scope.title')}
                            </div>
                            <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
                                <li className="flex gap-3">
                                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                    <span>{t('home.data.scope.modify')}</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                    <span>{t('home.data.scope.send')}</span>
                                </li>
                            </ul>
                        </Surface>

                        <Surface className="p-5 sm:p-6 transition-all duration-300 hover:bg-white/82">
                            <div className="text-sm font-semibold tracking-[-0.02em] text-slate-900">
                                {t('home.data.storage.title')}
                            </div>
                            <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
                                <li className="flex gap-3">
                                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                    <span>{t('home.data.storage.no_body')}</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                    <span>{t('home.data.storage.tokens')}</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                    <span>{t('home.data.storage.metadata')}</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                    <span>{t('home.data.storage.attachments')}</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                    <span>{t('home.data.storage.outgoing')}</span>
                                </li>
                            </ul>
                        </Surface>
                    </div>
                </section>

                <footer className="mt-20 pb-8 pt-6">
                    <Surface className="px-5 py-8 sm:px-8">
                        <div className="mx-auto max-w-4xl text-center">
                            <p className="mx-auto max-w-2xl text-xs leading-relaxed text-slate-500">
                                {t('home.footer.ack')}
                            </p>

                            <div className="my-7 h-px w-full bg-[linear-gradient(90deg,transparent,rgba(203,213,225,0.7),transparent)]" />

                            <div className="space-y-1">
                                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                                    {t('home.footer.dev.title')}
                                </p>
                                <p className="text-sm font-semibold text-slate-900">{t('home.footer.dev.line1')}</p>
                            </div>

                            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                                <FooterLink
                                    href={`mailto:${DEVELOPER.email}`}
                                    title={DEVELOPER.email}
                                    label={t('home.footer.link.email')}
                                >
                                    <MailIcon className="h-4 w-4" />
                                </FooterLink>

                                <FooterLink
                                    href={DEVELOPER.website}
                                    title={DEVELOPER.website}
                                    label={t('home.footer.link.resume')}
                                >
                                    <GlobeIcon className="h-4 w-4" />
                                </FooterLink>

                                <FooterLink href={DEVELOPER.github} title={DEVELOPER.github} label="GitHub">
                                    <GitHubIcon className="h-4 w-4" />
                                </FooterLink>

                                <FooterLink href={DEVELOPER.linkedin} title={DEVELOPER.linkedin} label="LinkedIn">
                                    <LinkedInIcon className="h-4 w-4" />
                                </FooterLink>
                            </div>

                            <div className="mt-7 flex justify-center gap-6 text-sm">
                                <Link to="/privacy" className="text-slate-500 transition-colors hover:text-slate-900">
                                    {t('nav.privacy')}
                                </Link>

                                <Link to="/terms" className="text-slate-500 transition-colors hover:text-slate-900">
                                    {t('nav.terms')}
                                </Link>
                            </div>
                        </div>
                    </Surface>
                </footer>
            </div>
        </div>
    )
}
