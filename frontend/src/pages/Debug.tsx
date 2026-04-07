import { useState, useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import { api } from '../api/client'

const SAMPLE = {
    subject: 'Interview Invitation - Software Engineer',
    body: 'Hi Wilson,\n\nWe would like to invite you to a technical interview scheduled for next Tuesday at 10:00 AM (GMT+8). The interview will last approximately 1.5 hours and cover algorithms and system design.\n\nPlease confirm your availability by replying to this email.\n\nBest regards,\nHR Team',
}

// ── helpers ──────────────────────────────────────────────────────

const resCls = (state: 'idle' | 'requesting' | 'ok' | 'err') =>
    `bg-[#0b0e14] border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all min-h-[120px] max-h-[340px] overflow-y-auto ${state === 'ok' ? 'border-[#166534] text-[#86efac]' :
        state === 'err' ? 'border-[#7f1d1d] text-[#fca5a5]' :
            'border-[#2d3748] text-[#94a3b8]'
    }`

function Card({ title, full, badge, children }: { title: string; badge?: string; full?: boolean; children: React.ReactNode }) {
    return (
        <div className={`bg-[#1e2330] border border-[#2d3748] rounded-xl p-5 flex flex-col gap-3${full ? ' col-span-full' : ''}`}>
            <h2 className="text-sm font-semibold text-[#cbd5e1] flex items-center gap-2 flex-wrap">
                {title}
                {badge && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1d4ed8] text-[#bfdbfe]">{badge}</span>}
            </h2>
            {children}
        </div>
    )
}

function InputField({ label, value, onChange, multi = false, rows = 5 }: {
    label: string; value: string; onChange: (v: string) => void; multi?: boolean; rows?: number
}) {
    const cls = 'w-full bg-[#0b0e14] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] outline-none focus:border-[#6366f1] transition-colors'
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-[#94a3b8]">{label}</label>
            {multi
                ? <textarea className={cls} rows={rows} value={value} onChange={e => onChange(e.target.value)} />
                : <input className={cls} value={value} onChange={e => onChange(e.target.value)} />
            }
        </div>
    )
}

function Btn({ onClick, disabled, tg, children }: {
    onClick: () => void; disabled?: boolean; tg?: boolean; children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${tg ? 'bg-[#0088cc] hover:bg-[#006fa8]' : 'bg-[#6366f1] hover:bg-[#4f46e5]'
                }`}
        >
            {children}
        </button>
    )
}

function FillBtn({ onClick }: { onClick: () => void }) {
    const { t } = useI18n()
    return (
        <button onClick={onClick} className="px-2.5 py-1 border border-[#2d3748] rounded-lg text-xs text-[#94a3b8] bg-[#16213e] hover:border-[#6366f1] hover:text-[#c7d2fe] transition-colors">
            {t('debug.btn.fill_sample')}
        </button>
    )
}

type ResultState = { state: 'idle' | 'requesting' | 'ok' | 'err'; text: string }
const IDLE: ResultState = { state: 'idle', text: '' }

const POLL_QUERIES: [string, string][] = [
    ['is:unread in:inbox', 'opt.GMAIL_POLL_QUERY.inbox'],
    ['is:unread in:inbox -category:promotions', 'opt.GMAIL_POLL_QUERY.inbox_no_promo'],
    ['is:unread in:inbox -category:promotions -category:social', 'opt.GMAIL_POLL_QUERY.inbox_no_promo_social'],
    ['is:unread in:inbox -category:promotions -category:social -category:updates', 'opt.GMAIL_POLL_QUERY.inbox_no_promo_social_updates'],
    ['is:unread', 'opt.GMAIL_POLL_QUERY.all_unread'],
]

// ── Main page ────────────────────────────────────────────────────

export default function Debug() {
    const { t } = useI18n()

    // Health
    const [health, setHealth] = useState<{ ok: boolean; msg: string } | null>(null)

    useEffect(() => {
        const check = () => api.get('/health').then(r => {
            setHealth({ ok: true, msg: `✅ ${t('debug.status.ok')} ${JSON.stringify(r.data)}` })
        }).catch(() => setHealth({ ok: false, msg: `❌ ${t('debug.status.err')}` }))
        check()
        const id = setInterval(check, 15_000)
        return () => clearInterval(id)
    }, [t])

    // Analyze
    const [aSubject, setASubject] = useState('')
    const [aBody, setABody] = useState('')
    const [aRes, setARes] = useState<ResultState>(IDLE)
    const [aBusy, setABusy] = useState(false)

    async function runAnalyze() {
        if (!aSubject.trim() || !aBody.trim()) { setARes({ state: 'err', text: t('debug.err.fill_required') }); return }
        setABusy(true); setARes({ state: 'requesting', text: '' })
        try {
            const d = await api.post('/ai/analyze', { subject: aSubject, body: aBody }).then(r => r.data)
            setARes({ state: 'ok', text: JSON.stringify(d, null, 2) })
        } catch (e: unknown) {
            setARes({ state: 'err', text: `${t('debug.err.network')}${e instanceof Error ? e.message : String(e)}` })
        } finally { setABusy(false) }
    }

    // Summary
    const [sSubject, setSSubject] = useState('')
    const [sBody, setSBody] = useState('')
    const [sRes, setSRes] = useState<ResultState>(IDLE)
    const [sBusy, setSBusy] = useState(false)

    async function runSummary() {
        if (!sSubject.trim() || !sBody.trim()) { setSRes({ state: 'err', text: t('debug.err.fill_required') }); return }
        setSBusy(true); setSRes({ state: 'requesting', text: '' })
        try {
            const d = await api.post('/ai/summary', { subject: sSubject, body: sBody }).then(r => r.data)
            setSRes({ state: 'ok', text: JSON.stringify(d, null, 2) })
        } catch (e: unknown) {
            setSRes({ state: 'err', text: `${t('debug.err.network')}${e instanceof Error ? e.message : String(e)}` })
        } finally { setSBusy(false) }
    }

    // Pipeline
    const [pSubject, setPSubject] = useState('')
    const [pBody, setPBody] = useState('')
    const [pBusy, setPBusy] = useState(false)
    const [pTab, setPTab] = useState<'tg' | 'analysis' | 'summary' | 'raw'>('tg')
    const [pData, setPData] = useState<Record<string, unknown> | null>(null)
    const [pErr, setPErr] = useState('')

    async function runProcess() {
        if (!pSubject.trim() || !pBody.trim()) { setPErr(t('debug.err.fill_required')); return }
        setPBusy(true); setPData(null); setPErr('')
        try {
            const d = await api.post('/ai/process', { subject: pSubject, body: pBody }).then(r => r.data)
            setPData(d); setPTab('tg')
        } catch (e: unknown) {
            setPErr(`${t('debug.err.network')}${e instanceof Error ? e.message : String(e)}`)
        } finally { setPBusy(false) }
    }

    // Gmail
    const [gQuery, setGQuery] = useState('is:unread in:inbox')
    const [gMax, setGMax] = useState('5')
    const [gMarkRead, setGMarkRead] = useState(false)
    const [gSendTg, setGSendTg] = useState(false)
    const [gRes, setGRes] = useState<ResultState>(IDLE)
    const [gBusy, setGBusy] = useState(false)

    async function gmailCall(process: boolean) {
        setGBusy(true); setGRes({ state: 'requesting', text: '' })
        const payload = process
            ? { query: gQuery, max_results: Number(gMax) || 5, mark_read: gMarkRead, send_telegram: gSendTg }
            : { query: gQuery, max_results: Number(gMax) || 5 }
        const endpoint = process ? '/gmail/process' : '/gmail/fetch'
        try {
            const d = await api.post(endpoint, payload).then(r => r.data)
            setGRes({ state: 'ok', text: JSON.stringify(d, null, 2) })
        } catch (e: unknown) {
            setGRes({ state: 'err', text: `${t('debug.err.network')}${e instanceof Error ? e.message : String(e)}` })
        } finally { setGBusy(false) }
    }

    // Profile
    const [profileText, setProfileText] = useState('')
    const [profileBusy, setProfileBusy] = useState(false)
    const [profileResult, setProfileResult] = useState<{ ok: true; tokens: number } | { ok: false; msg: string } | null>(null)

    useEffect(() => {
        api.get('/telegram/bot/profile').then(r => setProfileText(r.data.profile ?? '')).catch(() => {})
    }, [])

    async function generateProfile() {
        setProfileBusy(true)
        setProfileResult(null)
        try {
            const d = await api.post('/telegram/bot/generate_profile').then(r => r.data)
            setProfileText(d.profile ?? '')
            setProfileResult({ ok: true, tokens: d.tokens as number })
        } catch (e: unknown) {
            const axiosDetail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            const msg = axiosDetail ?? (e instanceof Error ? e.message : String(e))
            setProfileResult({ ok: false, msg })
        } finally {
            setProfileBusy(false)
        }
    }

    return (
        <div className="flex flex-col h-full p-5 gap-4 min-w-0">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-white">{t('header.title.debug')}</h1>
                <p className="text-sm text-[#64748b]">{t('header.subtitle.debug')}</p>
            </div>

            {/* Health bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#1e2330] border border-[#2d3748] rounded-lg text-xs text-[#94a3b8]">
                <span className={`w-2 h-2 rounded-full shrink-0 ${health?.ok ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
                {health?.msg ?? t('home.status.checking')}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Analyze */}
                <Card title={t('debug.card.analyze')} badge="POST /ai/analyze">
                    <InputField label={t('debug.label.subject')} value={aSubject} onChange={setASubject} />
                    <InputField label={t('debug.label.body')} value={aBody} onChange={setABody} multi />
                    <div className="flex items-center gap-2 flex-wrap">
                        <Btn onClick={runAnalyze} disabled={aBusy}>{t('debug.btn.send')}</Btn>
                        <FillBtn onClick={() => { setASubject(SAMPLE.subject); setABody(SAMPLE.body) }} />
                        {aBusy && <span className="text-xs text-[#94a3b8]">…</span>}
                    </div>
                    <div className={resCls(aRes.state)}>{aRes.state === 'idle' ? t('debug.placeholder.result') : aRes.state === 'requesting' ? t('debug.requesting') : aRes.text}</div>
                </Card>

                {/* Summary */}
                <Card title={t('debug.card.summary')} badge="POST /ai/summary">
                    <InputField label={t('debug.label.subject')} value={sSubject} onChange={setSSubject} />
                    <InputField label={t('debug.label.body')} value={sBody} onChange={setSBody} multi />
                    <div className="flex items-center gap-2 flex-wrap">
                        <Btn onClick={runSummary} disabled={sBusy}>{t('debug.btn.send')}</Btn>
                        <FillBtn onClick={() => { setSSubject(SAMPLE.subject); setSBody(SAMPLE.body) }} />
                        {sBusy && <span className="text-xs text-[#94a3b8]">…</span>}
                    </div>
                    <div className={resCls(sRes.state)}>{sRes.state === 'idle' ? t('debug.placeholder.result') : sRes.state === 'requesting' ? t('debug.requesting') : sRes.text}</div>
                </Card>

                {/* Full pipeline */}
                <Card title={t('debug.card.pipeline')} badge="POST /ai/process" full>
                    <div className="flex gap-1.5 items-center text-xs text-[#64748b] flex-wrap">
                        {(['debug.step.receive', 'debug.step.analyze', 'debug.step.summarize', 'debug.step.telegram'] as const).map((k, i) => (
                            <span key={k} className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 bg-[#0b0e14] border border-[#2d3748] rounded">{t(k)}</span>
                                {i < 3 && <span className="text-[#4a5568]">→</span>}
                            </span>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                        <InputField label={t('debug.label.subject')} value={pSubject} onChange={setPSubject} />
                        <FillBtn onClick={() => { setPSubject(SAMPLE.subject); setPBody(SAMPLE.body) }} />
                    </div>
                    <InputField label={t('debug.label.body')} value={pBody} onChange={setPBody} multi rows={4} />
                    <div className="flex items-center gap-2">
                        <Btn tg onClick={runProcess} disabled={pBusy}>{t('debug.btn.run_pipeline')}</Btn>
                        {pBusy && <span className="text-xs text-[#94a3b8]">…</span>}
                    </div>
                    {(pData || pErr) && (
                        <>
                            <div className="flex gap-1.5 flex-wrap">
                                {(['tg', 'analysis', 'summary', 'raw'] as const).map(tab => (
                                    <button key={tab} onClick={() => setPTab(tab)}
                                        className={`px-3 py-1 text-xs rounded border transition-colors ${pTab === tab ? 'border-[#6366f1] text-[#c7d2fe] bg-[#1e2240]' : 'border-[#2d3748] text-[#94a3b8] bg-[#0b0e14] hover:border-[#475569]'}`}
                                    >
                                        {{ tg: `✈️ ${t('debug.tab.tg')}`, analysis: `🔍 ${t('debug.tab.analysis')}`, summary: `📝 ${t('debug.tab.summary')}`, raw: `{} ${t('debug.tab.raw')}` }[tab]}
                                    </button>
                                ))}
                            </div>
                            {pErr && <div className="text-xs text-[#fca5a5]">{pErr}</div>}
                            {pData && (
                                <>
                                    {pTab === 'tg' && (
                                        <div className="bg-[#17212b] border border-[#2b5278] rounded-lg p-3.5 text-sm whitespace-pre-wrap wrap-break-word min-h-30 max-h-85 overflow-y-auto text-[#e2e8f0] leading-relaxed">
                                            {(pData.telegram_message as string) || '(empty)'}
                                        </div>
                                    )}
                                    {pTab === 'analysis' && <div className={resCls('ok')}>{JSON.stringify(pData.analysis, null, 2)}</div>}
                                    {pTab === 'summary' && <div className={resCls('ok')}>{JSON.stringify(pData.summary, null, 2)}</div>}
                                    {pTab === 'raw' && <div className={resCls('ok')}>{JSON.stringify(pData, null, 2)}</div>}
                                </>
                            )}
                        </>
                    )}
                </Card>

                {/* Gmail fetch */}
                <Card title={t('debug.card.gmail_fetch')} full>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-[#94a3b8]">{t('debug.label.gmail_query')}</label>
                            <select className="w-full bg-[#0b0e14] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] outline-none focus:border-[#6366f1] transition-colors" value={gQuery} onChange={e => setGQuery(e.target.value)}>
                                {POLL_QUERIES.map(([q, k]) => <option key={q} value={q}>{t(k)}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-[#94a3b8]">{t('debug.label.max_results')}</label>
                            <input type="number" min={1} max={50} className="w-20 bg-[#0b0e14] border border-[#2d3748] rounded-lg px-2 py-2 text-sm text-[#e2e8f0] outline-none focus:border-[#6366f1] transition-colors" value={gMax} onChange={e => setGMax(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-1.5 pb-1">
                            <input type="checkbox" id="mark-read" checked={gMarkRead} onChange={e => setGMarkRead(e.target.checked)} className="accent-[#6366f1]" />
                            <label htmlFor="mark-read" className="text-xs text-[#e2e8f0] whitespace-nowrap cursor-pointer">{t('debug.label.mark_read')}</label>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Btn onClick={() => gmailCall(false)} disabled={gBusy}>{t('debug.btn.fetch_only')}</Btn>
                        <Btn tg onClick={() => gmailCall(true)} disabled={gBusy}>{t('debug.btn.fetch_process')}</Btn>
                        <label className="flex items-center gap-1.5 text-xs text-[#e2e8f0] cursor-pointer">
                            <input type="checkbox" checked={gSendTg} onChange={e => setGSendTg(e.target.checked)} className="accent-[#6366f1]" />
                            {t('debug.label.send_telegram')}
                        </label>
                        {gBusy && <span className="text-xs text-[#94a3b8]">…</span>}
                    </div>
                    <div className={resCls(gRes.state)}>{gRes.state === 'idle' ? t('debug.placeholder.result') : gRes.state === 'requesting' ? t('debug.requesting') : gRes.text}</div>
                </Card>

                {/* User Profile */}
                <Card title={`👤 ${t('debug.card.profile')}`} badge="POST /telegram/bot/generate_profile" full>
                    <p className="text-xs text-[#64748b] leading-relaxed">{t('debug.card.profile_desc')}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                        <Btn onClick={generateProfile} disabled={profileBusy}>{t('debug.btn.generate_profile')}</Btn>
                        {profileBusy && <span className="text-xs text-[#94a3b8]">…</span>}
                        {profileResult && (
                            <span className={`text-xs ${profileResult.ok ? 'text-[#86efac]' : 'text-[#fca5a5]'}`}>
                                {profileResult.ok
                                    ? (profileResult.tokens === 0 ? t('debug.profile.no_chat') : `✅ ${profileResult.tokens} ${t('debug.profile.tokens')}`)
                                    : `❌ ${profileResult.msg}`}
                            </span>
                        )}
                    </div>
                    <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all min-h-30 max-h-85 overflow-y-auto text-[#e2e8f0]">
                        {profileText || <span className="text-[#4a5568]">{t('debug.profile.empty')}</span>}
                    </div>
                </Card>
            </div>
        </div>
    )
}

