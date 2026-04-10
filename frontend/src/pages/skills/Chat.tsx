import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { formatLogMessage } from '../../utils/formatLog'
import {
    getLogs, getChatWorkStatus, startBot, stopBot, clearBotHistory,
    getMe, listUsers, listBots, updateBot,
    generateChatPersona, getPersonaConfig, getDbPrompts, createDbPrompt, deleteDbPrompt,
    type LogEntry, type DbPrompt, type Bot,
} from '../../api'

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

// 显示元数据（emoji + 中文名），下拉选项内容从数据库动态获取
const PERSONA_ITEM_META: Record<string, { emoji: string; zh: string }> = {
    aries: { emoji: '♈', zh: '白羊座' }, taurus: { emoji: '♉', zh: '金牛座' },
    gemini: { emoji: '♊', zh: '双子座' }, cancer: { emoji: '♋', zh: '巨蟹座' },
    leo: { emoji: '♌', zh: '狮子座' }, virgo: { emoji: '♍', zh: '处女座' },
    libra: { emoji: '♎', zh: '天秤座' }, scorpio: { emoji: '♏', zh: '天蝎座' },
    sagittarius: { emoji: '♐', zh: '射手座' }, capricorn: { emoji: '♑', zh: '摩羯座' },
    aquarius: { emoji: '♒', zh: '水瓶座' }, pisces: { emoji: '♓', zh: '双鱼座' },
    rat: { emoji: '🐭', zh: '鼠' }, ox: { emoji: '🐮', zh: '牛' },
    tiger: { emoji: '🐯', zh: '虎' }, rabbit: { emoji: '🐰', zh: '兔' },
    dragon: { emoji: '🐲', zh: '龙' }, snake: { emoji: '🐍', zh: '蛇' },
    horse: { emoji: '🐴', zh: '马' }, goat: { emoji: '🐑', zh: '羊' },
    monkey: { emoji: '🐵', zh: '猴' }, rooster: { emoji: '🐔', zh: '鸡' },
    dog: { emoji: '🐶', zh: '狗' }, pig: { emoji: '🐷', zh: '猪' },
    male: { emoji: '♂️', zh: '男性' }, female: { emoji: '♀️', zh: '女性' },
    other: { emoji: '⚧', zh: '其他' },
}

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

// ── Persona display (structured card view) ──────────────────────
type _PField = { label: string; value: string }
type _PSection =
    | { kind: 'intro'; text: string }
    | { kind: 'numbered'; num: number; title: string; fields: _PField[] }
    | { kind: 'notes'; items: string[] }

function _parsePersona(raw: string): _PSection[] {
    const out: _PSection[] = []
    let introBuf: string[] = []
    let cur: Extract<_PSection, { kind: 'numbered' }> | Extract<_PSection, { kind: 'notes' }> | null = null

    const flush = () => {
        if (cur) { out.push(cur); cur = null }
        const t = introBuf.join('\n').trim()
        if (t) out.push({ kind: 'intro', text: t })
        introBuf = []
    }

    for (const ln of raw.split('\n')) {
        const numM   = ln.match(/^(\d+)\.\s+(.+)/)
        const noteM  = ln.match(/^请注意[：:]?/)
        const fieldM = ln.match(/^[-•]\s+([^：:]+)[：:](.+)/)
        const bulletM = ln.match(/^[-•]\s+(.+)/)

        if (noteM) {
            flush(); cur = { kind: 'notes', items: [] }
        } else if (numM) {
            flush(); cur = { kind: 'numbered', num: parseInt(numM[1]), title: numM[2].trim(), fields: [] }
        } else if (fieldM && cur?.kind === 'numbered') {
            cur.fields.push({ label: fieldM[1].trim(), value: fieldM[2].trim() })
        } else if (bulletM && cur?.kind === 'notes') {
            cur.items.push(bulletM[1].trim())
        } else if (!cur && ln.trim()) {
            introBuf.push(ln)
        }
    }
    flush()
    return out
}

const _SEC_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fb923c']

function PersonaDisplay({ text, onEdit }: { text: string; onEdit: () => void }) {
    const { t } = useI18n()
    const [copied, setCopied] = useState(false)
    const sections = _parsePersona(text)

    const handleCopy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748b]">{t('chat.persona.display_title')}</span>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleCopy}
                        className="text-xs px-2.5 py-1 rounded-lg bg-[#1e2a3d] hover:bg-[#273347] text-[#93c5fd] transition-colors"
                    >
                        {copied ? t('chat.persona.copied') : t('chat.persona.btn_copy')}
                    </button>
                    <button
                        onClick={onEdit}
                        className="text-xs px-2.5 py-1 rounded-lg bg-[#2d3748] hover:bg-[#334155] text-[#94a3b8] transition-colors"
                    >
                        {t('chat.persona.btn_edit')}
                    </button>
                </div>
            </div>

            {sections.map((s, i) => {
                if (s.kind === 'intro') {
                    return (
                        <p key={i} className="text-sm text-[#94a3b8] leading-relaxed">{s.text}</p>
                    )
                }
                if (s.kind === 'numbered') {
                    const color = _SEC_COLORS[(s.num - 1) % _SEC_COLORS.length]
                    return (
                        <div key={i} className="rounded-xl overflow-hidden border border-[#1e2a3a]">
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#111827]">
                                <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-xs font-semibold" style={{ color }}>{s.num}. {s.title}</span>
                            </div>
                            <div className="bg-[#0b0e14] px-4 py-2.5 flex flex-col gap-1.5">
                                {s.fields.map((f, fi) => (
                                    <div key={fi} className="grid gap-2 items-baseline" style={{ gridTemplateColumns: '90px 1fr' }}>
                                        <span className="text-[11px] text-[#475569]">{f.label}</span>
                                        <span className="text-[12px] text-[#cbd5e1] leading-snug">{f.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }
                if (s.kind === 'notes') {
                    return (
                        <div key={i} className="rounded-xl bg-[#12100a] border border-[#2d2a1a] px-3 py-2.5">
                            <p className="text-[11px] text-[#92704a] font-medium mb-1.5">{t('chat.persona.notes_title')}</p>
                            <ul className="flex flex-col gap-1">
                                {s.items.map((item, ii) => (
                                    <li key={ii} className="flex gap-1.5 text-[11px] text-[#6b5a3e] leading-snug">
                                        <span className="text-[#7d6040] shrink-0 mt-0.5">·</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )
                }
                return null
            })}
        </div>
    )
}

export default function Chat() {
    const { t } = useI18n()
    const qc = useQueryClient()
    const endRef = useRef<HTMLDivElement>(null)

    // ── Persona generator state ───────────────────────────────────
    const [keywords, setKeywords] = useState('')
    const [zodiac, setZodiac] = useState('')
    const [chineseZodiac, setChineseZodiac] = useState('')
    const [gender, setGender] = useState('')
    const [age, setAge] = useState('')
    const [generatedPrompt, setGeneratedPrompt] = useState('')
    const [genTokens, setGenTokens] = useState(0)
    const [promptName, setPromptName] = useState('')
    const [savedMsg, setSavedMsg] = useState('')
    const [assignStatus, setAssignStatus] = useState<Record<number, string>>({})  // promptId → msg
    const [selectedBot, setSelectedBot] = useState<Record<number, number | ''>>({})  // promptId → botId
    const [editMode, setEditMode] = useState(false)

    // Avoid continuous polling; fetch bot status on demand before user-triggered actions.
    const botQuery = useQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus, enabled: false })
    const { data: chatLogs = [] } = useQuery({ queryKey: ['logs', 'chat'], queryFn: () => getLogs(200, 'chat'), refetchInterval: 8000 })
    const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: Infinity })

    const { data: personaConfig = {} as Record<string, Record<string, string>> } = useQuery({
        queryKey: ['personaConfig'],
        queryFn: getPersonaConfig,
        staleTime: 60_000,
        enabled: me?.role === 'admin',
    })

    const { data: allUsers = [] } = useQuery({
        queryKey: ['users'],
        queryFn: async () => { try { return await listUsers() } catch { return [] } },
        staleTime: 60_000,
        enabled: me?.role === 'admin',
    })
    const usersMap = new Map<number, string>(allUsers.map((u: { id: number; email: string }) => [u.id, u.email.split('@')[0]]))

    const { data: myBots = [] } = useQuery({
        queryKey: ['bots', me?.id],
        queryFn: () => listBots(me!.id),
        enabled: me != null,
        staleTime: 30_000,
    })

    // ── Chat prompts list (user-owned, type=chat) ─────────────────
    const { data: chatPrompts = [] } = useQuery({
        queryKey: ['dbPrompts', 'chat', me?.id],
        queryFn: async () => {
            const all = await getDbPrompts()
            return all.filter((p: DbPrompt) => p.user_id === me?.id && p.type === 'chat')
        },
        enabled: me != null,
        staleTime: 15_000,
    })

    // ── Mutations ─────────────────────────────────────────────────
    const generateMut = useMutation({
        mutationFn: () => generateChatPersona(
            keywords.trim(),
            zodiac || undefined,
            chineseZodiac || undefined,
            gender || undefined,
            age || undefined,
        ),
        onSuccess: (data) => {
            setGeneratedPrompt(data.prompt)
            setGenTokens(data.tokens)
            setSavedMsg('')
            setEditMode(false)
        },
    })

    const saveMut = useMutation({
        mutationFn: () => {
            // 将选择的身份信息直接内嵌到内容最前面
            const _LABEL: Record<string, string> = {
                aries: '白羊座', taurus: '金牛座', gemini: '双子座', cancer: '巨蟹座',
                leo: '狮子座', virgo: '处女座', libra: '天秤座', scorpio: '天蝎座',
                sagittarius: '射手座', capricorn: '摩羯座', aquarius: '水瓶座', pisces: '双鱼座',
                rat: '鼠', ox: '牛', tiger: '虎', rabbit: '兔', dragon: '龙', snake: '蛇',
                horse: '马', goat: '羊', monkey: '猴', rooster: '鸡', dog: '狗', pig: '猪',
                male: '男性', female: '女性', other: '其他',
            }
            const parts: string[] = []
            if (zodiac) parts.push(`星座：${_LABEL[zodiac] ?? zodiac}`)
            if (chineseZodiac) parts.push(`属相：${_LABEL[chineseZodiac] ?? chineseZodiac}`)
            if (gender) parts.push(`性别：${_LABEL[gender] ?? gender}`)
            if (age) parts.push(`年龄感：${age}`)
            const header = parts.length > 0
                ? `[身份设定] ${parts.join('、')}。如果用户问你的星座、属相、性别、年龄等个人特征，直接如实回答。\n\n`
                : ''
            return createDbPrompt({ name: promptName.trim(), type: 'chat', content: header + generatedPrompt })
        },
        onSuccess: () => {
            setSavedMsg(t('chat.persona.saved'))
            setPromptName('')
            setGeneratedPrompt('')
            setGenTokens(0)
            qc.invalidateQueries({ queryKey: ['dbPrompts', 'chat', me?.id] })
        },
    })

    const assignMut = useMutation({
        mutationFn: ({ botId, promptId }: { botId: number; promptId: number }) =>
            updateBot(me!.id, botId, { chat_prompt_id: promptId }),
        onSuccess: (_, vars) => {
            setAssignStatus(s => ({ ...s, [vars.promptId]: t('chat.prompts.assigned') }))
            qc.invalidateQueries({ queryKey: ['bots', me?.id] })
            setTimeout(() => setAssignStatus(s => { const n = { ...s }; delete n[vars.promptId]; return n }), 2500)
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => deleteDbPrompt(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dbPrompts', 'chat', me?.id] })
            // ON DELETE SET NULL clears bot.chat_prompt_id in DB; sync frontend cache
            qc.invalidateQueries({ queryKey: ['bots', me?.id] })
        },
    })

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
    const chatBots = (myBots as { bot_mode: string }[]).filter(b => b.bot_mode === 'all' || b.bot_mode === 'chat')
    const hasChatBot = chatBots.length > 0
    const canStart = hasChatBot
    

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

                    {/* Prerequisite checklist */}
                    {!botRunning && (
                        <div className="flex flex-col gap-1.5 bg-[#0b0e14] border border-[#273347] rounded-lg px-3 py-2.5">
                            <p className="text-[10px] text-[#64748b] mb-0.5">{t('worker.prereq.title')}</p>
                            <div className={`flex items-center gap-2 text-xs ${hasChatBot ? 'text-[#86efac]' : 'text-[#fbbf24]'}`}>
                                <span>{hasChatBot ? '✅' : '⚠️'}</span>
                                <span>{t('worker.prereq.chat_bot')}</span>
                                {!hasChatBot && (
                                    <a href="/settings" className="ml-1 px-2 py-0.5 rounded bg-[#334155] hover:bg-[#475569] text-[#e2e8f0] transition-colors">
                                        {t('worker.prereq.bot_goto')}
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                        {!botRunning
                            ? <Btn variant="green" onClick={() => botStartMut.mutate()} disabled={botStartMut.isPending || !canStart}>{t('home.btn.bot_start')}</Btn>
                            : <Btn variant="red" onClick={() => botStopMut.mutate()} disabled={botStopMut.isPending}>{t('home.btn.bot_stop')}</Btn>
                        }
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#cbd5e1]">{t('home.bot.log_title')}</span>
                        <div className="ml-auto">
                            <Btn variant="ghost" onClick={() => botClearMut.mutate()} disabled={botClearMut.isPending || chatLogs.length === 0}>{t('home.worker.log_clear')}</Btn>
                        </div>
                    </div>
                    <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3 h-[60vh] overflow-y-auto flex flex-col gap-0.5">
                        {chatLogs.length === 0
                            ? <div className="text-xs text-[#475569] text-center pt-8">—</div>
                            : chatLogs.map((e) => <LogRow key={e.id} entry={e} usersMap={usersMap} />)
                        }
                        <div ref={endRef} />
                    </div>
                </Card>

                {/* ── 聊天提示词生成器 ───────────────────────── */}
                <Card title={t('chat.persona.card_title')}>
                    <p className="text-xs text-[#64748b]">{t('chat.persona.desc')}</p>

                    {/* 星座 / 属相 / 性别 选择器 */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-[#94a3b8]">{t('chat.persona.zodiac_label')}</label>
                            <select
                                value={zodiac}
                                onChange={e => setZodiac(e.target.value)}
                                className="bg-[#0b0e14] border border-[#2d3748] rounded-lg px-2 py-1.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#475569]"
                            >
                                <option value="">{t('chat.persona.select_none')}</option>
                                {Object.keys(personaConfig.zodiac ?? {}).map(key => {
                                    const m = PERSONA_ITEM_META[key] ?? { emoji: '', zh: key }
                                    return <option key={key} value={key}>{m.emoji} {m.zh}</option>
                                })}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-[#94a3b8]">{t('chat.persona.chinese_zodiac_label')}</label>
                            <select
                                value={chineseZodiac}
                                onChange={e => setChineseZodiac(e.target.value)}
                                className="bg-[#0b0e14] border border-[#2d3748] rounded-lg px-2 py-1.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#475569]"
                            >
                                <option value="">{t('chat.persona.select_none')}</option>
                                {Object.keys(personaConfig.chinese_zodiac ?? {}).map(key => {
                                    const m = PERSONA_ITEM_META[key] ?? { emoji: '', zh: key }
                                    return <option key={key} value={key}>{m.emoji} {m.zh}</option>
                                })}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-[#94a3b8]">{t('chat.persona.gender_label')}</label>
                            <select
                                value={gender}
                                onChange={e => setGender(e.target.value)}
                                className="bg-[#0b0e14] border border-[#2d3748] rounded-lg px-2 py-1.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#475569]"
                            >
                                <option value="">{t('chat.persona.select_none')}</option>
                                {Object.keys(personaConfig.gender ?? {}).map(key => {
                                    const m = PERSONA_ITEM_META[key] ?? { emoji: '', zh: key }
                                    return <option key={key} value={key}>{m.emoji} {m.zh}</option>
                                })}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-[#94a3b8]">{t('chat.persona.age_label')}</label>
                            <select
                                value={age}
                                onChange={e => setAge(e.target.value)}
                                className="bg-[#0b0e14] border border-[#2d3748] rounded-lg px-2 py-1.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#475569]"
                            >
                                <option value="">{t('chat.persona.select_none')}</option>
                                <option value="少年感">{t('chat.persona.age_opt.youthful')}</option>
                                <option value="年轻成年人">{t('chat.persona.age_opt.young_adult')}</option>
                                <option value="成熟">{t('chat.persona.age_opt.mature')}</option>
                                <option value="中年感">{t('chat.persona.age_opt.middle_aged')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-[#94a3b8]">{t('chat.persona.keywords_label')}</label>
                        <textarea
                            rows={3}
                            value={keywords}
                            onChange={e => setKeywords(e.target.value)}
                            placeholder={t('chat.persona.keywords_placeholder')}
                            className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-2.5 text-sm text-[#e2e8f0] placeholder-[#475569] resize-none focus:outline-none focus:border-[#475569]"
                        />
                        <div className="flex items-center gap-3">
                            <Btn
                                variant="blue"
                                onClick={() => {
                                    if (!keywords.trim()) return
                                    setSavedMsg('')
                                    generateMut.mutate()
                                }}
                                disabled={generateMut.isPending || !keywords.trim()}
                            >
                                {generateMut.isPending ? t('chat.persona.generating') : t('chat.persona.btn_generate')}
                            </Btn>
                            {generateMut.isError && (
                                <span className="text-xs text-[#fca5a5]">
                                    {(generateMut.error as Error)?.message ?? '生成失败'}
                                </span>
                            )}
                        </div>
                    </div>

                    {generatedPrompt && (
                        <div className="flex flex-col gap-3 mt-1">
                            {/* Token count */}
                            {genTokens > 0 && (
                                <div className="flex justify-end">
                                    <span className="text-[10px] bg-[#1c2a1c] text-[#86efac] px-2 py-0.5 rounded-full">
                                        {t('chat.persona.tokens')}: {genTokens}
                                    </span>
                                </div>
                            )}

                            {/* Display mode / Edit mode */}
                            {editMode ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-[#94a3b8]">{t('chat.persona.edit_label')}</span>
                                        <button
                                            onClick={() => setEditMode(false)}
                                            className="text-xs px-2.5 py-1 rounded-lg bg-[#1e2a3d] hover:bg-[#273347] text-[#93c5fd] transition-colors"
                                        >
                                            {t('chat.persona.btn_back_preview')}
                                        </button>
                                    </div>
                                    <textarea
                                        rows={12}
                                        value={generatedPrompt}
                                        onChange={e => setGeneratedPrompt(e.target.value)}
                                        className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3 text-xs text-[#e2e8f0] font-mono resize-y focus:outline-none focus:border-[#475569]"
                                    />
                                </div>
                            ) : (
                                <PersonaDisplay text={generatedPrompt} onEdit={() => setEditMode(true)} />
                            )}

                            {/* Save row */}
                            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#1e2a3a]">
                                <input
                                    type="text"
                                    value={promptName}
                                    onChange={e => setPromptName(e.target.value)}
                                    placeholder={t('chat.persona.name_placeholder')}
                                    className="flex-1 min-w-[140px] bg-[#0b0e14] border border-[#2d3748] rounded-lg px-2.5 py-1.5 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#475569]"
                                />
                                <Btn
                                    variant="green"
                                    onClick={() => {
                                        if (!promptName.trim()) return
                                        saveMut.mutate()
                                    }}
                                    disabled={saveMut.isPending || !promptName.trim()}
                                >
                                    {saveMut.isPending ? t('chat.persona.saving') : t('chat.persona.btn_save')}
                                </Btn>
                            </div>
                            {savedMsg && <p className="text-xs text-[#86efac]">{savedMsg}</p>}
                            {saveMut.isError && (
                                <p className="text-xs text-[#fca5a5]">{(saveMut.error as Error)?.message ?? '保存失败'}</p>
                            )}
                        </div>
                    )}
                </Card>

                {/* ── 聊天提示词管理 & Bot 分配 ─────────────── */}
                <Card title={t('chat.prompts.card_title')}>
                    {chatPrompts.length === 0 ? (
                        <p className="text-xs text-[#475569]">{t('chat.prompts.empty')}</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {chatPrompts.map((p: DbPrompt) => {
                                const assignedBots = (myBots as Bot[]).filter(b => b.chat_prompt_id === p.id)
                                const selBot = selectedBot[p.id] ?? ''
                                return (
                                    <div key={p.id} className="bg-[#0b0e14] border border-[#2d3748] rounded-lg px-3 py-3 flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-semibold text-[#e2e8f0]">{p.name}</span>
                                                {assignedBots.map(b => (
                                                    <span key={b.id} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1d3461] text-[#93c5fd]">
                                                        {b.name} · {t('chat.prompts.current')}
                                                    </span>
                                                ))}
                                            </div>
                                            <Btn
                                                variant="ghost"
                                                onClick={() => {
                                                    if (!confirm(t('chat.prompts.confirm_delete').replace('{name}', p.name))) return
                                                    deleteMut.mutate(p.id)
                                                }}
                                                disabled={deleteMut.isPending}
                                            >
                                                {t('chat.prompts.btn_delete')}
                                            </Btn>
                                        </div>
                                        <details className="group">
                                            <summary className="text-[11px] text-[#64748b] cursor-pointer select-none hover:text-[#94a3b8]">
                                                预览提示词 ▾
                                            </summary>
                                            <pre className="mt-1.5 text-[10px] text-[#94a3b8] whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">
                                                {p.content}
                                            </pre>
                                        </details>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <label className="text-xs text-[#64748b]">{t('chat.prompts.assign_to')}:</label>
                                            <select
                                                value={selBot}
                                                onChange={e => setSelectedBot(s => ({ ...s, [p.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                className="bg-[#1e2330] border border-[#2d3748] rounded px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none"
                                            >
                                                <option value="">{t('chat.prompts.select_bot')}</option>
                                                {(myBots as Bot[])
                                                    .filter(b => b.bot_mode === 'all' || b.bot_mode === 'chat')
                                                    .map(b => (
                                                        <option key={b.id} value={b.id}>{b.name}</option>
                                                    ))}
                                            </select>
                                            <Btn
                                                variant="default"
                                                onClick={() => {
                                                    if (!selBot) return
                                                    assignMut.mutate({ botId: Number(selBot), promptId: p.id })
                                                }}
                                                disabled={assignMut.isPending || !selBot}
                                            >
                                                {t('chat.prompts.btn_assign')}
                                            </Btn>
                                            {assignStatus[p.id] && (
                                                <span className="text-xs text-[#86efac]">{assignStatus[p.id]}</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    )
}
