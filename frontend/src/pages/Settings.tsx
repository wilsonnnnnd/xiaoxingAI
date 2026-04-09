import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../i18n/useI18n'
import { getConfig, saveConfig, getMe, getUser, updateUser, listBots, createBot, updateBot, deleteBot, setDefaultBot } from '../api'
import type { Config, Bot } from '../api'
import { api } from '../api/client'

// ── small helpers ────────────────────────────────────────────────

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
    return (
        <div className="bg-[#1e2330] border border-[#2d3748] rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-[#cbd5e1] flex items-center gap-2">{title}</h2>
            {desc && <p className="text-xs text-[#64748b] leading-relaxed">{desc}</p>}
            {children}
        </div>
    )
}

function FormGrid({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}

function Field({
    label, id, full, children,
}: {
    label: string; id?: string; full?: boolean; children: React.ReactNode
}) {
    return (
        <div className={`flex flex-col gap-1${full ? ' col-span-full' : ''}`}>
            <label htmlFor={id} className="text-xs text-[#94a3b8]">{label}</label>
            {children}
        </div>
    )
}

const inputCls = 'bg-[#0b0e14] border border-[#2d3748] rounded-md px-2.5 py-2 text-sm text-[#e2e8f0] outline-none focus:border-[#6366f1] transition-colors'

function ConnItem({
    label, onTest,
}: {
    label: string
    onTest: () => Promise<string>
}) {
    const [status, setStatus] = useState<{ cls: string; msg: string }>({ cls: '', msg: '—' })
    const [busy, setBusy] = useState(false)

    async function run() {
        setBusy(true)
        setStatus({ cls: 'text-[#fbbf24]', msg: 'Testing…' })
        try {
            const msg = await onTest()
            setStatus({ cls: 'text-[#86efac]', msg })
        } catch (e: unknown) {
            const axiosDetail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            const msg = axiosDetail ?? (e instanceof Error ? e.message : String(e))
            setStatus({ cls: 'text-[#fca5a5]', msg: `❌ ${msg}` })
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3 flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#94a3b8]">{label}</span>
            <span className={`text-xs break-all min-h-[1.2em] ${status.cls}`}>{status.msg}</span>
            <button
                disabled={busy}
                onClick={run}
                className="self-start px-3 py-1 text-xs font-semibold rounded-lg bg-[#334155] hover:bg-[#475569] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                Test
            </button>
        </div>
    )
}

// ── Bot management helpers ────────────────────────────────────────

const botInputCls = 'bg-[#0b0e14] border border-[#2d3748] rounded-md px-2.5 py-1.5 text-sm text-[#e2e8f0] outline-none focus:border-[#6366f1] transition-colors w-full'

function BotRow({ bot, userId }: { bot: Bot; userId: number }) {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({ name: bot.name, token: bot.token, chat_id: bot.chat_id, bot_mode: bot.bot_mode ?? 'all' })
    const key = ['bots', userId]

    const doUpdate = useMutation({
        mutationFn: () => updateBot(userId, bot.id, form),
        onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setEditing(false) },
    })
    const doDelete = useMutation({
        mutationFn: () => deleteBot(userId, bot.id),
        onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    })
    const doDefault = useMutation({
        mutationFn: () => setDefaultBot(userId, bot.id),
        onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    })

    if (editing) {
        return (
            <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-3 flex flex-col gap-2">
                <input placeholder={t('users.bot.name')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={botInputCls} />
                <input placeholder={t('users.bot.token')} value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))} className={`${botInputCls} font-mono text-xs`} />
                <input placeholder={t('users.bot.chat_id')} value={form.chat_id} onChange={e => setForm(f => ({ ...f, chat_id: e.target.value }))} className={botInputCls} />
                <select value={form.bot_mode} onChange={e => setForm(f => ({ ...f, bot_mode: e.target.value }))} className={botInputCls}>
                    <option value="all">{t('users.bot.mode.all')}</option>
                    <option value="notify">{t('users.bot.mode.notify')}</option>
                    <option value="chat">{t('users.bot.mode.chat')}</option>
                </select>
                <div className="flex gap-2">
                    <button onClick={() => doUpdate.mutate()} disabled={doUpdate.isPending} className="px-3 py-1 text-xs font-semibold rounded bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-50 transition-colors">{t('users.btn.save')}</button>
                    <button onClick={() => setEditing(false)} className="px-3 py-1 text-xs font-semibold rounded bg-[#334155] hover:bg-[#475569] text-white transition-colors">{t('users.btn.cancel')}</button>
                </div>
                {doUpdate.isError && <p className="text-xs text-[#fca5a5]">{(doUpdate.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '❌'}</p>}
            </div>
        )
    }

    return (
        <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm text-[#e2e8f0] font-medium flex items-center gap-2 flex-wrap">
                    {bot.name}
                    {bot.is_default && <span className="text-xs bg-[#1d4ed8] text-white px-1.5 py-0 rounded">{t('users.bot.default')}</span>}
                    {bot.bot_mode === 'notify' && <span className="text-xs bg-[#854d0e] text-[#fef08a] px-1.5 py-0 rounded">{t('users.bot.mode.notify')}</span>}
                    {bot.bot_mode === 'chat' && <span className="text-xs bg-[#312e81] text-[#c4b5fd] px-1.5 py-0 rounded">{t('users.bot.mode.chat')}</span>}
                </span>
                <span className="text-xs text-[#64748b] font-mono truncate">{bot.chat_id}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {!bot.is_default && <button onClick={() => doDefault.mutate()} disabled={doDefault.isPending} className="px-2 py-1 text-xs rounded bg-[#334155] hover:bg-[#475569] text-[#94a3b8] disabled:opacity-50 transition-colors">{t('users.bot.btn.set_default')}</button>}
                <button onClick={() => setEditing(true)} className="px-2 py-1 text-xs rounded bg-[#334155] hover:bg-[#475569] text-[#94a3b8] transition-colors">{t('users.btn.edit')}</button>
                <button onClick={() => { if (confirm(t('users.bot.confirm_delete'))) doDelete.mutate() }} disabled={doDelete.isPending} className="px-2 py-1 text-xs rounded bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5] disabled:opacity-50 transition-colors">{t('users.bot.btn.delete')}</button>
            </div>
        </div>
    )
}

function AddBotForm({ userId, onDone }: { userId: number; onDone: () => void }) {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [form, setForm] = useState({ name: '', token: '', chat_id: '', bot_mode: 'all' })

    const doCreate = useMutation({
        mutationFn: () => createBot(userId, form),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['bots', userId] }); onDone() },
    })

    return (
        <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-3 flex flex-col gap-2">
            <input placeholder={t('users.bot.name')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={botInputCls} />
            <input placeholder={t('users.bot.token')} value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))} className={`${botInputCls} font-mono text-xs`} />
            <input placeholder={t('users.bot.chat_id')} value={form.chat_id} onChange={e => setForm(f => ({ ...f, chat_id: e.target.value }))} className={botInputCls} />
            <select value={form.bot_mode} onChange={e => setForm(f => ({ ...f, bot_mode: e.target.value }))} className={botInputCls}>
                <option value="all">{t('users.bot.mode.all')}</option>
                <option value="notify">{t('users.bot.mode.notify')}</option>
                <option value="chat">{t('users.bot.mode.chat')}</option>
            </select>
            <div className="flex gap-2">
                <button onClick={() => doCreate.mutate()} disabled={doCreate.isPending || !form.name || !form.token || !form.chat_id} className="px-3 py-1 text-xs font-semibold rounded bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-50 transition-colors">{t('users.bot.btn.add')}</button>
                <button onClick={onDone} className="px-3 py-1 text-xs font-semibold rounded bg-[#334155] hover:bg-[#475569] text-white transition-colors">{t('users.btn.cancel')}</button>
            </div>
            {doCreate.isError && <p className="text-xs text-[#fca5a5]">{(doCreate.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '❌'}</p>}
        </div>
    )
}

// ── Main page ────────────────────────────────────────────────────

const PRIORITIES = ['high', 'medium', 'low'] as const
const POLL_QUERIES: [string, string][] = [
    ['is:unread in:inbox', 'opt.GMAIL_POLL_QUERY.inbox'],
    ['is:unread in:inbox -category:promotions', 'opt.GMAIL_POLL_QUERY.inbox_no_promo'],
    ['is:unread in:inbox -category:promotions -category:social', 'opt.GMAIL_POLL_QUERY.inbox_no_promo_social'],
    ['is:unread in:inbox -category:promotions -category:social -category:updates', 'opt.GMAIL_POLL_QUERY.inbox_no_promo_social_updates'],
    ['is:unread', 'opt.GMAIL_POLL_QUERY.all_unread'],
]

export default function Settings() {
    const { t, lang, setLang } = useI18n()
    const [form, setForm] = useState<Partial<Config>>({})
    const [saving, setSaving] = useState(false)
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
    const [myId, setMyId] = useState<number | null>(null)
    const [userForm, setUserForm] = useState({ min_priority: 'medium', max_emails_per_run: 10, poll_interval: 300 })
    const [addingBot, setAddingBot] = useState(false)

    const { data: bots = [] } = useQuery({
        queryKey: ['bots', myId],
        queryFn: () => listBots(myId!),
        enabled: myId != null,
    })
    useEffect(() => {
        getConfig().then(cfg => setForm(cfg)).catch(() => { })
    }, [])
    useEffect(() => {
        getMe().then(me => {
            setMyId(me.id)
            return getUser(me.id)
        }).then(u => {
            setUserForm({ min_priority: u.min_priority, max_emails_per_run: u.max_emails_per_run, poll_interval: u.poll_interval })
        }).catch(() => { })
    }, [])

    const set = (k: keyof Config, v: string) => setForm(f => ({ ...f, [k]: v }))

    async function handleSave() {
        setSaving(true)
        setResult(null)
        try {
            await Promise.all([
                saveConfig(form),
                ...(myId != null ? [updateUser(myId, userForm)] : []),
            ])
            setResult({ ok: true, msg: t('result.saved') })
            if (form.UI_LANG === 'zh' || form.UI_LANG === 'en') setLang(form.UI_LANG)
        } catch (e: unknown) {
            setResult({ ok: false, msg: `${t('result.error_prefix')}${e instanceof Error ? e.message : String(e)}` })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex flex-col h-full p-5 gap-4 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-white">{t('header.title.settings')}</h1>
                    <p className="text-sm text-[#64748b]">{t('header.subtitle.settings')}</p>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                    <label className="text-xs text-[#94a3b8]">{t('label.ui_lang')}</label>
                    <select
                        value={form.UI_LANG ?? lang}
                        onChange={e => { set('UI_LANG', e.target.value); setLang(e.target.value as 'en' | 'zh') }}
                        className={`${inputCls} min-w-30`}
                    >
                        <option value="en">English</option>
                        <option value="zh">中文</option>
                    </select>
                </div>
            </div>

            {/* Connection tests */}
            <Card title={t('card.connections')}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ConnItem label="🤖 AI / LLM" onTest={async () => {
                        const d = await api.get('/ai/ping').then(r => r.data)
                        return `✅ ${d.backend} — ${d.reply}`
                    }} />
                    <ConnItem label="🗄️ Database" onTest={async () => {
                        const d = await api.get('/db/stats').then(r => r.data)
                        return `✅ sender:${d.sender_count} logs:${d.log_count}`
                    }} />
                    <ConnItem label="🔑 Gmail OAuth" onTest={async () => {
                        const d = await api.post('/gmail/fetch', { query: 'in:inbox', max_results: 1 }).then(r => r.data)
                        return `✅ Fetched ${d.count} email(s)`
                    }} />
                </div>
            </Card>

            {/* LLM */}
            <Card title={t('card.llm')} desc={t('card.llm_desc')}>
                <FormGrid>
                    <Field label={t('label.LLM_BACKEND')} id="LLM_BACKEND">
                        <select id="LLM_BACKEND" value={form.LLM_BACKEND ?? ''} onChange={e => set('LLM_BACKEND', e.target.value)} className={inputCls}>
                            <option value="local">{t('opt.LLM_BACKEND.local')}</option>
                            <option value="openai">{t('opt.LLM_BACKEND.openai')}</option>
                        </select>
                    </Field>
                    <Field label={t('label.LLM_MODEL')} id="LLM_MODEL">
                        <input id="LLM_MODEL" className={inputCls} placeholder="local-model or gpt-4o-mini" value={form.LLM_MODEL ?? ''} onChange={e => set('LLM_MODEL', e.target.value)} />
                    </Field>
                    <Field label={t('label.LLM_API_URL')} id="LLM_API_URL" full>
                        <input id="LLM_API_URL" className={inputCls} placeholder="http://127.0.0.2:8001/v1/chat/completions" value={form.LLM_API_URL ?? ''} onChange={e => set('LLM_API_URL', e.target.value)} />
                    </Field>
                    <Field label={`${t('label.OPENAI_API_KEY')} (only for openai)`} id="OPENAI_API_KEY" full>
                        <input id="OPENAI_API_KEY" type="password" className={inputCls} placeholder="sk-..." autoComplete="off" value={form.OPENAI_API_KEY ?? ''} onChange={e => set('OPENAI_API_KEY', e.target.value)} />
                    </Field>
                </FormGrid>
            </Card>

            {/* Gmail settings (merged) */}
            <Card title={t('card.gmail')}>
                <FormGrid>
                    <Field label={t('users.min_priority')} id="user_min_priority">
                        <select id="user_min_priority" className={inputCls} value={userForm.min_priority} onChange={e => setUserForm(f => ({ ...f, min_priority: e.target.value }))}>
                            {PRIORITIES.map(p => <option key={p} value={p}>{t(`opt.priority.${p}`)}</option>)}
                        </select>
                    </Field>
                    <Field label={t('users.max_emails')} id="user_max_emails">
                        <input id="user_max_emails" type="number" min={1} max={100} className={inputCls} value={userForm.max_emails_per_run} onChange={e => setUserForm(f => ({ ...f, max_emails_per_run: Number(e.target.value) }))} />
                    </Field>
                    <Field label={t('users.poll_interval')} id="user_poll_interval">
                        <input id="user_poll_interval" type="number" min={60} step={60} className={inputCls} value={userForm.poll_interval} onChange={e => setUserForm(f => ({ ...f, poll_interval: Number(e.target.value) }))} />
                    </Field>
                    <Field label={t('label.GMAIL_MARK_READ')} id="GMAIL_MARK_READ">
                        <select id="GMAIL_MARK_READ" className={inputCls} value={form.GMAIL_MARK_READ ?? 'true'} onChange={e => set('GMAIL_MARK_READ', e.target.value)}>
                            <option value="true">{t('opt.GMAIL_MARK_READ.true')}</option>
                            <option value="false">{t('opt.GMAIL_MARK_READ.false')}</option>
                        </select>
                    </Field>
                    <Field label={t('label.GMAIL_POLL_QUERY')} id="GMAIL_POLL_QUERY" full>
                        <select id="GMAIL_POLL_QUERY" className={inputCls} value={form.GMAIL_POLL_QUERY ?? ''} onChange={e => set('GMAIL_POLL_QUERY', e.target.value)}>
                            {POLL_QUERIES.map(([q, k]) => <option key={q} value={q}>{t(k)}</option>)}
                        </select>
                    </Field>
                </FormGrid>
            </Card>
            {result && (
                <div className={`mt-3 text-xs px-3 py-2 rounded-lg border ${result.ok ? 'bg-[#052e16] text-[#86efac] border-[#166534]' : 'bg-[#450a0a] text-[#fca5a5] border-[#7f1d1d]'}`}>
                    {result.msg}
                </div>
            )}

            {/* My Telegram Bots */}
            {myId != null && (
                <Card title={t('card.telegram')}>
                    <p className="text-xs text-[#64748b]">{t('settings.bots.desc')}</p>
                    <div className="flex flex-col gap-2">
                        {(bots as Bot[]).length === 0 && !addingBot && (
                            <p className="text-xs text-[#64748b]">{t('users.bots.empty')}</p>
                        )}
                        {(bots as Bot[]).map(bot => (
                            <BotRow key={bot.id} bot={bot} userId={myId} />
                        ))}
                        {addingBot
                            ? <AddBotForm userId={myId} onDone={() => setAddingBot(false)} />
                            : <button onClick={() => setAddingBot(true)} className="self-start px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#334155] hover:bg-[#475569] text-[#e2e8f0] transition-colors">＋ {t('users.bot.btn.add')}</button>
                        }
                    </div>
                </Card>
            )}

            {/* Save bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#6366f1] hover:bg-[#4f46e5] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? '…' : `${t('btn.save')}`}
                </button>
                <button
                    onClick={() => {
                        getConfig().then(cfg => setForm(cfg)).catch(() => { })
                        if (myId != null) getUser(myId).then(u => setUserForm({ min_priority: u.min_priority, max_emails_per_run: u.max_emails_per_run, poll_interval: u.poll_interval })).catch(() => { })
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#334155] hover:bg-[#475569] text-white transition-colors"
                >
                    {t('btn.reload')}
                </button>
            </div>

        </div>
    )
}

