import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
])

const ASSIGN_KEYS = [
  { id: 'PROMPT_ANALYZE', label: 'Email Analysis', default: 'gmail/email_analysis.txt' },
  { id: 'PROMPT_SUMMARY', label: 'Email Summary', default: 'gmail/email_summary.txt' },
  { id: 'PROMPT_TELEGRAM', label: 'Telegram Format', default: 'gmail/telegram_notify.txt' },
  { id: 'OUTGOING/EMAIL_COMPOSE', label: 'Outgoing Email', default: 'outgoing/email_compose.txt' },
  { id: 'OUTGOING/EMAIL_EDIT', label: 'Email Edit', default: 'outgoing/email_edit.txt' },
  { id: 'OUTGOING/EMAIL_REPLY_COMPOSE', label: 'Email Reply Compose', default: 'outgoing/email_reply_compose.txt' },
] as const

const USER_FILE_LABELS: Record<string, string> = {}

const ADMIN_FILE_LABELS: Record<string, string> = {
  'gmail/email_analysis.txt': '📊 Analyze',
  'gmail/email_summary.txt': '📝 Summary',
  'gmail/telegram_notify.txt': '✈️ Telegram',
  'outgoing/email_compose.txt': '✉️ Outgoing Compose',
  'outgoing/email_edit.txt': '🛠️ Outgoing Edit',
  'outgoing/email_reply_compose.txt': '↩️ Outgoing Reply',
}

function statusPillClass(kind: 'custom' | 'unsaved' | 'readonly') {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase border backdrop-blur-md'
  switch (kind) {
    case 'custom':
      return `${base} bg-[rgba(255,248,220,0.72)] text-amber-700 border-white/80 ring-1 ring-black/[0.03]`
    case 'unsaved':
      return `${base} bg-[rgba(217,235,255,0.82)] text-[#0b3c5d] border-white/80 ring-1 ring-black/[0.03]`
    case 'readonly':
      return `${base} bg-white/70 text-slate-500 border-white/80 ring-1 ring-black/[0.03]`
  }
}

function getTabLabel(
  file: string,
  fileLabels: Record<string, string>
) {
  return fileLabels[file] ?? file.replace(/\.txt$/, '')
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
  const allowedSet = useMemo(() => new Set(Object.keys(USER_FILE_LABELS)), [])
  const canEditCurrent = !!current && (isAdmin || allowedSet.has(current))

  const currentRef = useRef<string | null>(null)
  const isDirtyRef = useRef(false)

  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  const loadFile = useCallback(async (filename: string) => {
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
  }, [])

  const switchTo = useCallback((filename: string, fileList?: string[]) => {
    const list = fileList ?? files
    if (!list.includes(filename)) return
    if (filename === current) return
    if (isDirty && !confirm(t('prompts.confirm.discard'))) return
    loadFile(filename)
  }, [current, files, isDirty, loadFile, t])

  const refreshFiles = useCallback(async (target?: string) => {
    try {
      const d = await listPrompts()
      const visible = isAdmin ? d.files : d.files.filter(f => allowedSet.has(f))
      const visibleSet = new Set(visible)

      setFiles(visible)
      setCustom(new Set((d.custom ?? []).filter(f => visibleSet.has(f))))

      const prev = currentRef.current
      const sel =
        (target && visible.includes(target))
          ? target
          : (prev && visible.includes(prev))
            ? prev
            : (visible[0] ?? null)

      if (!sel) {
        setCurrent(null)
        setContent('')
        setSavedContent('')
        return
      }

      if (prev && sel !== prev && isDirtyRef.current && visible.includes(prev)) {
        return
      }

      if (sel !== prev) {
        loadFile(sel)
      }
    } catch {
      // ignore
    }
  }, [allowedSet, isAdmin, loadFile])

  useEffect(() => {
    if (!me) return

    refreshFiles()

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
  }, [isAdmin, me, refreshFiles])

  const handleSave = useCallback(async () => {
    if (!current) return
    if (!canEditCurrent) return

    setSaving(true)
    try {
      await savePrompt(current, content)
      setSavedContent(content)
      setCustom(prev => new Set([...prev, current]))
      toast.success(t('prompts.saved'))
    } finally {
      setSaving(false)
    }
  }, [canEditCurrent, content, current, t])

  async function handleDelete() {
    if (!current) return
    if (!canEditCurrent) return
    if (!confirm(t('prompts.confirm.delete').replace('{file}', current))) return

    try {
      await deletePrompt(current)
      setSavedContent('')
      setCurrent(null)
      setCustom(prev => {
        const n = new Set(prev)
        n.delete(current)
        return n
      })
      await refreshFiles(files.find(f => DEFAULT_FILES.has(f)))
      toast.success(t('prompts.deleted'))
    } catch {
      // ignore
    }
  }

  async function handleRevert() {
    if (!current) return
    if (!canEditCurrent) return
    if (!confirm(t('prompts.confirm.revert'))) return

    try {
      await deletePrompt(current)
      setCustom(prev => {
        const n = new Set(prev)
        n.delete(current)
        return n
      })
      await loadFile(current)
      toast.success(t('prompts.reverted'))
    } catch {
      // ignore
    }
  }

  async function handleSaveAssignment() {
    if (!isAdmin) return

    setAssigning(true)
    try {
      const payload = assignment as unknown as Partial<Config>
      await saveConfig(payload)
      toast.success(t('result.saved'))
    } finally {
      setAssigning(false)
    }
  }

  async function handleCreate() {
    if (!isAdmin) return

    let name = newFileName.trim()
    if (!name) {
      toast.error(t('prompts.err.no_filename'))
      return
    }

    if (!name.endsWith('.txt')) name += '.txt'

    setCreating(true)
    try {
      await savePrompt(name, '# Write your prompt here\n')
      setShowNewForm(false)
      setNewFileName('')
      await refreshFiles(name)
      toast.success(t('prompts.created'))
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const currentCharCount = content.length

  return (
    <div className="relative min-w-0 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.42),transparent_72%)]" />

      <div className="relative flex flex-col gap-6">
        <header className="rounded-[28px] border border-white/80 bg-[rgba(255,255,255,0.7)] backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] p-6 sm:p-7">
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center rounded-full border border-white/80 bg-white/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 ring-1 ring-black/[0.03]">
              Prompt Studio
            </div>
            <div>
              <h1 className="text-[28px] sm:text-[32px] leading-tight font-semibold tracking-[-0.03em] text-slate-900">
                {t('header.title.prompts')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {t('header.subtitle.prompts')}
              </p>
            </div>
          </div>
        </header>

        {isAdmin && (
          <Card title={t('prompts.card.assignment')} subtitle={t('prompts.assign_info')}>
            <div className="mt-1 grid grid-cols-1 gap-4">
              {ASSIGN_KEYS.map(k => (
                <div
                  key={k.id}
                  className="rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl ring-1 ring-black/[0.03] p-4"
                >
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {k.label}
                  </div>

                  <Select
                    value={files.includes(assignment[k.id] ?? '') ? (assignment[k.id] as string) : k.default}
                    onChange={e => setAssignment(a => ({ ...a, [k.id]: e.target.value }))}
                    options={files.map(f => ({
                      label: `${ADMIN_FILE_LABELS[f] ?? f} (${f})`,
                      value: f,
                    }))}
                  />
                </div>
              ))}

              <div className="pt-1">
                <Button onClick={handleSaveAssignment} loading={assigning} className="px-6">
                  {t('prompts.btn.save_assign')}
                </Button>
              </div>
            </div>
          </Card>
        )}

        <section className="rounded-[30px] border border-white/80 bg-[rgba(255,255,255,0.78)] backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] overflow-hidden">
          <div className="border-b border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,255,255,0.08)_50%,transparent)] px-4 sm:px-5 py-4">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="flex min-w-0 flex-wrap gap-2">
                {files.map(f => {
                  const active = f === current

                  return (
                    <button
                      key={f}
                      onClick={() => switchTo(f)}
                      className={[
                        'group inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200',
                        'border ring-1 ring-black/[0.03] backdrop-blur-md whitespace-nowrap',
                        active
                          ? 'bg-[rgba(217,235,255,0.88)] text-[#0b3c5d] border-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.04)]'
                          : 'bg-white/60 text-slate-600 border-white/70 hover:bg-white/80 hover:text-slate-900',
                      ].join(' ')}
                    >
                      <span>{getTabLabel(f, fileLabels)}</span>
                      {custom.has(f) && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>
                  )
                })}
              </div>

              {isAdmin && (
                <Button
                  onClick={() => setShowNewForm(v => !v)}
                  className="px-4"
                >
                  {t('prompts.btn.new')}
                </Button>
              )}
            </div>

            {isAdmin && showNewForm && (
              <div className="mt-4 rounded-[22px] border border-white/80 bg-white/68 backdrop-blur-xl ring-1 ring-black/[0.03] p-4 sm:p-5">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                  <InputField
                    autoFocus
                    label={t('prompts.label.filename')}
                    value={newFileName}
                    onChange={v => setNewFileName(v)}
                    placeholder="my_prompt.txt"
                    className="font-mono"
                  />

                  <div className="flex items-center gap-2">
                    <Button onClick={handleCreate} loading={creating}>
                      {t('prompts.btn.create')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowNewForm(false)
                        setNewFileName('')
                      }}
                    >
                      {t('prompts.btn.cancel')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 lg:p-6">
            <div className="rounded-[26px] border border-white/80 bg-[rgba(255,255,255,0.62)] backdrop-blur-2xl ring-1 ring-black/[0.03] shadow-[0_8px_24px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-b border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.06)_55%,transparent)]">
                <div className="min-w-0 max-w-full truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {current ?? '—'}
                </div>

                {current && custom.has(current) && (
                  <span className={statusPillClass('custom')}>custom</span>
                )}

                {isDirty && (
                  <span className={statusPillClass('unsaved')}>unsaved</span>
                )}

                {!canEditCurrent && (
                  <span className={statusPillClass('readonly')}>read only</span>
                )}

                <div className="ml-auto text-[11px] text-slate-500">
                  {t('prompts.editor_hint')}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <textarea
                  className={[
                    'w-full min-h-[360px] sm:min-h-[560px] resize-y rounded-[22px] px-4 py-4',
                    'border border-white/80 bg-white/72 backdrop-blur-xl ring-1 ring-black/[0.03]',
                    'text-[13px] sm:text-sm leading-7 font-mono text-slate-800',
                    'outline-none transition-all duration-200',
                    'focus:border-white focus:ring-1 focus:ring-black/[0.04] focus:bg-white/82',
                    'placeholder:text-slate-400',
                  ].join(' ')}
                  value={content}
                  disabled={loading || !canEditCurrent}
                  onChange={e => setContent(e.target.value)}
                  spellCheck={false}
                />

                <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                  <Button
                    onClick={handleSave}
                    loading={saving}
                    disabled={loading || !isDirty || !canEditCurrent}
                    className="px-6"
                  >
                    {t('prompts.btn.save')}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!isDirty || confirm(t('prompts.confirm.discard'))) {
                        if (current) loadFile(current)
                      }
                    }}
                    disabled={loading || !isDirty || !canEditCurrent}
                  >
                    {t('prompts.btn.reset')}
                  </Button>

                  <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
                    {canEditCurrent && current && DEFAULT_FILES.has(current) && custom.has(current) && (
                      <Button variant="secondary" onClick={handleRevert}>
                        {t('prompts.btn.revert')}
                      </Button>
                    )}

                    {canEditCurrent && current && !DEFAULT_FILES.has(current) && (
                      <Button variant="secondary" onClick={handleDelete}>
                        {t('prompts.btn.delete')}
                      </Button>
                    )}

                    <div className="rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-slate-500 ring-1 ring-black/[0.03]">
                      {currentCharCount} chars
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}