import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../../../i18n/useI18n'
import { formatLogMessage } from '../../../utils/formatLog'
import {
    getChatWorkStatus, startBot, stopBot, clearBotHistory,
    generateChatPersona
} from '../api'
import { getLogs } from '../../gmail'
import { getMe, listUsers, listBots, updateBot } from '../../users'
import { getPersonaConfig } from '../../persona'
import { getDbPrompts, createDbPrompt, deleteDbPrompt } from '../../prompts'
import type { LogEntry, DbPrompt, Bot, User } from '../../../types'
import { parsePersona } from '../utils'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { Select } from '../../../components/common/Select'
import toast from 'react-hot-toast'

const LEVEL_CLS: Record<string, string> = {
    warn: 'text-[#fbbf24]',
    error: 'text-[#fca5a5]',
}

const getTime = (ts: string) => ts.length <= 8 ? ts : ts.slice(11, 19)

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

const LogRow: React.FC<{ entry: LogEntry; usersMap: Map<number, string> }> = ({ entry, usersMap }) => {
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

const _SEC_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fb923c']

const PersonaDisplay: React.FC<{ text: string; onEdit: () => void }> = ({ text, onEdit }) => {
    const { t } = useI18n()
    const [copied, setCopied] = useState(false)
    const sections = parsePersona(text)

    const handleCopy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success(t('chat.persona.copied'))
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748b]">{t('chat.persona.display_title')}</span>
                <div className="flex items-center gap-2">
                    <Button variant="primary" className="px-3 py-1 text-xs bg-[#1e2a3d] text-[#93c5fd]" onClick={handleCopy}>
                        {copied ? t('chat.persona.copied') : t('chat.persona.btn_copy')}
                    </Button>
                    <Button variant="primary" className="px-3 py-1 text-xs bg-[#2d3748] text-[#94a3b8]" onClick={onEdit}>
                        {t('chat.persona.btn_edit')}
                    </Button>
                </div>
            </div>

            {sections.map((s, i) => {
                if (s.kind === 'intro') {
                    return <p key={i} className="text-sm text-[#94a3b8] leading-relaxed">{s.text}</p>
                }
                if (s.kind === 'numbered') {
                    const color = _SEC_COLORS[(s.num - 1) % _SEC_COLORS.length]
                    return (
                        <div key={i} className="rounded-xl overflow-hidden border border-[#1e2a3a]">
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#111827]">
                                <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-xs font-semibold" style={{ color }}>{s.num}. {s.title}</span>
                            </div>
                            <div className="bg-[#0b0e14] px-4 py-3 flex flex-col gap-2">
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
                        <div key={i} className="rounded-xl bg-[#12100a] border border-[#2d2a1a] px-4 py-3">
                            <p className="text-[11px] text-[#92704a] font-medium mb-2 uppercase tracking-wider">{t('chat.persona.notes_title')}</p>
                            <ul className="flex flex-col gap-1.5">
                                {s.items.map((item, ii) => (
                                    <li key={ii} className="flex gap-2 text-[11px] text-[#6b5a3e] leading-snug">
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

export const ChatPage: React.FC = () => {
    const { t } = useI18n()
    const qc = useQueryClient()

    const [keywords, setKeywords] = useState('')
    const [zodiac, setZodiac] = useState('')
    const [chineseZodiac, setChineseZodiac] = useState('')
    const [gender, setGender] = useState('')
    const [age, setAge] = useState('')
    const [generatedPrompt, setGeneratedPrompt] = useState('')
    const [genTokens, setGenTokens] = useState(0)
    const [promptName, setPromptName] = useState('')
    const [selectedBot, setSelectedBot] = useState<Record<number, number | ''>>({})
    const [editMode, setEditMode] = useState(false)

    const botQuery = useQuery({ queryKey: ['chatworkstatus'], queryFn: getChatWorkStatus, enabled: false })
    const { data: chatLogs = [] } = useQuery({ queryKey: ['logs', 'chat'], queryFn: () => getLogs(200, 'chat'), refetchInterval: 8000 })
    const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: Infinity })

    const { data: personaConfig = {} } = useQuery({
        queryKey: ['personaConfig'],
        queryFn: getPersonaConfig,
        staleTime: 60_000,
        enabled: me?.role === 'admin',
    })

    const { data: allUsers = [] } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: async () => { try { return await listUsers() } catch { return [] } },
        staleTime: 60_000,
        enabled: me?.role === 'admin',
    })
    const usersMap = new Map<number, string>(allUsers.map((u) => [u.id, u.email.split('@')[0]] as [number, string]))

    const { data: myBots = [] } = useQuery<Bot[]>({
        queryKey: ['bots', me?.id],
        queryFn: () => listBots(me!.id),
        enabled: me != null,
        staleTime: 30_000,
    })

    const { data: chatPrompts = [] } = useQuery({
        queryKey: ['dbPrompts', 'chat', me?.id],
        queryFn: async () => {
            const all = await getDbPrompts()
            return all.filter((p: DbPrompt) => p.user_id === me?.id && p.type === 'chat')
        },
        enabled: me != null,
        staleTime: 15_000,
    })

    const generateMut = useMutation({
        mutationFn: () => generateChatPersona(keywords.trim(), zodiac || undefined, chineseZodiac || undefined, gender || undefined, age || undefined),
        onSuccess: (data) => {
            setGeneratedPrompt(data.prompt)
            setGenTokens(data.tokens)
            setEditMode(false)
            toast.success(t('chat.persona.generated'))
        },
    })

    const saveMut = useMutation({
        mutationFn: () => {
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
            toast.success(t('chat.persona.saved'))
            setPromptName('')
            setGeneratedPrompt('')
            setGenTokens(0)
            qc.invalidateQueries({ queryKey: ['dbPrompts', 'chat', me?.id] })
        },
    })

    const assignMut = useMutation({
        mutationFn: ({ botId, promptId }: { botId: number; promptId: number }) => updateBot(me!.id, botId, { chat_prompt_id: promptId }),
        onSuccess: () => {
            toast.success(t('chat.prompts.assigned'))
            qc.invalidateQueries({ queryKey: ['bots', me?.id] })
        },
    })

    const deleteMut = useMutation({
        mutationFn: (id: number) => deleteDbPrompt(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dbPrompts', 'chat', me?.id] })
            qc.invalidateQueries({ queryKey: ['bots', me?.id] })
            toast.success(t('chat.prompts.deleted'))
        },
    })

    const botStartMut = useMutation({
        mutationFn: startBot,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['chatworkstatus'] })
            toast.success(t('home.btn.bot_start'))
        },
    })

    const botStopMut = useMutation({
        mutationFn: stopBot,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['chatworkstatus'] })
            toast.success(t('home.btn.bot_stop'))
        },
    })

    const botClearMut = useMutation({
        mutationFn: clearBotHistory,
        onSuccess: () => {
            qc.setQueryData(['logs', 'chat'], [])
            qc.invalidateQueries({ queryKey: ['logs', 'chat'] })
        },
    })

    // Auto-scroll intentionally disabled.

    const botRunning = botQuery.data?.running ?? false
    const chatBots = myBots.filter(b => b.bot_mode === 'all' || b.bot_mode === 'chat')
    const hasChatBot = chatBots.length > 0
    const canStart = hasChatBot

    return (
        <div className="flex flex-col h-full p-5 gap-6 min-w-0 max-w-6xl mx-auto w-full">
            <div className="grid grid-cols-1 gap-6 min-w-0">
                <Card title={t('home.card.bot_worker')} badge={botRunning ? t('home.worker.running') : t('home.worker.stopped')}>
                    <p className="text-sm text-[#64748b]">{t('home.card.bot_worker_desc')}</p>

                    {!botRunning && (
                        <div className="flex flex-col gap-2 bg-[#0b0e14] border border-[#2d3748] rounded-lg p-4">
                            <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">{t('worker.prereq.title')}</p>
                            <div className={`flex items-center gap-2 text-sm ${hasChatBot ? 'text-[#86efac]' : 'text-[#fbbf24]'}`}>
                                <span>{hasChatBot ? '✅' : '⚠️'}</span>
                                <span>{t('worker.prereq.chat_bot')}</span>
                                {!hasChatBot && (
                                    <a href="/settings" className="ml-1 text-xs underline">{t('worker.prereq.bot_goto')}</a>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap mt-2">
                        {!botRunning
                            ? <Button onClick={() => botStartMut.mutate()} disabled={botStartMut.isPending || !canStart}>{t('home.btn.bot_start')}</Button>
                            : <Button variant="primary" className="bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5]" onClick={() => botStopMut.mutate()} loading={botStopMut.isPending}>{t('home.btn.bot_stop')}</Button>
                        }
                    </div>

                    <div className="flex flex-col gap-4 mt-4">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-[#cbd5e1]">{t('home.bot.log_title')}</h3>
                            <Button variant="primary" className="bg-[#334155] text-[#94a3b8] px-3 py-1 text-xs" onClick={() => botClearMut.mutate()} disabled={botClearMut.isPending || chatLogs.length === 0}>
                                {t('home.worker.log_clear')}
                            </Button>
                        </div>
                        <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-4 h-[400px] overflow-y-auto font-mono text-xs leading-relaxed">
                            {chatLogs.length === 0
                                ? <div className="text-[#475569] text-center pt-12">— No logs —</div>
                                : chatLogs.map((e) => <LogRow key={e.id} entry={e} usersMap={usersMap} />)
                            }
                        </div>
                    </div>
                </Card>

                <Card title={t('chat.persona.card_title')}>
                    <p className="text-sm text-[#64748b]">{t('chat.persona.desc')}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                        <Select
                            label={t('chat.persona.zodiac_label')}
                            value={zodiac}
                            onChange={e => setZodiac(e.target.value)}
                            options={[
                                { label: t('chat.persona.select_none'), value: '' },
                                ...Object.keys(personaConfig.zodiac ?? {}).map(key => ({
                                    label: `${PERSONA_ITEM_META[key]?.emoji ?? ''} ${PERSONA_ITEM_META[key]?.zh ?? key}`,
                                    value: key
                                }))
                            ]}
                        />
                        <Select
                            label={t('chat.persona.chinese_zodiac_label')}
                            value={chineseZodiac}
                            onChange={e => setChineseZodiac(e.target.value)}
                            options={[
                                { label: t('chat.persona.select_none'), value: '' },
                                ...Object.keys(personaConfig.chinese_zodiac ?? {}).map(key => ({
                                    label: `${PERSONA_ITEM_META[key]?.emoji ?? ''} ${PERSONA_ITEM_META[key]?.zh ?? key}`,
                                    value: key
                                }))
                            ]}
                        />
                        <Select
                            label={t('chat.persona.gender_label')}
                            value={gender}
                            onChange={e => setGender(e.target.value)}
                            options={[
                                { label: t('chat.persona.select_none'), value: '' },
                                ...Object.keys(personaConfig.gender ?? {}).map(key => ({
                                    label: `${PERSONA_ITEM_META[key]?.emoji ?? ''} ${PERSONA_ITEM_META[key]?.zh ?? key}`,
                                    value: key
                                }))
                            ]}
                        />
                        <Select
                            label={t('chat.persona.age_label')}
                            value={age}
                            onChange={e => setAge(e.target.value)}
                            options={[
                                { label: t('chat.persona.select_none'), value: '' },
                                { label: t('chat.persona.age_opt.youthful'), value: '少年感' },
                                { label: t('chat.persona.age_opt.young_adult'), value: '年轻成年人' },
                                { label: t('chat.persona.age_opt.mature'), value: '成熟' },
                                { label: t('chat.persona.age_opt.middle_aged'), value: '中年感' },
                            ]}
                        />
                    </div>

                    <div className="flex flex-col gap-4">
                        <InputField
                            label={t('chat.persona.keywords_label')}
                            multi
                            rows={3}
                            value={keywords}
                            onChange={v => setKeywords(v)}
                            placeholder={t('chat.persona.keywords_placeholder')}
                        />
                        <Button
                            variant="primary"
                            className="self-start px-6"
                            onClick={() => { if (keywords.trim()) generateMut.mutate() }}
                            loading={generateMut.isPending}
                            disabled={!keywords.trim()}
                        >
                            {t('chat.persona.btn_generate')}
                        </Button>
                    </div>

                    {generatedPrompt && (
                        <div className="flex flex-col gap-6 mt-4 pt-6 border-t border-[#2d3748]">
                            {genTokens > 0 && (
                                <div className="flex justify-end">
                                    <span className="text-[10px] bg-[#1c2a1c] text-[#86efac] px-2.5 py-1 rounded-full font-mono">
                                        {t('chat.persona.tokens')}: {genTokens}
                                    </span>
                                </div>
                            )}

                            {editMode ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">{t('chat.persona.edit_label')}</span>
                                        <Button variant="primary" className="px-3 py-1 text-xs bg-[#1e2a3d] text-[#93c5fd]" onClick={() => setEditMode(false)}>
                                            {t('chat.persona.btn_back_preview')}
                                        </Button>
                                    </div>
                                    <InputField
                                        label=""
                                        multi
                                        rows={12}
                                        value={generatedPrompt}
                                        onChange={v => setGeneratedPrompt(v)}
                                        className="font-mono text-xs leading-relaxed"
                                    />
                                </div>
                            ) : (
                                <PersonaDisplay text={generatedPrompt} onEdit={() => setEditMode(true)} />
                            )}

                            <div className="flex items-end gap-3 p-4 bg-[#0b0e14] border border-[#2d3748] rounded-xl">
                                <InputField
                                    label={t('chat.persona.name_label')}
                                    value={promptName}
                                    onChange={v => setPromptName(v)}
                                    placeholder={t('chat.persona.name_placeholder')}
                                    className="flex-1"
                                />
                                <Button
                                    onClick={() => { if (promptName.trim()) saveMut.mutate() }}
                                    loading={saveMut.isPending}
                                    disabled={!promptName.trim()}
                                    className="px-8"
                                >
                                    {t('chat.persona.btn_save')}
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                <Card title={t('chat.prompts.card_title')}>
                    {chatPrompts.length === 0 ? (
                        <p className="text-sm text-[#475569] py-8 text-center">— {t('chat.prompts.empty')} —</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {chatPrompts.map((p: DbPrompt) => {
                                const assignedBots = myBots.filter(b => b.chat_prompt_id === p.id)
                                const selBot = selectedBot[p.id] ?? ''
                                return (
                                    <div key={p.id} className="bg-[#0b0e14] border border-[#2d3748] rounded-xl p-5 flex flex-col gap-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-base font-bold text-[#e2e8f0]">{p.name}</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {assignedBots.map(b => (
                                                        <span key={b.id} className="text-[10px] px-2 py-0.5 rounded bg-[#1d3461] text-[#93c5fd] font-bold uppercase">
                                                            {b.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <Button
                                                variant="primary"
                                                className="bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5] px-2.5 py-1 text-xs"
                                                onClick={() => {
                                                    if (confirm(t('chat.prompts.confirm_delete').replace('{name}', p.name))) deleteMut.mutate(p.id)
                                                }}
                                                loading={deleteMut.isPending}
                                            >
                                                {t('chat.prompts.btn_delete')}
                                            </Button>
                                        </div>

                                        <details className="group">
                                            <summary className="text-xs text-[#64748b] cursor-pointer select-none hover:text-[#94a3b8] flex items-center gap-1">
                                                <span>{t('chat.prompts.preview')}</span>
                                                <span className="group-open:rotate-180 transition-transform">▾</span>
                                            </summary>
                                            <pre className="mt-2 p-3 bg-[#07090e] rounded-lg text-[11px] text-[#94a3b8] whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto font-mono">
                                                {p.content}
                                            </pre>
                                        </details>

                                        <div className="flex flex-col gap-2 pt-2 border-t border-[#1e2a3a]">
                                            <label className="text-[10px] text-[#475569] font-bold uppercase tracking-wider">{t('chat.prompts.assign_to')}</label>
                                            <div className="flex gap-2">
                                                <Select
                                                    value={selBot}
                                                    onChange={e => setSelectedBot(s => ({ ...s, [p.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                    options={[
                                                        { label: t('chat.prompts.select_bot'), value: '' },
                                                        ...myBots
                                                            .filter(b => b.bot_mode === 'all' || b.bot_mode === 'chat')
                                                            .map(b => ({ label: b.name, value: b.id }))
                                                    ]}
                                                    className="flex-1"
                                                />
                                                <Button
                                                    variant="primary"
                                                    onClick={() => { if (selBot) assignMut.mutate({ botId: Number(selBot), promptId: p.id }) }}
                                                    disabled={!selBot}
                                                    loading={assignMut.isPending}
                                                    className="px-4"
                                                >
                                                    {t('chat.prompts.btn_assign')}
                                                </Button>
                                            </div>
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

