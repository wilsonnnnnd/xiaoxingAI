import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
    getWorkerStatus, getDbStats, getLogs, clearLogs,
    startWorker, stopWorker, pollNow, testTelegram,
    getBotStatus, startBot, stopBot, clearBotHistory,
    getGmailAuthUrl, getHealth, type LogEntry,
} from '../api'

// ── helpers ──────────────────────────────────────────────────────

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
        green:   'bg-[#15803d] hover:bg-[#166534] text-white',
        red:     'bg-[#7f1d1d] hover:bg-[#991b1b] text-white',
        blue:    'bg-[#1d4ed8] hover:bg-[#1e40af] text-white',
        tg:      'bg-[#0088cc] hover:bg-[#006fa8] text-white',
        ghost:   'text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#334155]',
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
    warn:  'text-[#fbbf24]',
    error: 'text-[#fca5a5]',
}

// ts is either "HH:MM:SS" (legacy 8-char rows) or "YYYY-MM-DDTHH:MM:SS"
const getTime = (ts: string) => ts.length <= 8 ? ts : ts.slice(11, 19)

function LogRow({ entry }: { entry: LogEntry }) {
    const cls = LEVEL_CLS[entry.level] ?? (entry.msg.includes('✅') ? 'text-[#86efac]' : 'text-[#e2e8f0]')
    const typeCls = entry.log_type === 'chat'
        ? 'bg-[#2d1b69] text-[#c4b5fd]'
        : 'bg-[#1e3a5f] text-[#7dd3fc]'
    return (
        <div className={`flex gap-2 py-0.5 font-mono text-xs leading-5 ${cls}`}>
            <span className="text-[#475569] shrink-0">[{getTime(entry.ts)}]</span>
            <span className={`shrink-0 px-1 rounded text-[10px] self-center ${typeCls}`}>{entry.log_type ?? 'email'}</span>
            {entry.tokens > 0 && (
                <span className="shrink-0 px-1 rounded text-[10px] self-center bg-[#1c2a1c] text-[#86efac]">{entry.tokens}t</span>
            )}
            <span className="flex-1 break-all">{entry.msg}</span>
        </div>
    )
}

// ── Main page ────────────────────────────────────────────────────

export default function Home() {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [logFilter, setLogFilter] = useState<'all' | 'email' | 'chat'>('all')
    const [notice, setNotice] = useState(() => {
        if (new URLSearchParams(window.location.search).get('auth') === 'success') {
            window.history.replaceState({}, '', window.location.pathname)
            return t('home.oauth_success')
        }
        return ''
    })
    const [apiOk, setApiOk] = useState<boolean | null>(null)
    const logEndRef  = useRef<HTMLDivElement>(null)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // health check
    useEffect(() => {
        const check = () => getHealth().then(() => setApiOk(true)).catch(() => setApiOk(false))
        check()
        const id = setInterval(check, 15_000)
        return () => clearInterval(id)
    }, [])

    // Queries
    const { data: worker } = useQuery({ queryKey: ['workerStatus'], queryFn: getWorkerStatus, refetchInterval: 2000 })
    const { data: stats }  = useQuery({ queryKey: ['dbStats'],      queryFn: getDbStats,      refetchInterval: 10_000 })
    const { data: botStatus } = useQuery({ queryKey: ['botStatus'], queryFn: getBotStatus,    refetchInterval: 2000 })

    const { data: emailLogs = [] } = useQuery({
        queryKey: ['logs', 'email'],
        queryFn: () => getLogs(200, 'email'),
        refetchInterval: 2000,
    })
    const { data: chatLogs = [] } = useQuery({
        queryKey: ['logs', 'chat'],
        queryFn: () => getLogs(100, 'chat'),
        refetchInterval: 2000,
    })

    const allLogs = [...emailLogs, ...chatLogs].sort((a, b) => a.ts.localeCompare(b.ts))
    const displayLogs = logFilter === 'email' ? emailLogs : logFilter === 'chat' ? chatLogs : allLogs

    useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) },  [displayLogs.length])
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatLogs.length])

    // Mutations
    const startMut    = useMutation({ mutationFn: startWorker,    onSuccess: () => qc.invalidateQueries({ queryKey: ['workerStatus'] }) })
    const stopMut     = useMutation({ mutationFn: stopWorker,     onSuccess: () => qc.invalidateQueries({ queryKey: ['workerStatus'] }) })
    const pollMut     = useMutation({ mutationFn: pollNow,        onSuccess: () => qc.invalidateQueries({ queryKey: ['workerStatus'] }) })
    const clearMut    = useMutation({ mutationFn: clearLogs,      onSuccess: () => qc.invalidateQueries({ queryKey: ['logs'] }) })
    const tgMut       = useMutation({ mutationFn: testTelegram,   onSuccess: () => setNotice(t('home.tg.test_ok')) })
    const botStartMut = useMutation({ mutationFn: startBot,       onSuccess: () => qc.invalidateQueries({ queryKey: ['botStatus'] }) })
    const botStopMut  = useMutation({ mutationFn: stopBot,        onSuccess: () => qc.invalidateQueries({ queryKey: ['botStatus'] }) })
    const botClearMut = useMutation({ mutationFn: clearBotHistory, onSuccess: () => { qc.invalidateQueries({ queryKey: ['logs'] }); setNotice(t('home.bot.history_cleared')) } })

    const workerRunning = worker?.running ?? false
    const botRunning    = botStatus?.running ?? false
    const authorized    = stats?.has_token ?? false

    const fmt = (s?: string | null) => s ? s.replace('T', ' ').slice(0, 19) : '—'

    return (
        <div className="flex flex-col h-full p-5 gap-4 min-w-0">

            {/* ── Top status bar ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2330] border border-[#2d3748] rounded-lg text-xs text-[#94a3b8]">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${apiOk === true ? 'bg-[#22c55e]' : apiOk === false ? 'bg-[#ef4444]' : 'bg-[#64748b]'}`} />
                    {apiOk === true ? t('home.status.ok') : apiOk === false ? t('home.status.err') : t('home.status.checking')}
                </div>

                {/* Auth status */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${
                    authorized
                        ? 'bg-[#052e16] border-[#166534] text-[#86efac]'
                        : 'bg-[#431407] border-[#7c2d12] text-[#fbbf24]'
                }`}>
                    {authorized ? '🔑 ' + t('home.auth.ok') : '⚠️ ' + t('home.auth.unauthorized')}
                    <a href={getGmailAuthUrl()} target="_blank" rel="noopener noreferrer"
                        className="ml-2 px-2 py-0.5 rounded bg-[#334155] hover:bg-[#475569] text-[#e2e8f0] transition-colors">
                        {t('home.btn.google_auth')}
                    </a>
                </div>

                {notice && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#052e16] border border-[#166534] text-[#86efac] rounded-lg text-xs">
                        {notice}
                        <button onClick={() => setNotice('')} className="hover:text-white">✕</button>
                    </div>
                )}

                {/* DB mini-stats */}
                {stats && (
                    <div className="ml-auto flex items-center gap-3 text-xs text-[#64748b]">
                        <span>📧 {stats.email_records_count} records</span>
                        <span>📋 {stats.log_count} logs</span>
                    </div>
                )}
            </div>

            {/* ── Middle row: Worker | Bot ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">

                {/* Email Worker */}
                <Card title={t('home.card.worker')}>
                    <p className="text-xs text-[#64748b] -mt-1">{t('home.card.worker_desc')}</p>

                    {/* Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            workerRunning
                                ? 'bg-[#052e16] border-[#166534] text-[#86efac]'
                                : 'bg-[#0b0e14] border-[#2d3748] text-[#64748b]'
                        }`}>
                            {workerRunning ? '' + t('home.worker.running') : '' + t('home.worker.stopped')}
                        </span>
                        {!workerRunning
                            ? <Btn variant="green" onClick={() => startMut.mutate()} disabled={startMut.isPending}>{t('home.btn.start')}</Btn>
                            : <Btn variant="red"   onClick={() => stopMut.mutate()}  disabled={stopMut.isPending}>{t('home.btn.stop')}</Btn>
                        }
                        <Btn variant="blue" onClick={() => pollMut.mutate()} disabled={pollMut.isPending}>{t('home.btn.poll_now')}</Btn>
                        <Btn variant="tg"   onClick={() => tgMut.mutate()}   disabled={tgMut.isPending}>{t('home.btn.test_tg')}</Btn>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2">
                        <StatItem label={t('home.stat.sent')}    value={worker?.total_sent    ?? '—'} />
                        <StatItem label={t('home.stat.fetched')} value={worker?.total_fetched ?? '—'} />
                        <StatItem label={t('home.stat.errors')}  value={worker?.total_errors  ?? '—'} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <StatItem label={t('home.stat.interval')}  value={worker?.interval  ? worker.interval + 's' : '—'} small />
                        <StatItem label={t('home.stat.last_poll')} value={fmt(worker?.last_poll)?.slice(5)} small />
                        <StatItem label={t('home.stat.started')}   value={fmt(worker?.started_at)?.slice(5)} small />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <StatItem label={t('home.stat.tokens')}  value={worker?.total_tokens != null ? worker.total_tokens.toLocaleString() : '—'} small />
                        <StatItem label={t('home.stat.runtime')} value={worker?.total_runtime_hours != null ? `${worker.total_runtime_hours}h` : '—'} small />
                    </div>

                    {worker?.last_error && (
                        <div className="text-xs text-[#fca5a5] bg-[#450a0a] border border-[#7f1d1d] rounded-lg px-3 py-2">
                            {t('home.worker.last_error')}{worker.last_error}
                        </div>
                    )}
                </Card>

                {/* Telegram Bot */}
                <Card title={t('home.card.bot_worker')}>
                    <p className="text-xs text-[#64748b] -mt-1">{t('home.card.bot_worker_desc')}</p>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            botRunning
                                ? 'bg-[#052e16] border-[#166534] text-[#86efac]'
                                : 'bg-[#0b0e14] border-[#2d3748] text-[#64748b]'
                        }`}>
                            {botRunning ? '' + t('home.worker.running') : '' + t('home.worker.stopped')}
                        </span>
                        {!botRunning
                            ? <Btn variant="green" onClick={() => botStartMut.mutate()} disabled={botStartMut.isPending}>{t('home.btn.bot_start')}</Btn>
                            : <Btn variant="red"   onClick={() => botStopMut.mutate()}  disabled={botStopMut.isPending}>{t('home.btn.bot_stop')}</Btn>
                        }
                        <Btn onClick={() => botClearMut.mutate()} disabled={botClearMut.isPending}>{t('home.btn.bot_clear')}</Btn>
                    </div>

                    {/* Chat log */}
                    <div className="text-xs text-[#64748b] font-semibold">{t('home.bot.log_title')}</div>
                    <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3 h-52 overflow-y-auto flex flex-col gap-0.5">
                        {chatLogs.length === 0
                            ? <div className="text-xs text-[#475569] text-center pt-8">—</div>
                            : chatLogs.map((e) => {
                                const isUser = e.msg.startsWith('💬')
                                const isBot  = e.msg.startsWith('🤖')
                                return (
                                    <div key={e.id} className={`font-mono text-xs py-0.5 flex gap-2 ${isUser ? 'text-[#7dd3fc]' : isBot ? 'text-[#c4b5fd]' : 'text-[#94a3b8]'}`}>
                                        <span className="text-[#475569] shrink-0">[{getTime(e.ts)}]</span>
                                        {e.tokens > 0 && <span className="shrink-0 px-1 rounded text-[10px] self-center bg-[#1c2a1c] text-[#86efac]">{e.tokens}t</span>}
                                        <span className="flex-1 break-all">{e.msg}</span>
                                    </div>
                                )
                            })
                        }
                        <div ref={chatEndRef} />
                    </div>
                </Card>
            </div>

            {/* ── Bottom: Step Log (full width, grows) ── */}
            <div className="bg-[#1e2330] border border-[#2d3748] rounded-xl p-5 flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#cbd5e1]">{t('home.worker.log_title')}</span>
                    <div className="flex gap-1 ml-2">
                        {(['all', 'email', 'chat'] as const).map(f => (
                            <button key={f} onClick={() => setLogFilter(f)}
                                className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                                    logFilter === f ? 'bg-[#6366f1] text-white' : 'bg-[#0b0e14] border border-[#2d3748] text-[#64748b] hover:text-[#e2e8f0]'
                                }`}>
                                {t(`home.worker.log_filter.${f}`)}
                            </button>
                        ))}
                    </div>
                    <div className="ml-auto">
                        <Btn variant="ghost" onClick={() => clearMut.mutate()}>{t('home.worker.log_clear')}</Btn>
                    </div>
                </div>

                <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3 flex-1 overflow-y-auto min-h-45">
                    {displayLogs.length === 0
                        ? <div className="text-xs text-[#475569] text-center pt-8">—</div>
                        : displayLogs.map((e) => <LogRow key={e.id} entry={e} />)
                    }
                    <div ref={logEndRef} />
                </div>
            </div>
        </div>
    )
}
