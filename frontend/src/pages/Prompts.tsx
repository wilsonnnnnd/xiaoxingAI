import { useState, useEffect } from 'react'
import { useI18n } from '../i18n/useI18n'
import { listPrompts, getPrompt, savePrompt, deletePrompt, getConfig, saveConfig } from '../api'

const DEFAULT_FILES = new Set(['gmail/email_analysis.txt', 'gmail/email_summary.txt', 'gmail/telegram_notify.txt', 'chat.txt', 'user_profile.txt'])

const ASSIGN_KEYS = [
  { id: 'PROMPT_ANALYZE', label: '📊 Email Analysis', default: 'gmail/email_analysis.txt' },
  { id: 'PROMPT_SUMMARY', label: '📝 Email Summary', default: 'gmail/email_summary.txt' },
  { id: 'PROMPT_TELEGRAM', label: '✈️ Telegram Format', default: 'gmail/telegram_notify.txt' },
  { id: 'PROMPT_CHAT', label: '🤖 Bot Chat', default: 'chat.txt' },
  { id: 'PROMPT_PROFILE', label: '👤 User Profile', default: 'user_profile.txt' },
] as const

const FILE_LABELS: Record<string, string> = {
  'gmail/email_analysis.txt': '📊 Analyze',
  'gmail/email_summary.txt': '📝 Summary',
  'gmail/telegram_notify.txt': '✈️ Telegram',
  'chat.txt': '🤖 Chat',
  'user_profile.txt': '👤 Profile',
}

const editorCls = 'w-full min-h-[460px] bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3.5 text-sm text-[#e2e8f0] font-mono leading-relaxed resize-y outline-none focus:border-[#6366f1] transition-colors tab-size-2'

function Badge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${ok ? 'bg-[#052e16] text-[#86efac] border border-[#166534]' : 'bg-[#450a0a] text-[#fca5a5] border border-[#7f1d1d]'}`}>
      {label}
    </span>
  )
}

export default function Prompts() {
  const { t } = useI18n()
  const [files, setFiles] = useState<string[]>([])
  const [custom, setCustom] = useState<Set<string>>(new Set())
  const [current, setCurrent] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [assignment, setAssignment] = useState<Record<string, string>>({})
  const [assignResult, setAssignResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFileResult, setNewFileResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const isDirty = content !== savedContent

  async function loadFiles(target?: string) {
    try {
      const d = await listPrompts()
      setFiles(d.files)
      setCustom(new Set(d.custom ?? []))
      const sel = (target && d.files.includes(target)) ? target : d.files[0]
      if (sel) switchTo(sel, d.files)
    } catch {
      /* ignore */
    }
  }

  const loadFile = async (filename: string) => {
    setLoading(true)
    try {
      const d = await getPrompt(filename)
      setContent(d.content)
      setSavedContent(d.content)
      setCurrent(filename)
    } catch (e: unknown) {
      setContent(`❌ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  function switchTo(filename: string, fileList?: string[]) {
    const list = fileList ?? files
    if (!list.includes(filename)) return
    if (filename === current) return
    if (isDirty && !confirm(t('prompts.confirm.discard'))) return
    loadFile(filename)
    setSaveResult(null)
  }

  useEffect(() => {
    loadFiles()
    getConfig().then(cfg => {
      const asgn: Record<string, string> = {}
      ASSIGN_KEYS.forEach(k => { asgn[k.id] = (cfg as unknown as Record<string, string>)[k.id] ?? k.default })
      setAssignment(asgn)
    }).catch(() => { })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!current) return
    setSaving(true)
    setSaveResult(null)
    try {
      await savePrompt(current, content)
      setSavedContent(content)
      setCustom(prev => new Set([...prev, current]))
      setSaveResult({ ok: true, msg: t('prompts.saved') })
    } catch (e: unknown) {
      setSaveResult({ ok: false, msg: `❌ ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!current) return
    if (!confirm(t('prompts.confirm.delete').replace('{file}', current))) return
    try {
      await deletePrompt(current)
      setSavedContent('')
      setCurrent(null)
      setCustom(prev => { const n = new Set(prev); n.delete(current); return n })
      await loadFiles(files.find(f => DEFAULT_FILES.has(f)))
    } catch (e: unknown) {
      setSaveResult({ ok: false, msg: `❌ ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  async function handleRevert() {
    if (!current) return
    if (!confirm(t('prompts.confirm.revert'))) return
    try {
      await deletePrompt(current)
      setCustom(prev => { const n = new Set(prev); n.delete(current); return n })
      await loadFile(current)
      setSaveResult({ ok: true, msg: t('prompts.reverted') })
    } catch (e: unknown) {
      setSaveResult({ ok: false, msg: `❌ ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  async function handleSaveAssignment() {
    setAssignResult(null)
    try {
      await saveConfig(assignment as Record<string, string>)
      setAssignResult({ ok: true, msg: '✅ Saved' })
    } catch (e: unknown) {
      setAssignResult({ ok: false, msg: `❌ ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  async function handleCreate() {
    let name = newFileName.trim()
    if (!name) { setNewFileResult({ ok: false, msg: t('prompts.err.no_filename') }); return }
    if (!name.endsWith('.txt')) name += '.txt'
    try {
      await savePrompt(name, '# Write your prompt here\n')
      setShowNewForm(false)
      setNewFileName('')
      setNewFileResult(null)
      await loadFiles(name)
    } catch (e: unknown) {
      setNewFileResult({ ok: false, msg: `❌ ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div className="flex flex-col h-full p-5 gap-4 min-w-0">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">{t('header.title.prompts')}</h1>
        <p className="text-sm text-[#64748b]">{t('header.subtitle.prompts')}</p>
      </div>

      {/* Assignment card */}
      <div className="bg-[#1e2330] border border-[#2d3748] rounded-xl p-5">
        <div className="flex items-baseline gap-2 mb-4">
          <h3 className="text-sm font-bold text-[#e2e8f0]">{t('prompts.card.assignment')}</h3>
          <span className="text-xs text-[#475569]">{t('prompts.assign_info')}</span>
        </div>
        <div className="flex flex-col gap-2 mb-4">
          {ASSIGN_KEYS.map(k => (
            <div key={k.id} className="flex items-center gap-3">
              <label className="w-40 shrink-0 text-xs text-[#94a3b8]">{k.label}</label>
              <select
                value={assignment[k.id] ?? k.default}
                onChange={e => setAssignment(a => ({ ...a, [k.id]: e.target.value }))}
                className="flex-1 bg-[#0b0e14] border border-[#2d3748] rounded text-sm text-[#e2e8f0] px-2 py-1.5 outline-none focus:border-[#6366f1] transition-colors cursor-pointer"
              >
                {files.map(f => (
                  <option key={f} value={f}>{(FILE_LABELS[f] ?? f) + '  (' + f + ')'}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSaveAssignment} className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white transition-colors">
            {t('prompts.btn.save_assign')}
          </button>
          {assignResult && <Badge label={assignResult.msg} ok={assignResult.ok} />}
        </div>
      </div>

      {/* Tab row */}
      <div>
        <div className="flex items-end gap-1 flex-wrap -mb-px">
          <div className="flex gap-1 flex-wrap flex-1">
            {files.map(f => (
              <button
                key={f}
                onClick={() => switchTo(f)}
                className={`px-4 py-2 rounded-t-lg border text-xs font-mono transition-colors ${f === current
                  ? 'bg-[#1e2330] text-[#a5b4fc] border-[#2d3748] border-b-[#1e2330]'
                  : 'bg-[#131720] text-[#64748b] border-[#2d3748] hover:bg-[#1e2330] hover:text-[#cbd5e1]'
                  }`}
              >
                {FILE_LABELS[f] ?? ('📄 ' + f.replace(/\.txt$/, ''))}                {custom.has(f) && <span className="ml-1 text-[10px] opacity-60">✎</span>}              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNewForm(v => !v)}
            className="px-3 py-1.5 mb-px text-xs font-semibold rounded-lg bg-[#14532d] text-[#86efac] hover:bg-[#166534] transition-colors"
          >
            {t('prompts.btn.new')}
          </button>
        </div>

        {/* New file form */}
        {showNewForm && (
          <div className="flex items-center gap-2 flex-wrap px-3 py-2.5 bg-[#131720] border border-[#2d3748] border-t-0 rounded-b-lg mb-2">
            <span className="text-xs text-[#94a3b8]">{t('prompts.label.filename')}</span>
            <input
              autoFocus
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowNewForm(false); setNewFileName('') } }}
              placeholder="my_prompt.txt"
              className="flex-1 max-w-xs bg-[#0b0e14] border border-[#2d3748] rounded px-2 py-1.5 text-xs text-[#e2e8f0] font-mono outline-none focus:border-[#6366f1] transition-colors"
            />
            <button onClick={handleCreate} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white transition-colors">{t('prompts.btn.create')}</button>
            <button onClick={() => { setShowNewForm(false); setNewFileName(''); setNewFileResult(null) }} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#334155] hover:bg-[#475569] text-white transition-colors">{t('prompts.btn.cancel')}</button>
            {newFileResult && <Badge label={newFileResult.msg} ok={newFileResult.ok} />}
          </div>
        )}

        {/* Editor */}
        <div className="bg-[#1e2330] border border-[#2d3748] rounded-b-xl rounded-tr-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-mono text-[#94a3b8]">{current ?? '—'}</span>
            <span className="text-xs text-[#475569]">
              {t('prompts.editor_hint')}
            </span>
          </div>
          <textarea
            className={editorCls}
            value={content}
            disabled={loading}
            onChange={e => setContent(e.target.value)}
            spellCheck={false}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleSave} disabled={saving || loading} className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {saving ? '…' : `${t('prompts.btn.save')}`}
            </button>
            <button
              onClick={() => { if (!isDirty || confirm(t('prompts.confirm.discard'))) { if (current) loadFile(current) }; setSaveResult(null) }}
              className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-[#334155] hover:bg-[#475569] text-white transition-colors"
            >
              {t('prompts.btn.reset')}
            </button>
            {current && DEFAULT_FILES.has(current) && custom.has(current) && (
              <button onClick={handleRevert} className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-[#78350f] hover:bg-[#92400e] text-white transition-colors">
                {t('prompts.btn.revert')}
              </button>
            )}
            {current && !DEFAULT_FILES.has(current) && (
              <button onClick={handleDelete} className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-[#7f1d1d] hover:bg-[#991b1b] text-white transition-colors">
                {t('prompts.btn.delete')}
              </button>
            )}
            {saveResult && <Badge label={saveResult.msg} ok={saveResult.ok} />}
            <span className="ml-auto text-xs text-[#475569]">{content.length} chars</span>
          </div>
        </div>
      </div>
    </div>
  )
}

