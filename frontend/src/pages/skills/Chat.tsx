import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { formatLogMessage } from '../../utils/formatLog'
import { getLogs, getChatWorkStatus, startBot, stopBot, clearBotHistory, getMe, listUsers, type LogEntry } from '../../api'

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-[#1e2330] border border-[#2d3748] rounded-xl p-5 flex flex-col gap-3 ${className}`}>
            <h2 className="text-sm font-semibold text-[#cbd5e1]">{title}</h2>
            {children}
        </div>
    )
}

function Btn({ onClick, disabled, variant = 'default', children, }: { onClick?: () => void; disabled?: boolean; variant?: 'default' | 'green' | 'red' | 'blue' | 'tg' | 'ghost'; children: React.ReactNode }) {
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

const LEVEL_CLS: Record<string, string> = {
    warn: 'text-[#fbbf24]',
    error: 'text-[#fca5a5]',
}

const getTime = (ts: string) => ts.length <= 8 ? ts : ts.slice(11, 19)

function LogRow({ entry, usersMap }: { entry: LogEntry; usersMap: Map<number, string> }) {
    const { t } = useI18n()
    const stripped = entry.msg.replace(/\[user#\d+\]\s*/g, '')
    const display = formatLogMessage(stripped, t)
    const cls = LEVEL_CLS[entry.level] ?? (entry.msg.includes('\u2705') ? 'text-[#86efac]' : 'text-[#e2e8f0]')
    const userName = entry.user_id != null ? (usersMap.get(entry.user_id) ?? `#${entry.user_id}`) : null
    return (
        <div className={`flex gap-2 py-0.5 font-mono text-xs leading-5 ${cls}`}>
            <span className="text-[#475569] shrink-0">[{getTime(entry.ts)}]</span>
            {userName && (
                <span className="shrink-0 px-1 rounded text-[10px] self-center bg-[#2d1b69] text-[#c4b5fd]">{userName}</span>
            )}
            {entry.tokens > 0 && (
                <span className="shrink-0 px-1 rounded text-[10px] self-center bg-[#1c2a1c] text-[#86efac]">{entry.tokens}t</span>
            )}
            <span className="flex-1 break-all">{display}</span>
        </div>
    )
}

export default function Chat() {
    const { t } = useI18n()
    const qc = useQueryClient()
    const endRef = useRef<HTMLDivElement>(null)

    // Avoid continuous polling; fetch bot status on demand before user-triggered actions.
    const botQuery = useQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus, enabled: false })
    const { data: chatLogs = [] } = useQuery({ queryKey: ['logs', 'chat'], queryFn: () => getLogs(200, 'chat'), refetchInterval: 8000 })
    const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: Infinity })
    const { data: allUsers = [] } = useQuery({
        queryKey: ['users'],
        queryFn: async () => { try { return await listUsers() } catch { return [] } },
        staleTime: 60_000,
        enabled: me?.role === 'admin',
    })
    const usersMap = new Map<number, string>(allUsers.map((u: { id: number; email: string }) => [u.id, u.email.split('@')[0]]))

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatLogs.length])
    type BotStatus = {
        running?: boolean
    }
    const botStartMut = useMutation({
        mutationFn: async () => {
            try {
                await qc.fetchQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus })
            } catch {
                /* ignore */
            }
            return startBot()
        },
        onSuccess: (data: BotStatus | undefined) => {
            try {
                qc.setQueryData<BotStatus>(['chatworkstatus'], (old) => ({
                    ...(old ?? {}),
                    running: data?.running ?? true,
                }))
            } catch {
                /* ignore */
            }
        },
    })

    const botStopMut = useMutation({
        mutationFn: async () => {
            try {
                await qc.fetchQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus })
            } catch {
                /* ignore */
            }
            return stopBot()
        },
        onSuccess: (data: BotStatus | undefined) => {
            try {
                qc.setQueryData<BotStatus>(['chatworkstatus'], (old) => ({
                    ...(old ?? {}),
                    running: data?.running ?? false,
                }))
            } catch {
                /* ignore */
            }
        },
    })
    const botClearMut = useMutation({
        mutationFn: clearBotHistory,
        onSuccess: () => {
            qc.setQueryData(['logs', 'chat'], [])
            qc.invalidateQueries({ queryKey: ['logs', 'chat'] })
        },
    })

    const botRunning = botQuery.data?.running ?? false

    

    return (
        <div className="flex flex-col h-full p-5 gap-4 min-w-0">
            <div className="grid grid-cols-1 xl:grid-cols-1 gap-4 min-w-0">
                <Card title={t('home.card.bot_worker')}>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-[#64748b]">
                            {t('home.card.bot_worker_desc')}
                        </p>

                        <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${botRunning
                                ? 'bg-[#052e16] border-[#166534] text-[#86efac]'
                                : 'bg-[#0b0e14] border-[#2d3748] text-[#64748b]'
                                }`}
                        >
                            {botRunning
                                ? t('home.worker.running')
                                : t('home.worker.stopped')}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">

                        {!botRunning
                            ? <Btn variant="green" onClick={() => botStartMut.mutate()} disabled={botStartMut.isPending}>{t('home.btn.bot_start')}</Btn>
                            : <Btn variant="red" onClick={() => botStopMut.mutate()} disabled={botStopMut.isPending}>{t('home.btn.bot_stop')}</Btn>
                        }
                        <Btn onClick={() => botClearMut.mutate()} disabled={botClearMut.isPending}>{t('home.btn.bot_clear')}</Btn>
                    </div>

                    <div className="text-xs text-[#64748b] font-semibold">{t('home.bot.log_title')}</div>
                    <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3 h-[60vh] overflow-y-auto flex flex-col gap-0.5">
                        {chatLogs.length === 0
                            ? <div className="text-xs text-[#475569] text-center pt-8">—</div>
                            : chatLogs.map((e) => <LogRow key={e.id} entry={e} usersMap={usersMap} />)
                        }
                        <div ref={endRef} />
                    </div>
                </Card>
            </div>
        </div>
    )
}
