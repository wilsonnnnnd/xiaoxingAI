import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useI18n } from '../../../i18n/useI18n'
import { 
    analyzeEmail, 
    summaryEmail, 
    processEmail
} from '../../gmail/api'
import { gmailFetch, gmailProcess } from '../../gmail/api'
import { generateBotProfile } from '../../chat/api'
import { getMe } from '../../users/api'
import { useHealthCheck } from '../../../hooks/useHealthCheck'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { Select } from '../../../components/common/Select'
import { Badge } from '../../../components/common/Badge'
import toast from 'react-hot-toast'

const SAMPLE = {
    subject: 'Interview Invitation - Software Engineer',
    body: 'Hi Wilson,\n\nWe would like to invite you to a technical interview scheduled for next Tuesday at 10:00 AM (GMT+8). The interview will last approximately 1.5 hours and cover algorithms and system design.\n\nPlease confirm your availability by replying to this email.\n\nBest regards,\nHR Team',
}

const resCls = (state: 'idle' | 'requesting' | 'ok' | 'err') =>
    `bg-[#0b0e14] border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all min-h-[120px] max-h-[340px] overflow-y-auto ${state === 'ok' ? 'border-[#166534] text-[#86efac]' :
        state === 'err' ? 'border-[#7f1d1d] text-[#fca5a5]' :
            'border-[#2d3748] text-[#94a3b8]'
    }`

type ResultState = { state: 'idle' | 'requesting' | 'ok' | 'err'; text: string }
const IDLE: ResultState = { state: 'idle', text: '' }

const POLL_QUERIES: [string, string][] = [
    ['is:unread in:inbox', 'opt.GMAIL_POLL_QUERY.inbox'],
    ['is:unread in:inbox -category:promotions', 'opt.GMAIL_POLL_QUERY.inbox_no_promo'],
    ['is:unread in:inbox -category:promotions -category:social', 'opt.GMAIL_POLL_QUERY.inbox_no_promo_social'],
    ['is:unread in:inbox -category:promotions -category:social -category:updates', 'opt.GMAIL_POLL_QUERY.inbox_no_promo_social_updates'],
    ['is:unread', 'opt.GMAIL_POLL_QUERY.all_unread'],
]

export const DebugPage: React.FC = () => {
    const { t } = useI18n()
    const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: 120_000 })
    const apiOk = useHealthCheck()

    // Analyze
    const [aSubject, setASubject] = useState('')
    const [aBody, setABody] = useState('')
    const [aRes, setARes] = useState<ResultState>(IDLE)
    const [aBusy, setABusy] = useState(false)

    async function runAnalyze() {
        if (!aSubject.trim() || !aBody.trim()) { toast.error(t('debug.err.fill_required')); return }
        setABusy(true); setARes({ state: 'requesting', text: '' })
        try {
            const d = await analyzeEmail(aSubject, aBody)
            setARes({ state: 'ok', text: JSON.stringify(d, null, 2) })
        } catch (err) {
            setARes({ state: 'err', text: String(err) })
        } finally { setABusy(false) }
    }

    // Summary
    const [sSubject, setSSubject] = useState('')
    const [sBody, setSBody] = useState('')
    const [sRes, setSRes] = useState<ResultState>(IDLE)
    const [sBusy, setSBusy] = useState(false)

    async function runSummary() {
        if (!sSubject.trim() || !sBody.trim()) { toast.error(t('debug.err.fill_required')); return }
        setSBusy(true); setSRes({ state: 'requesting', text: '' })
        try {
            const d = await summaryEmail(sSubject, sBody)
            setSRes({ state: 'ok', text: JSON.stringify(d, null, 2) })
        } catch (err) {
            setSRes({ state: 'err', text: String(err) })
        } finally { setSBusy(false) }
    }

    // Pipeline
    const [pSubject, setPSubject] = useState('')
    const [pBody, setPBody] = useState('')
    const [pBusy, setPBusy] = useState(false)
    const [pTab, setPTab] = useState<'tg' | 'analysis' | 'summary' | 'raw'>('tg')
    const [pData, setPData] = useState<any | null>(null)

    async function runProcess() {
        if (!pSubject.trim() || !pBody.trim()) { toast.error(t('debug.err.fill_required')); return }
        setPBusy(true); setPData(null)
        try {
            const d = await processEmail(pSubject, pBody)
            setPData(d); setPTab('tg')
        } catch (err) { /* handled globally */ } finally { setPBusy(false) }
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
        const payload = { query: gQuery, max_results: Number(gMax) || 5 }
        try {
            const d = process 
                ? await gmailProcess({ ...payload, mark_read: gMarkRead, send_telegram: gSendTg })
                : await gmailFetch(payload)
            setGRes({ state: 'ok', text: JSON.stringify(d, null, 2) })
        } catch (err) {
            setGRes({ state: 'err', text: String(err) })
        } finally { setGBusy(false) }
    }

    // Profile
    const [profileText, setProfileText] = useState('')
    const [profileBusy, setProfileBusy] = useState(false)
    const [profileResult, setProfileResult] = useState<{ ok: true; tokens: number } | { ok: false; msg: string } | null>(null)

    async function generateProfile() {
        setProfileBusy(true); setProfileResult(null); setProfileText('')
        try {
            const d = await generateBotProfile()
            if (d.ok) {
                setProfileText(d.profile)
                setProfileResult({ ok: true, tokens: d.tokens })
            } else {
                setProfileResult({ ok: false, msg: (d as { ok: false; msg?: string }).msg || 'Unknown error' })
            }
        } catch (e: any) {
            setProfileResult({ ok: false, msg: String(e) })
        } finally { setProfileBusy(false) }
    }

    if (me && me.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                <div className="text-4xl">🔒</div>
                <p className="text-lg font-bold text-[#e2e8f0]">{t('error.admin_only')}</p>
                <p className="text-sm text-[#64748b]">{t('error.admin_only_hint')}</p>
            </div>
        )
    }

    return (
        <div className="p-5 flex flex-col gap-6 max-w-6xl mx-auto w-full">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-[#1e2330] border border-[#2d3748] rounded-lg text-xs text-[#94a3b8] w-fit">
                <span className={`w-2 h-2 rounded-full shrink-0 ${apiOk ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
                {apiOk ? t('debug.status.ok') : t('debug.status.err')}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Analyze */}
                <Card title={t('debug.card.analyze')} badge="POST /ai/analyze">
                    <InputField label={t('debug.label.subject')} value={aSubject} onChange={setASubject} />
                    <InputField label={t('debug.label.body')} value={aBody} onChange={setABody} multi rows={4} />
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button onClick={runAnalyze} loading={aBusy}>{t('debug.btn.send')}</Button>
                        <Button variant="primary" onClick={() => { setASubject(SAMPLE.subject); setABody(SAMPLE.body) }} className="bg-[#16213e] text-[#94a3b8] hover:text-[#c7d2fe]">
                            {t('debug.btn.fill_sample')}
                        </Button>
                    </div>
                    <div className={resCls(aRes.state)}>{aRes.state === 'idle' ? t('debug.placeholder.result') : aRes.state === 'requesting' ? t('debug.requesting') : aRes.text}</div>
                </Card>

                {/* Summary */}
                <Card title={t('debug.card.summary')} badge="POST /ai/summary">
                    <InputField label={t('debug.label.subject')} value={sSubject} onChange={setSSubject} />
                    <InputField label={t('debug.label.body')} value={sBody} onChange={setSBody} multi rows={4} />
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button onClick={runSummary} loading={sBusy}>{t('debug.btn.send')}</Button>
                        <Button variant="primary" onClick={() => { setSSubject(SAMPLE.subject); setSBody(SAMPLE.body) }} className="bg-[#16213e] text-[#94a3b8] hover:text-[#c7d2fe]">
                            {t('debug.btn.fill_sample')}
                        </Button>
                    </div>
                    <div className={resCls(sRes.state)}>{sRes.state === 'idle' ? t('debug.placeholder.result') : sRes.state === 'requesting' ? t('debug.requesting') : sRes.text}</div>
                </Card>

                {/* Full pipeline */}
                <Card title={t('debug.card.pipeline')} badge="POST /ai/process" full>
                    <div className="flex gap-2 items-center text-[10px] text-[#475569] font-bold uppercase tracking-widest flex-wrap mb-2">
                        {(['debug.step.receive', 'debug.step.analyze', 'debug.step.summarize', 'debug.step.telegram'] as const).map((k, i) => (
                            <span key={k} className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-[#0b0e14] border border-[#2d3748] rounded">{t(k)}</span>
                                {i < 3 && <span className="text-[#2d3748]">→</span>}
                            </span>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
                        <InputField label={t('debug.label.subject')} value={pSubject} onChange={setPSubject} />
                        <Button variant="primary" onClick={() => { setPSubject(SAMPLE.subject); setPBody(SAMPLE.body) }} className="bg-[#16213e] text-[#94a3b8] hover:text-[#c7d2fe] h-10">
                            {t('debug.btn.fill_sample')}
                        </Button>
                    </div>
                    <InputField label={t('debug.label.body')} value={pBody} onChange={setPBody} multi rows={4} />
                    <div className="flex items-center gap-2">
                        <Button variant="telegram" onClick={runProcess} loading={pBusy}>{t('debug.btn.run_pipeline')}</Button>
                    </div>
                    {pData && (
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex gap-1 flex-wrap p-1 bg-[#0b0e14] rounded-lg w-fit">
                                {(['tg', 'analysis', 'summary', 'raw'] as const).map(tab => (
                                    <button key={tab} onClick={() => setPTab(tab)}
                                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${pTab === tab ? 'bg-[#1e2330] text-[#60a5fa] shadow-sm' : 'text-[#64748b] hover:text-[#94a3b8]'}`}
                                    >
                                        {{ tg: t('debug.tab.tg'), analysis: t('debug.tab.analysis'), summary: t('debug.tab.summary'), raw: t('debug.tab.raw') }[tab]}
                                    </button>
                                ))}
                            </div>
                            {pTab === 'tg' && (
                                <div className="bg-[#17212b] border border-[#2b5278] rounded-xl p-4 text-sm whitespace-pre-wrap break-words min-h-[120px] max-h-[400px] overflow-y-auto text-[#e2e8f0] leading-relaxed font-mono">
                                    {(pData.telegram_message as string) || '(empty)'}
                                </div>
                            )}
                            {pTab === 'analysis' && <div className={resCls('ok')}>{JSON.stringify(pData.analysis, null, 2)}</div>}
                            {pTab === 'summary' && <div className={resCls('ok')}>{JSON.stringify(pData.summary, null, 2)}</div>}
                            {pTab === 'raw' && <div className={resCls('ok')}>{JSON.stringify(pData, null, 2)}</div>}
                        </div>
                    )}
                </Card>

                {/* Gmail fetch */}
                <Card title={t('debug.card.gmail_fetch')} full>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-4 items-end">
                        <Select
                            label={t('debug.label.gmail_query')}
                            value={gQuery}
                            onChange={e => setGQuery(e.target.value)}
                            options={POLL_QUERIES.map(([q, k]) => ({ label: t(k), value: q }))}
                        />
                        <InputField
                            label={t('debug.label.max_results')}
                            type="number"
                            min={1}
                            max={50}
                            value={gMax}
                            onChange={v => setGMax(v)}
                            className="w-24"
                        />
                        <div className="flex items-center h-10">
                            <Badge variant="neutral" className="flex items-center gap-2 cursor-pointer py-2">
                                <input type="checkbox" id="mark-read" checked={gMarkRead} onChange={e => setGMarkRead(e.target.checked)} className="accent-[#6366f1]" />
                                <label htmlFor="mark-read" className="text-[#e2e8f0] cursor-pointer select-none">{t('debug.label.mark_read')}</label>
                            </Badge>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mt-2">
                        <Button onClick={() => gmailCall(false)} loading={gBusy}>{t('debug.btn.fetch_only')}</Button>
                        <Button variant="telegram" onClick={() => gmailCall(true)} loading={gBusy}>{t('debug.btn.fetch_process')}</Button>
                        <Badge variant="neutral" className="flex items-center gap-2 cursor-pointer py-2">
                            <input type="checkbox" id="send-tg" checked={gSendTg} onChange={e => setGSendTg(e.target.checked)} className="accent-[#6366f1]" />
                            <label htmlFor="send-tg" className="text-[#e2e8f0] cursor-pointer select-none">{t('debug.label.send_telegram')}</label>
                        </Badge>
                    </div>
                    <div className={resCls(gRes.state)}>{gRes.state === 'idle' ? t('debug.placeholder.result') : gRes.state === 'requesting' ? t('debug.requesting') : gRes.text}</div>
                </Card>

                {/* User Profile */}
                <Card title={`👤 ${t('debug.card.profile')}`} badge="POST /telegram/bot/generate_profile" full>
                    <p className="text-sm text-[#64748b] leading-relaxed -mt-2 mb-2">{t('debug.card.profile_desc')}</p>
                    <div className="flex items-center gap-4 flex-wrap">
                        <Button onClick={generateProfile} loading={profileBusy}>{t('debug.btn.generate_profile')}</Button>
                        {profileResult && (
                            <Badge variant={profileResult.ok ? 'success' : 'error'}>
                                {profileResult.ok
                                    ? (profileResult.tokens === 0 ? t('debug.profile.no_chat') : `✅ ${profileResult.tokens} ${t('debug.profile.tokens')}`)
                                    : `❌ ${(profileResult as { ok: false; msg: string }).msg}`}
                            </Badge>
                        )}
                    </div>
                    <div className="bg-[#0b0e14] border border-[#2d3748] rounded-xl p-4 text-xs font-mono whitespace-pre-wrap break-all min-h-[120px] max-h-[400px] overflow-y-auto text-[#e2e8f0] leading-relaxed mt-2">
                        {profileText || <span className="text-[#475569] italic">{t('debug.profile.empty')}</span>}
                    </div>
                </Card>
            </div>
        </div>
    )
}
