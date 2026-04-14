import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useI18n } from '../../../i18n/useI18n'
import { listPrompts, getPrompt, savePrompt, deletePrompt } from '../api'
import { getConfig, saveConfig } from '../../settings/api'
import { getMe } from '../../auth/api'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { Select } from '../../../components/common/Select'
import { useConfirmDiscard } from '../../../hooks/useConfirmDiscard'
import toast from 'react-hot-toast'
import type { Config } from '../../../types'

const DEFAULT_FILES = new Set([
  'gmail/email_analysis.txt',
  'gmail/email_summary.txt',
  'gmail/telegram_notify.txt',
  'outgoing/email_compose.txt',
  'outgoing/email_edit.txt',
  'outgoing/email_reply_compose.txt',
  'chat.txt',
  'user_profile.txt',
])

const ASSIGN_KEYS = [
  { id: 'PROMPT_ANALYZE', label: 'Email Analysis', default: 'gmail/email_analysis.txt' },
  { id: 'PROMPT_SUMMARY', label: 'Email Summary', default: 'gmail/email_summary.txt' },
  { id: 'PROMPT_TELEGRAM', label: 'Telegram Format', default: 'gmail/telegram_notify.txt' },
  { id: 'PROMPT_CHAT', label: 'Bot Chat', default: 'chat.txt' },
  { id: 'PROMPT_PROFILE', label: 'User Profile', default: 'user_profile.txt' },
  { id: 'OUTGOING/EMAIL_COMPOSE', label: 'Outgoing Email', default: 'outgoing/email_compose.txt' },
  { id: 'OUTGOING/EMAIL_EDIT', label: 'Email Edit', default: 'outgoing/email_edit.txt' },
  { id: 'OUTGOING/EMAIL_REPLY_COMPOSE', label: 'Email Reply Compose', default: 'outgoing/email_reply_compose.txt' },
] as const

const USER_FILE_LABELS: Record<string, string> = {
  'chat.txt': '🤖 Chat',
}

const ADMIN_FILE_LABELS: Record<string, string> = {
  'gmail/email_analysis.txt': '📊 Analyze',
  'gmail/email_summary.txt': '📝 Summary',
  'gmail/telegram_notify.txt': '✈️ Telegram',
  'chat.txt': '🤖 Chat',
  'user_profile.txt': '👤 Profile',
  'outgoing/email_compose.txt': '✉️ Outgoing Compose',
  'outgoing/email_edit.txt': '🛠️ Outgoing Edit',
  'outgoing/email_reply_compose.txt': '↩️ Outgoing Reply',
}

export const PromptsPage: React.FC = () => {
  const { t } = useI18n()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: 120_000 })
  const [files, setFiles] = useState<string[]>([])
  const [custom, setCustom] = useState<Set<string>>(new Set())
  const [current, setCurrent] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assignment, setAssignment] = useState<Record<string, string>>({})
  const [assigning, setAssigning] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [creating, setCreating] = useState(false)

  const isDirty = content !== savedContent
  useConfirmDiscard(isDirty, t('prompts.confirm.discard'))

  const isAdmin = me?.role === 'admin'
  const fileLabels = isAdmin ? ADMIN_FILE_LABELS : USER_FILE_LABELS
  const allowedSet = new Set(Object.keys(USER_FILE_LABELS))
  const canEditCurrent = !!current && (isAdmin || allowedSet.has(current))

  async function loadFiles(target?: string) {
    try {
      const d = await listPrompts()
      const visible = isAdmin ? d.files : d.files.filter(f => allowedSet.has(f))
      const visibleSet = new Set(visible)
      setFiles(visible)
      setCustom(new Set((d.custom ?? []).filter(f => visibleSet.has(f))))
      const sel = (target && visible.includes(target)) ? target : visible[0]
      if (sel) switchTo(sel, visible)
    } catch { /* ignore */ }
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
  }

  useEffect(() => {
    if (!me) return
    loadFiles()
    if (!isAdmin) return
    getConfig()
      .then(cfg => {
        const asgn: Record<string, string> = {}
        const cfgMap = cfg as unknown as Record<string, unknown>
        for (const k of ASSIGN_KEYS) {
          const v = cfgMap[k.id]
          asgn[k.id] = typeof v === 'string' ? v : k.default
        }
        setAssignment(asgn)
      })
      .catch(() => {})
  }, [me, isAdmin])

  async function handleSave() {
    if (!current) return
    if (!canEditCurrent) return
    setSaving(true)
    try {
      await savePrompt(current, content)
      setSavedContent(content)
      setCustom(prev => new Set([...prev, current]))
      toast.success(t('prompts.saved'))
    } catch {
      /* handled globally */
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!current) return
    if (!canEditCurrent) return
    if (!confirm(t('prompts.confirm.delete').replace('{file}', current))) return
    try {
      await deletePrompt(current)
      setSavedContent('')
      setCurrent(null)
      setCustom(prev => { const n = new Set(prev); n.delete(current); return n })
      await loadFiles(files.find(f => DEFAULT_FILES.has(f)))
      toast.success(t('prompts.deleted'))
    } catch {
      /* handled globally */
      /* ignore error since file might be already deleted */
    }
  }

  async function handleRevert() {
    if (!current) return
    if (!canEditCurrent) return
    if (!confirm(t('prompts.confirm.revert'))) return
    try {
      await deletePrompt(current)
      setCustom(prev => { const n = new Set(prev); n.delete(current); return n })
      await loadFile(current)
      toast.success(t('prompts.reverted'))
    } catch {
      /* handled globally */
    }
  }

  async function handleSaveAssignment() {
    if (!isAdmin) return
    setAssigning(true)
    try {
      const payload = assignment as unknown as Partial<Config>
      await saveConfig(payload)
      toast.success(t('result.saved'))
    } catch {
      /* handled globally */
    } finally {
      setAssigning(false)
    }
  }

  async function handleCreate() {
    if (!isAdmin) return
    let name = newFileName.trim()
    if (!name) { toast.error(t('prompts.err.no_filename')); return }
    if (!name.endsWith('.txt')) name += '.txt'
    setCreating(true)
    try {
      await savePrompt(name, '# Write your prompt here\n')
      setShowNewForm(false)
      setNewFileName('')
      await loadFiles(name)
      toast.success(t('prompts.created'))
    } catch {
      /* handled globally */
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div className="flex flex-col h-full p-5 gap-6 min-w-0 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('header.title.prompts')}</h1>
        <p className="text-sm text-[#64748b] mt-1">{t('header.subtitle.prompts')}</p>
      </div>

      {isAdmin && (
        <Card title={t('prompts.card.assignment')}>
          <p className="text-xs text-[#64748b] -mt-2 mb-4">{t('prompts.assign_info')}</p>
          <div className="flex flex-col gap-4">
            {ASSIGN_KEYS.map(k => (
              <div key={k.id} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-3">
                <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">{k.label}</label>
                <Select
                  value={files.includes(assignment[k.id] ?? '') ? (assignment[k.id] as string) : k.default}
                  onChange={e => setAssignment(a => ({ ...a, [k.id]: e.target.value }))}
                  options={files.map(f => ({ label: `${ADMIN_FILE_LABELS[f] ?? f} (${f})`, value: f }))}
                />
              </div>
            ))}
            <Button onClick={handleSaveAssignment} loading={assigning} className="self-start px-8">
              {t('prompts.btn.save_assign')}
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-0">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-wrap gap-1">
            {files.map(f => (
              <button
                key={f}
                onClick={() => switchTo(f)}
                className={`px-4 py-2 text-xs font-mono transition-all rounded-t-lg border-x border-t ${f === current
                  ? 'bg-[#1e2330] text-[#60a5fa] border-[#2d3748] font-bold'
                  : 'bg-[#0f172a] text-[#64748b] border-transparent hover:text-[#94a3b8]'
                  }`}
              >
                {fileLabels[f] ?? f.replace(/\.txt$/, '')}
                {custom.has(f) && <span className="ml-1 text-[10px] text-[#fbbf24]">●</span>}
              </button>
            ))}
          </div>
          {isAdmin && (
            <Button 
              onClick={() => setShowNewForm(v => !v)} 
              variant="primary" 
              className="bg-[#14532d] hover:bg-[#166534] text-[#86efac] text-xs px-3 py-1.5 mb-1"
            >
              {t('prompts.btn.new')}
            </Button>
          )}
        </div>

        {isAdmin && showNewForm && (
          <div className="flex items-center gap-3 p-4 bg-[#0b0e14] border border-[#2d3748] rounded-b-lg mb-4 animate-in slide-in-from-top-2 duration-200">
            <InputField
              autoFocus
              label={t('prompts.label.filename')}
              value={newFileName}
              onChange={v => setNewFileName(v)}
              placeholder="my_prompt.txt"
              className="flex-1 font-mono"
            />
            <div className="flex items-end gap-2 h-full">
              <Button onClick={handleCreate} loading={creating}>{t('prompts.btn.create')}</Button>
              <Button variant="primary" className="bg-[#334155] text-white" onClick={() => { setShowNewForm(false); setNewFileName('') }}>{t('prompts.btn.cancel')}</Button>
            </div>
          </div>
        )}

        <div className="bg-[#1e2330] border border-[#2d3748] rounded-b-xl rounded-tr-xl p-5 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center gap-3 flex-wrap text-[10px] text-[#475569] uppercase tracking-widest font-bold">
            <span>{current ?? '—'}</span>
            {current && custom.has(current) && (
              <span className="px-2 py-0.5 rounded border border-[#2d3748] bg-[#0b0e14] text-[#fbbf24]">custom</span>
            )}
            {isDirty && (
              <span className="px-2 py-0.5 rounded border border-[#2d3748] bg-[#0b0e14] text-[#60a5fa]">unsaved</span>
            )}
            {!canEditCurrent && (
              <span className="px-2 py-0.5 rounded border border-[#2d3748] bg-[#0b0e14] text-[#94a3b8]">read only</span>
            )}
            <span className="ml-auto">{t('prompts.editor_hint')}</span>
          </div>
          
          <textarea
            className="w-full min-h-[500px] bg-[#0b0e14] border border-[#2d3748] rounded-lg p-4 text-sm text-[#e2e8f0] font-mono leading-relaxed resize-y outline-none focus:border-[#6366f1] transition-colors tab-size-2"
            value={content}
            disabled={loading || !canEditCurrent}
            onChange={e => setContent(e.target.value)}
            spellCheck={false}
          />

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSave} loading={saving} disabled={loading || !isDirty || !canEditCurrent} className="px-8">
              {t('prompts.btn.save')}
            </Button>
            <Button
              variant="primary"
              className="bg-[#334155] text-[#94a3b8] px-6"
              onClick={() => { if (!isDirty || confirm(t('prompts.confirm.discard'))) { if (current) loadFile(current) } }}
              disabled={loading || !isDirty || !canEditCurrent}
            >
              {t('prompts.btn.reset')}
            </Button>
            
            <div className="ml-auto flex items-center gap-3">
              {canEditCurrent && current && DEFAULT_FILES.has(current) && custom.has(current) && (
                <Button variant="primary" className="bg-[#78350f] hover:bg-[#92400e] text-[#fcd34d] px-4" onClick={handleRevert}>
                  {t('prompts.btn.revert')}
                </Button>
              )}
              {canEditCurrent && current && !DEFAULT_FILES.has(current) && (
                <Button variant="primary" className="bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5] px-4" onClick={handleDelete}>
                  {t('prompts.btn.delete')}
                </Button>
              )}
              <span className="text-xs font-mono text-[#475569]">{content.length} chars</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
