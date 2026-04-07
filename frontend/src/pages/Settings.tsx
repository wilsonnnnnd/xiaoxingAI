import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n/useI18n'
import { getConfig, saveConfig } from '../api'
import type { Config } from '../api'
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
    const [priorities, setPriorities] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState(false)
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
    const [chatIdStatus, setChatIdStatus] = useState('')
    const chatIdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        getConfig().then(cfg => {
            setForm(cfg)
            const vals = (cfg.NOTIFY_MIN_PRIORITY ?? '').split(',').map(s => s.trim()).filter(Boolean)
            setPriorities(new Set(vals))
        }).catch(() => { })
    }, [])

    const set = (k: keyof Config, v: string) => setForm(f => ({ ...f, [k]: v }))

    async function handleSave() {
        setSaving(true)
        setResult(null)
        try {
            await saveConfig({ ...form, NOTIFY_MIN_PRIORITY: [...priorities].join(',') })
            setResult({ ok: true, msg: t('result.saved') })
            if (form.UI_LANG === 'zh' || form.UI_LANG === 'en') setLang(form.UI_LANG)
        } catch (e: unknown) {
            setResult({ ok: false, msg: `${t('result.error_prefix')}${e instanceof Error ? e.message : String(e)}` })
        } finally {
            setSaving(false)
        }
    }

    function togglePriority(p: string) {
        setPriorities(prev => {
            const next = new Set(prev)
            if (next.has(p)) { next.delete(p) } else { next.add(p) }
            return next
        })
    }

    async function startGetChatId() {
        if (chatIdTimerRef.current) return
        const token = form.TELEGRAM_BOT_TOKEN?.trim()
        if (!token) { setChatIdStatus('⚠ Enter Bot Token first'); return }
        setChatIdStatus('⏳ Send any message to your Bot…')
        let elapsed = 0
        chatIdTimerRef.current = setInterval(async () => {
            elapsed += 3
            if (elapsed > 120) {
                clearInterval(chatIdTimerRef.current!)
                chatIdTimerRef.current = null
                setChatIdStatus('❌ Timed out — please retry')
                return
            }
            try {
                const r = await api.get(`/telegram/chat_id?token=${encodeURIComponent(token)}`)
                if (r.data.chat_id) {
                    clearInterval(chatIdTimerRef.current!)
                    chatIdTimerRef.current = null
                    setForm(f => ({ ...f, TELEGRAM_CHAT_ID: String(r.data.chat_id) }))
                    setChatIdStatus(`✅ Got Chat ID: ${r.data.chat_id}`)
                }
            } catch { /* keep polling */ }
        }, 3000)
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <ConnItem label="🤖 AI / LLM" onTest={async () => {
                        const d = await api.get('/ai/ping').then(r => r.data)
                        return `✅ ${d.backend} — ${d.reply}`
                    }} />
                    <ConnItem label="🗄️ Database" onTest={async () => {
                        const d = await api.get('/db/stats').then(r => r.data)
                        return `✅ sender:${d.sender_count} logs:${d.log_count}`
                    }} />
                    <ConnItem label="✈️ Telegram" onTest={async () => {
                        await api.post('/telegram/test')
                        return '✅ Message sent'
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

            {/* Gmail polling */}
            <Card title={t('card.gmail')}>
                <FormGrid>
                    <Field label={t('label.GMAIL_POLL_INTERVAL')} id="GMAIL_POLL_INTERVAL">
                        <input id="GMAIL_POLL_INTERVAL" type="number" min={30} className={inputCls} value={form.GMAIL_POLL_INTERVAL ?? ''} onChange={e => set('GMAIL_POLL_INTERVAL', e.target.value)} />
                    </Field>
                    <Field label={t('label.GMAIL_POLL_MAX')} id="GMAIL_POLL_MAX">
                        <input id="GMAIL_POLL_MAX" type="number" min={1} max={100} className={inputCls} value={form.GMAIL_POLL_MAX ?? ''} onChange={e => set('GMAIL_POLL_MAX', e.target.value)} />
                    </Field>
                    <Field label={t('label.GMAIL_POLL_QUERY')} id="GMAIL_POLL_QUERY">
                        <select id="GMAIL_POLL_QUERY" className={inputCls} value={form.GMAIL_POLL_QUERY ?? ''} onChange={e => set('GMAIL_POLL_QUERY', e.target.value)}>
                            {POLL_QUERIES.map(([q, k]) => <option key={q} value={q}>{t(k)}</option>)}
                        </select>
                    </Field>
                    <Field label={t('label.GMAIL_MARK_READ')} id="GMAIL_MARK_READ">
                        <select id="GMAIL_MARK_READ" className={inputCls} value={form.GMAIL_MARK_READ ?? 'true'} onChange={e => set('GMAIL_MARK_READ', e.target.value)}>
                            <option value="true">{t('opt.GMAIL_MARK_READ.true')}</option>
                            <option value="false">{t('opt.GMAIL_MARK_READ.false')}</option>
                        </select>
                    </Field>
                    <Field label={`${t('label.NOTIFY_MIN_PRIORITY')} — ${t('label.NOTIFY_MIN_PRIORITY_hint')}`} full>
                        <div className="flex gap-4 py-1 flex-wrap">
                            {PRIORITIES.map(p => (
                                <label key={p} className="flex items-center gap-1.5 cursor-pointer text-sm text-[#e2e8f0]">
                                    <input type="checkbox" checked={priorities.has(p)} onChange={() => togglePriority(p)} className="accent-[#6366f1] w-3.5 h-3.5" />
                                    {t(`opt.priority.${p}`)}
                                </label>
                            ))}
                        </div>
                    </Field>
                </FormGrid>
            </Card>

            {/* Telegram */}
            <Card title={t('card.telegram')}>
                <FormGrid>
                    <Field label={t('label.TELEGRAM_BOT_TOKEN')} id="TELEGRAM_BOT_TOKEN" full>
                        <input id="TELEGRAM_BOT_TOKEN" type="password" autoComplete="off" className={inputCls} value={form.TELEGRAM_BOT_TOKEN ?? ''} onChange={e => set('TELEGRAM_BOT_TOKEN', e.target.value)} />
                    </Field>
                    <Field label={t('label.TELEGRAM_CHAT_ID')} id="TELEGRAM_CHAT_ID" full>
                        <div className="flex gap-2 items-center">
                            <input id="TELEGRAM_CHAT_ID" className={`${inputCls} flex-1 min-w-0`} value={form.TELEGRAM_CHAT_ID ?? ''} onChange={e => set('TELEGRAM_CHAT_ID', e.target.value)} />
                            <button
                                onClick={startGetChatId}
                                disabled={!!chatIdTimerRef.current}
                                className="px-3 py-2 text-xs font-semibold rounded bg-[#334155] hover:bg-[#475569] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                                {t('btn.get_chat_id')}
                            </button>
                        </div>
                        {chatIdStatus && <span className="text-xs text-[#94a3b8] mt-0.5">{chatIdStatus}</span>}
                    </Field>
                </FormGrid>
            </Card>

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
                    onClick={() => getConfig().then(cfg => { setForm(cfg); const v = (cfg.NOTIFY_MIN_PRIORITY ?? '').split(',').map(s => s.trim()).filter(Boolean); setPriorities(new Set(v)) }).catch(() => { })}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#334155] hover:bg-[#475569] text-white transition-colors"
                >
                    {t('btn.reload')}
                </button>
            </div>
            {result && (
                <div className={`mt-3 text-xs px-3 py-2 rounded-lg border ${result.ok ? 'bg-[#052e16] text-[#86efac] border-[#166534]' : 'bg-[#450a0a] text-[#fca5a5] border-[#7f1d1d]'}`}>
                    {result.msg}
                </div>
            )}
        </div>
    )
}

