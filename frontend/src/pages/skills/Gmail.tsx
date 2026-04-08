import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/useI18n'
import { formatLogMessage } from '../../utils/formatLog'
import {
    getGmailWorkStatus, getChatWorkStatus, getDbStats, getLogs, clearLogs,
    startWorker, stopWorker, pollNow, testTelegram,
    getGmailAuthUrl, getMe, listUsers, type LogEntry, type WorkerStatus,
} from '../../api'

export type BotStatus = {
    running?: boolean
}


function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-[#1e2330] border border-[#2d3748] rounded-xl p-5 flex flex-col gap-3 ${className}`}>
            <h2 className="text-sm font-semibold text-[#cbd5e1]">{title}</h2>
            {children}
        </div>
    )
}

function Btn({
    onClick, disabled, variant = 'default', children,
}: {
    onClick?: () => void; disabled?: boolean
    variant?: 'default' | 'green' | 'red' | 'blue' | 'tg' | 'ghost'
    children: React.ReactNode
}) {
    const base = 'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
    const map = {
        default: 'bg-[#334155] hover:bg-[#475569] text-[#e2e8f0]',
        green: 'bg-[#15803d] hover:bg-[#166534] text-white',
        red: 'bg-[#7f1d1d] hover:bg-[#991b1b] text-white',
        blue: 'bg-[#1d4ed8] hover:bg-[#1e40af] text-white',
        tg: 'bg-[#0088cc] hover:bg-[#006fa8] text-white',
        ghost: 'text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#334155]',
    }
    return (
        <button className={`${base} ${map[variant]}`} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    )
}

function StatItem({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
    return (
        <div className="bg-[#0b0e14] rounded-lg p-3 text-center">
            <div className={`font-bold text-[#e2e8f0] ${small ? 'text-sm' : 'text-xl'}`}>{value}</div>
            <div className="text-xs text-[#64748b] mt-0.5">{label}</div>
        </div>
    )
}

const LEVEL_CLS: Record<string, string> = {
    warn: 'text-[#fbbf24]',
    error: 'text-[#fca5a5]',
}

const getTime = (ts: string) => ts.length <= 8 ? ts : ts.slice(11, 19)

function LogRow({ entry, usersMap }: { entry: LogEntry; usersMap: Map<number, string> }) {
    const { t } = useI18n()
    const display = formatLogMessage(entry.msg, t)
    const cls = LEVEL_CLS[entry.level] ?? (entry.msg.includes('✅') ? 'text-[#86efac]' : 'text-[#e2e8f0]')
    const userName = entry.user_id != null ? (usersMap.get(entry.user_id) ?? `#${entry.user_id}`) : null
    return (
        <div className={`flex gap-2 py-0.5 font-mono text-xs leading-5 ${cls}`}>
            <span className="text-[#475569] shrink-0">[{getTime(entry.ts)}]</span>
            {userName && (
                <span className="shrink-0 px-1 rounded text-[10px] self-center bg-[#1e3a5f] text-[#7dd3fc]">{userName}</span>
            )}
            {entry.tokens > 0 && (
                <span className="shrink-0 px-1 rounded text-[10px] self-center bg-[#1c2a1c] text-[#86efac]">{entry.tokens}t</span>
            )}
            <span className="flex-1 break-all">{display}</span>
        </div>
    )
}

export default function Gmail() {
    const { t } = useI18n()
    const qc = useQueryClient()
    const navigate = useNavigate()

    // Avoid continuous polling / cache-subscribe invalidation loops.
    // Fetch bot status only on demand (before user-triggered send actions).
    const [notice, setNotice] = useState("")
    const [errMsg, setErrMsg] = useState("")
    const logEndRef = useRef<HTMLDivElement>(null)

    const _apiErr = (e: unknown) =>
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (e instanceof Error ? e.message : String(e))

    const { data: worker } = useQuery({ queryKey: ['gmailworkstatus'], queryFn: getGmailWorkStatus, refetchOnWindowFocus: false })
    const { data: stats } = useQuery({ queryKey: ['dbStats'], queryFn: getDbStats, refetchInterval: 10_000 })
    const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: Infinity })


    const { data: displayLogs = [] } = useQuery({
        queryKey: ['logs', 'email'],
        queryFn: () => getLogs(200, 'email'),
        refetchInterval: false,
        refetchOnWindowFocus: false,
    })

    const { data: allUsers = [] } = useQuery({
        queryKey: ['users'],
        queryFn: async () => { try { return await listUsers() } catch { return [] } },
        staleTime: 60_000,
        enabled: me?.role === 'admin',
    })
    const usersMap = new Map<number, string>(allUsers.map((u: { id: number; email: string }) => [u.id, u.email.split('@')[0]]))


    useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [displayLogs.length])


    const startMut = useMutation({
        mutationFn: async () => {
            try {
                await qc.fetchQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus })
            } catch {
                /* ignore */
            }
            return startWorker()
        },
        onSuccess: (data) => {
            setErrMsg('')
            try {
                qc.setQueryData<WorkerStatus>(['gmailworkstatus'], (old) => ({
                    ...(old ?? {}),
                    ...(data?.status ?? {}),
                }))
            } catch {
                /* ignore */
            }
            qc.invalidateQueries({ queryKey: ['gmailworkstatus'] })
        },
        onError: (e) => {
            const raw = _apiErr(e)
            // Worker 无法启动最常见原因：还没有用户开启 worker_enabled
            if (raw.includes('worker_enabled')) {
                setErrMsg(
                    me?.role === 'admin'
                        ? raw  // admin 看原始提示并能直接跳转
                        : '当前账号未启用邮件轮询，请联系管理员开启 Worker 权限后再试'
                )
            } else {
                setErrMsg(raw)
            }
        },
    })

    const stopMut = useMutation({
        mutationFn: async () => {
            try {
                await qc.fetchQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus })
            } catch {
                /* ignore */
            }
            return stopWorker()
        },
        onSuccess: (data) => {
            setErrMsg('')
            try {
                qc.setQueryData<WorkerStatus>(['gmailworkstatus'], (old) => ({
                    ...(old ?? {}),
                    ...(data?.status ?? {}),
                }))
            } catch {
                /* ignore */
            }
            qc.invalidateQueries({ queryKey: ['gmailworkstatus'] })
        },
        onError: (e) => setErrMsg(_apiErr(e)),
    })

    const pollMut = useMutation({
        mutationFn: async () => {
            try {
                await qc.fetchQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus })
            } catch {
                /* ignore */
            }
            return pollNow()
        },
        onSuccess: () => {
            setErrMsg('')
            qc.invalidateQueries({ queryKey: ['gmailworkstatus'] })
        },
        onError: (e) => setErrMsg(_apiErr(e)),
    })

    const clearMut = useMutation({ mutationFn: () => clearLogs('email'), onSuccess: () => qc.invalidateQueries({ queryKey: ['logs', 'email'] }) })
    const tgMut = useMutation({ mutationFn: testTelegram, onSuccess: () => setNotice(t('home.tg.test_ok')), onError: (e) => setErrMsg(_apiErr(e)) })

    const workerRunning = worker?.running ?? false
    const authorized = stats?.has_token ?? false

    const fmt = (s?: string | null) => s ? s.replace('T', ' ').slice(0, 19) : '—'

    return (
        <div className="flex flex-col h-full p-5 gap-4 min-w-0">

            <div className="flex items-center gap-3 flex-wrap">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${authorized
                    ? 'bg-[#052e16] border-[#166534] text-[#86efac]'
                    : 'bg-[#431407] border-[#7c2d12] text-[#fbbf24]'
                    }`}>
                    {authorized ? '🔑 ' + t('home.auth.ok') : '⚠️ ' + t('home.auth.unauthorized')}
                    <button
                        onClick={async () => {
                            try {
                                const url = await getGmailAuthUrl()
                                window.open(url, '_blank')
                            } catch {
                                window.open(`${window.location.origin}/api/gmail/auth`, '_blank')
                            }
                        }}
                        className="ml-2 px-2 py-0.5 rounded bg-[#334155] hover:bg-[#475569] text-[#e2e8f0] transition-colors">
                        {t('home.btn.google_auth')}
                    </button>
                </div>

                {notice && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#052e16] border border-[#166534] text-[#86efac] rounded-lg text-xs">
                        {notice}
                        <button onClick={() => setNotice('')} className="hover:text-white">✕</button>
                    </div>
                )}
                {errMsg && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#450a0a] border border-[#7f1d1d] text-[#fca5a5] rounded-lg text-xs flex-wrap">
                        <span>❌ {errMsg}</span>
                        {me?.role === 'admin' && errMsg.includes('worker_enabled') && (
                            <button
                                onClick={() => { setErrMsg(''); navigate('/users') }}
                                className="px-2 py-0.5 rounded bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5] border border-[#991b1b] transition-colors whitespace-nowrap"
                            >
                                → 前往用户管理
                            </button>
                        )}
                        <button onClick={() => setErrMsg('')} className="hover:text-white ml-auto">✕</button>
                    </div>
                )}

                {stats && (
                    <div className="ml-auto flex items-center gap-3 text-xs text-[#64748b]">
                        <span>📧 {stats.email_records_count} records</span>
                        <span>📋 {stats.log_count} logs</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 min-w-0">

                <Card title={t('home.card.worker')}>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-[#64748b]">
                            {t('home.card.worker_desc')}
                        </p>

                        <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${workerRunning
                                ? 'bg-[#052e16] border-[#166534] text-[#86efac]'
                                : 'bg-[#0b0e14] border-[#2d3748] text-[#64748b]'
                                }`}
                        >
                            {workerRunning
                                ? t('home.worker.running')
                                : t('home.worker.stopped')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">


                        {!workerRunning
                            ? <Btn variant="green" onClick={() => startMut.mutate()} disabled={startMut.isPending}>{t('home.btn.start')}</Btn>
                            : <Btn variant="red" onClick={() => stopMut.mutate()} disabled={stopMut.isPending}>{t('home.btn.stop')}</Btn>
                        }
                        <Btn variant="blue" onClick={() => pollMut.mutate()} disabled={pollMut.isPending}>{t('home.btn.poll_now')}</Btn>
                        <Btn variant="tg" onClick={() => tgMut.mutate()} disabled={tgMut.isPending}>{t('home.btn.test_tg')}</Btn>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <StatItem label={t('home.stat.sent')} value={worker?.total_sent ?? '—'} />
                        <StatItem label={t('home.stat.fetched')} value={worker?.total_fetched ?? '—'} />
                        <StatItem label={t('home.stat.errors')} value={worker?.total_errors ?? '—'} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <StatItem label={t('home.stat.interval')} value={worker?.interval ? worker.interval + 's' : '—'} small />
                        <StatItem label={t('home.stat.last_poll')} value={fmt(worker?.last_poll)?.slice(5)} small />
                        <StatItem label={t('home.stat.started')} value={fmt(worker?.started_at)?.slice(5)} small />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <StatItem label={t('home.stat.tokens')} value={worker?.total_tokens != null ? worker.total_tokens.toLocaleString() : '—'} small />
                        <StatItem label={t('home.stat.runtime')} value={worker?.total_runtime_hours != null ? `${worker.total_runtime_hours}h` : '—'} small />
                    </div>

                    {worker?.last_error && (
                        <div className="text-xs text-[#fca5a5] bg-[#450a0a] border border-[#7f1d1d] rounded-lg px-3 py-2">
                            {t('home.worker.last_error')}{worker.last_error}
                        </div>
                    )}
                </Card>

                {/* Bot Chat moved to separate page; removed from Skill main view */}
            </div>

            <div className="bg-[#1e2330] border border-[#2d3748] rounded-xl p-5 flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#cbd5e1]">{t('home.worker.log_title')}</span>
                    <div className="ml-auto">
                        <Btn variant="ghost" onClick={() => clearMut.mutate()}>{t('home.worker.log_clear')}</Btn>
                    </div>
                </div>

                <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3 flex-1 overflow-y-auto min-h-45">
                    {displayLogs.length === 0
                        ? <div className="text-xs text-[#475569] text-center pt-8">—</div>
                        : displayLogs.map((e) => <LogRow key={e.id} entry={e} usersMap={usersMap} />)
                    }
                    <div ref={logEndRef} />
                </div>
            </div>
        </div>
    )
}
