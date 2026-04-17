import React, { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../../../i18n/useI18n'
import { formatLogMessage } from '../../../utils/formatLog'
import {
    getGmailWorkStatus, getLogsWindow, clearLogs,
    startWorker, stopWorker, pollNow, getGmailAuthUrl
} from '../api'
import { getDbStats } from '../../system/api'
import { getMe, listUsers, listBots, testTelegram } from '../../users'
import type { LogEntry, WorkerStatus, User, Bot } from '../../../types'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { Badge } from '../../../components/common/Badge'
import { Surface } from '../../../components/common/Surface'
import toast from 'react-hot-toast'

const StatItem: React.FC<{ label: string; value: string | number; small?: boolean; className?: string }> = ({ label, value, small, className }) => (
    <div className={`rounded-2xl bg-white/55 border border-white/70 ring-1 ring-black/[0.03] px-4 py-3 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${className ?? ''}`}>
        <div className={`font-semibold tabular-nums text-slate-900 ${small ? 'text-sm' : 'text-xl'}`}>{value}</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
    </div>
)

const LEVEL_CLS: Record<string, string> = {
    warn: 'text-amber-800',
    error: 'text-rose-800',
}

const getTime = (ts: string) => ts.length <= 8 ? ts : ts.slice(11, 19)

const LogRow: React.FC<{ entry: LogEntry; usersMap: Map<number, string> }> = ({ entry, usersMap }) => {
    const { t } = useI18n()
    const stripped = entry.msg.replace(/\[user#\d+\]\s*/g, '')
    const display = formatLogMessage(stripped, t)
    const cls = LEVEL_CLS[entry.level] ?? (entry.msg.includes('✅') ? 'text-emerald-800' : 'text-slate-900')
    const userName = entry.user_id != null ? (usersMap.get(entry.user_id) ?? `#${entry.user_id}`) : null
    
    return (
        <div className={`flex gap-2 py-0.5 font-mono text-xs leading-5 ${cls}`}>
            <span className="text-slate-400 shrink-0 tabular-nums">[{getTime(entry.ts)}]</span>
            {userName && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] self-center bg-sky-50 text-sky-800 border border-sky-200">{userName}</span>
            )}
            {entry.tokens > 0 && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] self-center bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">{entry.tokens}t</span>
            )}
            <span className="flex-1 break-all">{display}</span>
        </div>
    )
}

export const GmailPage: React.FC = () => {
    const { t } = useI18n()
    const qc = useQueryClient()
    const logBoxRef = useRef<HTMLDivElement | null>(null)
    const logAtBottomRef = useRef(true)
    const [logFromDraft, setLogFromDraft] = useState('')
    const [logToDraft, setLogToDraft] = useState('')
    const [logFrom, setLogFrom] = useState<string | undefined>(undefined)
    const [logTo, setLogTo] = useState<string | undefined>(undefined)

    const { data: worker } = useQuery({ queryKey: ['gmailworkstatus'], queryFn: getGmailWorkStatus, refetchOnWindowFocus: false })
    const { data: stats } = useQuery({ queryKey: ['dbStats'], queryFn: getDbStats, refetchInterval: 10_000 })
    const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: Infinity })

    const autoRefreshLogs = !logFrom && !logTo
    const { data: logWindow } = useQuery<{ logs: LogEntry[]; from_ts: string | null; to_ts: string | null }>({
        queryKey: ['logs', 'email', logFrom ?? null, logTo ?? null],
        queryFn: () => getLogsWindow(20, 'email', undefined, logFrom, logTo),
        refetchInterval: autoRefreshLogs ? 8000 : false,
        refetchOnWindowFocus: false,
    })
    const displayLogs = logWindow?.logs ?? []

    const { data: allUsers = [] } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: async () => { try { return await listUsers() } catch { return [] } },
        staleTime: 60_000,
        enabled: me?.role === 'admin',
    })
    const usersMap = new Map<number, string>(allUsers.map((u: User) => [u.id, (u.email ?? '').split('@')[0]]))

    const { data: myBots = [] } = useQuery<Bot[]>({
        queryKey: ['bots', me?.id],
        queryFn: () => listBots(me!.id),
        enabled: me != null,
        staleTime: 30_000,
    })

    useEffect(() => {
        const el = logBoxRef.current
        if (!el) return
        if (!logAtBottomRef.current) return
        el.scrollTop = el.scrollHeight
    }, [displayLogs.length])

    const startMut = useMutation({
        mutationFn: startWorker,
        onSuccess: (data) => {
            qc.setQueryData<WorkerStatus>(['gmailworkstatus'], (old) => {
                const merged = { ...(old ?? {}), ...(data?.status ?? {}) }
                return {
                    running: merged.running ?? false,
                    interval: merged.interval ?? 60,
                    query: merged.query ?? '',
                    priorities: merged.priorities ?? [],
                    started_at: merged.started_at ?? null,
                    last_poll: merged.last_poll ?? null,
                    total_fetched: merged.total_fetched ?? 0,
                    total_sent: merged.total_sent ?? 0,
                    total_errors: merged.total_errors ?? 0,
                    total_tokens: merged.total_tokens ?? 0,
                    total_runtime_hours: merged.total_runtime_hours ?? 0,
                    last_error: merged.last_error ?? null,
                }
            })
            qc.invalidateQueries({ queryKey: ['gmailworkstatus'] })
            toast.success(t('home.worker.running'))
        }
    })

    const stopMut = useMutation({
        mutationFn: stopWorker,
        onSuccess: (data) => {
            qc.setQueryData<WorkerStatus>(['gmailworkstatus'], (old) => {
                const merged = { ...(old ?? {}), ...(data?.status ?? {}) }
                return {
                    running: merged.running ?? false,
                    interval: merged.interval ?? 60,
                    query: merged.query ?? '',
                    priorities: merged.priorities ?? [],
                    started_at: merged.started_at ?? null,
                    last_poll: merged.last_poll ?? null,
                    total_fetched: merged.total_fetched ?? 0,
                    total_sent: merged.total_sent ?? 0,
                    total_errors: merged.total_errors ?? 0,
                    total_tokens: merged.total_tokens ?? 0,
                    total_runtime_hours: merged.total_runtime_hours ?? 0,
                    last_error: merged.last_error ?? null,
                }
            })
            qc.invalidateQueries({ queryKey: ['gmailworkstatus'] })
            toast.success(t('home.worker.stopped'))
        }
    })

    const pollMut = useMutation({
        mutationFn: pollNow,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['gmailworkstatus'] })
            toast.success(t('home.btn.poll_now'))
        }
    })

    const clearMut = useMutation({
        mutationFn: () => clearLogs('email'),
        onSuccess: () => {
            qc.setQueryData(['logs', 'email'], { logs: [], from_ts: null, to_ts: null })
            qc.invalidateQueries({ queryKey: ['logs', 'email'] })
        }
    })

    const tgMut = useMutation({ 
        mutationFn: testTelegram, 
        onSuccess: () => toast.success(t('home.tg.test_ok'))
    })

    const workerRunning = worker?.running ?? false
    const authorized = stats?.has_token ?? false
    const notifyBots = myBots.filter(b => b.bot_mode === 'all' || b.bot_mode === 'notify')
    const hasNotifyBot = notifyBots.length > 0
    const isAdmin = me?.role === 'admin'
    const canStart = isAdmin && authorized && hasNotifyBot

    const fmt = (s?: string | null) => s ? s.replace('T', ' ').slice(0, 19) : '—'
    const fmtTs = (s?: string | null) => s ? s.replace('T', ' ').slice(0, 19) : ''
    const normTs = (v: string): string | undefined => {
        let s = v.trim()
        if (!s) return undefined
        s = s.replace(' ', 'T')
        if (s.length === 16) return `${s}:00`
        return s
    }

    const handleGoogleAuth = async () => {
        try {
            const url = await getGmailAuthUrl()
            window.open(url, '_blank')
        } catch {
            window.open(`${window.location.origin}/api/gmail/auth`, '_blank')
        }
    }

    return (
<div className="min-h-screen w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,252,255,0.96)_52%,rgba(246,249,253,0.95)_100%)]">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.45),transparent_70%)]" />

    <div className="relative flex flex-col h-full p-4 sm:p-5 gap-6 min-w-0 max-w-6xl mx-auto w-full">
        <Surface
            title={t('nav.skill.gmail')}
            eyebrow={t('nav.skill')}
            badge={authorized ? t('home.auth.ok') : t('home.auth.unauthorized')}
        >
            <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={authorized ? 'success' : 'warning'}>
                    {authorized ? '🔑 ' + t('home.auth.ok') : '⚠️ ' + t('home.auth.unauthorized')}
                    <button
                        onClick={handleGoogleAuth}
                        className="ml-2 underline underline-offset-4 text-[#0b3c5d] hover:text-slate-900 transition-colors"
                    >
                        {t('home.btn.google_auth')}
                    </button>
                </Badge>

                {stats && (
                    <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
                        <span className="rounded-full bg-white/70 px-3 py-1.5 border border-white/70 ring-1 ring-black/[0.03] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                            📧 {stats.email_records_count} records
                        </span>
                        <span className="rounded-full bg-white/70 px-3 py-1.5 border border-white/70 ring-1 ring-black/[0.03] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                            📋 {stats.log_count} logs
                        </span>
                    </div>
                )}
            </div>
        </Surface>

        <div className="grid grid-cols-1 gap-6 min-w-0">
            <Card
                title={t('home.card.worker')}
                subtitle={t('home.card.worker_desc')}
                rightSlot={
                    <Badge variant={workerRunning ? 'success' : 'neutral'}>
                        {workerRunning ? t('home.worker.running') : t('home.worker.stopped')}
                    </Badge>
                }
            >
                {!workerRunning && (
                    <div className="relative overflow-hidden rounded-[24px] bg-[rgba(255,255,255,0.72)] backdrop-blur-xl border border-white/80 ring-1 ring-black/[0.03] px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.25),rgba(255,255,255,0.05)_50%,transparent)]">
                        <div className="relative">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {t('worker.prereq.title')}
                            </p>

                            <div className="mt-3 flex flex-col gap-2">
                                <div
                                    className={`flex items-center gap-2 text-sm ${
                                        authorized ? 'text-emerald-800' : 'text-amber-800'
                                    }`}
                                >
                                    <span>{authorized ? '✅' : '⚠️'}</span>
                                    <span>{t('worker.prereq.google')}</span>
                                    {!authorized && (
                                        <button
                                            onClick={handleGoogleAuth}
                                            className="ml-1 text-xs underline underline-offset-4 text-[#0b3c5d] hover:text-slate-900 transition-colors"
                                        >
                                            {t('home.btn.google_auth')}
                                        </button>
                                    )}
                                </div>

                                <div
                                    className={`flex items-center gap-2 text-sm ${
                                        hasNotifyBot ? 'text-emerald-800' : 'text-amber-800'
                                    }`}
                                >
                                    <span>{hasNotifyBot ? '✅' : '⚠️'}</span>
                                    <span>{t('worker.prereq.bot')}</span>
                                    {!hasNotifyBot && (
                                        <a
                                            href="/settings"
                                            className="ml-1 text-xs underline underline-offset-4 text-[#0b3c5d] hover:text-slate-900 transition-colors"
                                        >
                                            {t('worker.prereq.bot_goto')}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2 flex-wrap mt-2">
                    {!workerRunning ? (
                        <Button onClick={() => startMut.mutate()} disabled={startMut.isPending || !canStart}>
                            {t('home.btn.start')}
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            className="text-rose-700 hover:text-rose-900 hover:bg-white/80 hover:border-rose-200"
                            onClick={() => stopMut.mutate()}
                            loading={stopMut.isPending}
                            disabled={!isAdmin}
                        >
                            {t('home.btn.stop')}
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        className="border border-[#0b3c5d] text-[#0b3c5d] hover:bg-white/80 hover:text-rose-900"
                        onClick={() => pollMut.mutate()}
                        loading={pollMut.isPending}
                        disabled={!isAdmin}
                    >
                        {t('home.btn.poll_now')}
                    </Button>
                    <Button variant="secondary" className="border border-[#0b3c5d] text-[#0b3c5d] hover:bg-white/80 hover:text-rose-900" onClick={() => tgMut.mutate()} loading={tgMut.isPending}>
                        {t('home.btn.test_tg')}
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <StatItem label={t('home.stat.sent')} value={worker?.total_sent ?? '—'} />
                    <StatItem label={t('home.stat.fetched')} value={worker?.total_fetched ?? '—'} />
                    <StatItem label={t('home.stat.errors')} value={worker?.total_errors ?? '—'} />
                    <StatItem label={t('home.stat.interval')} value={worker?.interval ? worker.interval + 's' : '—'} small />
                    <StatItem label={t('home.stat.last_poll')} value={fmt(worker?.last_poll)?.slice(5)} small />
                    <StatItem label={t('home.stat.started')} value={fmt(worker?.started_at)?.slice(5)} small />
                    <StatItem
                        label={t('home.stat.tokens')}
                        value={worker?.total_tokens != null ? worker.total_tokens.toLocaleString() : '—'}
                        small
                    />
                    <StatItem
                        label={t('home.stat.runtime')}
                        value={worker?.total_runtime_hours != null ? `${worker.total_runtime_hours}h` : '—'}
                        small
                        className="col-span-full sm:col-span-1"
                    />
                </div>

                {worker?.last_error && (
                    <div className="rounded-[22px] border border-rose-200/70 bg-[rgba(255,255,255,0.82)] backdrop-blur-xl px-4 py-3 mt-2 text-xs text-rose-900 ring-1 ring-black/[0.03] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                        <span className="font-semibold mr-1">{t('home.worker.last_error')}</span>
                        {worker.last_error}
                    </div>
                )}
            </Card>

            <Card
                title={t('home.worker.log_title')}
                subtitle={logWindow?.from_ts && logWindow?.to_ts ? `${fmtTs(logWindow.from_ts)} ~ ${fmtTs(logWindow.to_ts)}` : '—'}
                rightSlot={
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => clearMut.mutate()}
                        disabled={clearMut.isPending || displayLogs.length === 0}
                    >
                        {t('home.worker.log_clear')}
                    </Button>
                }
            >
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3">
                    <InputField label="From" type="datetime-local" value={logFromDraft} onChange={setLogFromDraft} />
                    <InputField label="To" type="datetime-local" value={logToDraft} onChange={setLogToDraft} />
                    <Button
                        variant="secondary"
                        size="md"
                        className="h-10 self-end"
                        onClick={() => {
                            setLogFrom(normTs(logFromDraft))
                            setLogTo(normTs(logToDraft))
                        }}
                    >
                        Apply
                    </Button>
                    <Button
                        variant="ghost"
                        size="md"
                        className="h-10 self-end"
                        onClick={() => {
                            setLogFromDraft('')
                            setLogToDraft('')
                            setLogFrom(undefined)
                            setLogTo(undefined)
                        }}
                    >
                        Clear
                    </Button>
                </div>

                <div
                    ref={logBoxRef}
                    className="mt-3 rounded-[24px] bg-[rgba(255,255,255,0.72)] backdrop-blur-xl border border-white/80 ring-1 ring-black/[0.03] p-4 flex-1 overflow-y-auto font-mono text-xs leading-relaxed max-h-[360px] shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                    onScroll={(e) => {
                        const el = e.currentTarget
                        logAtBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
                    }}
                >
                    {displayLogs.length === 0 ? (
                        <div className="text-slate-400 text-center pt-12">— No logs —</div>
                    ) : (
                        displayLogs.map((e) => <LogRow key={e.id} entry={e} usersMap={usersMap} />)
                    )}
                </div>
            </Card>
        </div>
    </div>
</div>
    )
}
