import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../i18n/useI18n'
import {
  listUsers, updateUser, listBots, createBot, updateBot, deleteBot, setDefaultBot, createUser,
} from '../api'
import type { User, Bot } from '../api'

const inputCls =
    'bg-[#0b0e14] border border-[#2d3748] rounded-md px-2.5 py-1.5 text-sm text-[#e2e8f0] outline-none focus:border-[#6366f1] transition-colors'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-[#1e2330] border border-[#2d3748] rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-[#cbd5e1]">{title}</h2>
            {children}
        </div>
    )
}

// ── Bot row form ─────────────────────────────────────────────────

interface BotRowProps {
    bot: Bot
    userId: number
}

function BotRow({ bot, userId }: BotRowProps) {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({ name: bot.name, token: bot.token, chat_id: bot.chat_id })

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
                <input
                    placeholder={t('users.bot.name')}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className={`${inputCls} w-full`}
                />
                <input
                    placeholder={t('users.bot.token')}
                    value={form.token}
                    onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                    className={`${inputCls} w-full font-mono text-xs`}
                />
                <input
                    placeholder={t('users.bot.chat_id')}
                    value={form.chat_id}
                    onChange={e => setForm(f => ({ ...f, chat_id: e.target.value }))}
                    className={`${inputCls} w-full`}
                />
                <div className="flex gap-2">
                    <button
                        onClick={() => doUpdate.mutate()}
                        disabled={doUpdate.isPending}
                        className="px-3 py-1 text-xs font-semibold rounded bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-50 transition-colors"
                    >
                        {t('users.btn.save')}
                    </button>
                    <button
                        onClick={() => setEditing(false)}
                        className="px-3 py-1 text-xs font-semibold rounded bg-[#334155] hover:bg-[#475569] text-white transition-colors"
                    >
                        {t('users.btn.cancel')}
                    </button>
                </div>
                {doUpdate.isError && (
                    <p className="text-xs text-[#fca5a5]">
                        {(doUpdate.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '❌'}
                    </p>
                )}
            </div>
        )
    }

    return (
        <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm text-[#e2e8f0] font-medium flex items-center gap-2">
                    {bot.name}
                    {bot.is_default && (
                        <span className="text-xs bg-[#1d4ed8] text-white px-1.5 py-0 rounded">{t('users.bot.default')}</span>
                    )}
                </span>
                <span className="text-xs text-[#64748b] font-mono truncate">{bot.chat_id}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {!bot.is_default && (
                    <button
                        onClick={() => doDefault.mutate()}
                        disabled={doDefault.isPending}
                        className="px-2 py-1 text-xs rounded bg-[#334155] hover:bg-[#475569] text-[#94a3b8] disabled:opacity-50 transition-colors"
                    >
                        {t('users.bot.btn.set_default')}
                    </button>
                )}
                <button
                    onClick={() => setEditing(true)}
                    className="px-2 py-1 text-xs rounded bg-[#334155] hover:bg-[#475569] text-[#94a3b8] transition-colors"
                >
                    {t('users.btn.edit')}
                </button>
                <button
                    onClick={() => {
                        if (confirm(t('users.bot.confirm_delete'))) doDelete.mutate()
                    }}
                    disabled={doDelete.isPending}
                    className="px-2 py-1 text-xs rounded bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5] disabled:opacity-50 transition-colors"
                >
                    {t('users.bot.btn.delete')}
                </button>
            </div>
        </div>
    )
}

// ── Add-bot form ─────────────────────────────────────────────────

function AddBotForm({ userId, onDone }: { userId: number; onDone: () => void }) {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [form, setForm] = useState({ name: '', token: '', chat_id: '' })

    const doCreate = useMutation({
        mutationFn: () => createBot(userId, form),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['bots', userId] }); onDone() },
    })

    return (
        <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-3 flex flex-col gap-2">
            <input
                placeholder={t('users.bot.name')}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={`${inputCls} w-full`}
            />
            <input
                placeholder={t('users.bot.token')}
                value={form.token}
                onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                className={`${inputCls} w-full font-mono text-xs`}
            />
            <input
                placeholder={t('users.bot.chat_id')}
                value={form.chat_id}
                onChange={e => setForm(f => ({ ...f, chat_id: e.target.value }))}
                className={`${inputCls} w-full`}
            />
            <div className="flex gap-2">
                <button
                    onClick={() => doCreate.mutate()}
                    disabled={doCreate.isPending || !form.name || !form.token || !form.chat_id}
                    className="px-3 py-1 text-xs font-semibold rounded bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-50 transition-colors"
                >
                    {t('users.bot.btn.add')}
                </button>
                <button
                    onClick={onDone}
                    className="px-3 py-1 text-xs font-semibold rounded bg-[#334155] hover:bg-[#475569] text-white transition-colors"
                >
                    {t('users.btn.cancel')}
                </button>
            </div>
            {doCreate.isError && (
                <p className="text-xs text-[#fca5a5]">
                    {(doCreate.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '❌'}
                </p>
            )}
        </div>
    )
}

// ── Single user panel ────────────────────────────────────────────

interface UserPanelProps {
    user: User
}

function UserPanel({ user }: UserPanelProps) {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [open, setOpen] = useState(false)
    const [addingBot, setAddingBot] = useState(false)
    const [settingsForm, setSettingsForm] = useState({
        worker_enabled: user.worker_enabled,
    })
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const { data: bots, isLoading: botsLoading } = useQuery({
        queryKey: ['bots', user.id],
        queryFn: () => listBots(user.id),
        enabled: open,
    })

    async function handleSave() {
        setSaving(true)
        setSaved(false)
        try {
            await updateUser(user.id, settingsForm)
            qc.invalidateQueries({ queryKey: ['users'] })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-[#1a2235] border border-[#2d3748] rounded-xl overflow-hidden">
            {/* Header row */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#1e293b] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#334155] flex items-center justify-center text-sm font-semibold text-[#94a3b8]">
                        {user.email[0].toUpperCase()}
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-medium text-[#e2e8f0]">{user.email}</div>
                        <div className="text-xs text-[#64748b]">
                            {user.role}
                            {user.worker_enabled && <span className="ml-2 text-[#86efac]">● {t('users.enabled')}</span>}
                        </div>
                    </div>
                </div>
                <span className="text-[#64748b] text-xs">{open ? '▾' : '▸'}</span>
            </button>

            {/* Expanded panel */}
            {open && (
                <div className="border-t border-[#2d3748] px-5 py-4 flex flex-col gap-5">
                    {/* Settings */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">{t('users.section.settings')}</h3>
                        <label className="flex items-center gap-2 text-sm text-[#94a3b8]">
                            <input
                                type="checkbox"
                                checked={settingsForm.worker_enabled}
                                onChange={e => setSettingsForm(f => ({ ...f, worker_enabled: e.target.checked }))}
                                className="accent-[#3b82f6]"
                            />
                            {t('users.enabled')}
                        </label>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-50 transition-colors"
                            >
                                {saving ? '…' : t('users.btn.save')}
                            </button>
                            {saved && <span className="text-xs text-[#86efac]">✅ {t('users.saved')}</span>}
                        </div>
                    </div>

                    {/* Bots */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">{t('users.section.bots')}</h3>
                        {botsLoading ? (
                            <p className="text-xs text-[#64748b]">{t('prompts.loading')}</p>
                        ) : bots && bots.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {bots.map(bot => <BotRow key={bot.id} bot={bot} userId={user.id} />)}
                            </div>
                        ) : (
                            <p className="text-xs text-[#64748b]">{t('users.bots.empty')}</p>
                        )}
                        {addingBot ? (
                            <AddBotForm userId={user.id} onDone={() => setAddingBot(false)} />
                        ) : (
                            <button
                                onClick={() => setAddingBot(true)}
                                className="self-start px-3 py-1 text-xs font-semibold rounded bg-[#334155] hover:bg-[#475569] text-[#94a3b8] transition-colors"
                            >
                                ＋ {t('users.bot.btn.add')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Add User form ─────────────────────────────────────────────────

function AddUserForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [form, setForm] = useState({ email: '', password: '', display_name: '' })

  const doCreate = useMutation({
    mutationFn: () => createUser(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onDone() },
  })

  const canSubmit = form.email.includes('@') && form.password.length >= 4

  return (
    <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-4 flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">{t('users.add.title')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#94a3b8]">{t('users.email')}</label>
          <input
            type="email"
            placeholder="user@example.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className={`${inputCls} w-full`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#94a3b8]">{t('users.add.display_name')}</label>
          <input
            type="text"
            placeholder={t('users.add.display_name_hint')}
            value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            className={`${inputCls} w-full`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#94a3b8]">{t('login.password')}</label>
          <input
            type="password"
            placeholder="至少4个字符"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className={`${inputCls} w-full`}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => doCreate.mutate()}
          disabled={doCreate.isPending || !canSubmit}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {doCreate.isPending ? '…' : t('users.add.confirm')}
        </button>
        <button
          onClick={onDone}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#334155] hover:bg-[#475569] text-white transition-colors"
        >
          {t('users.btn.cancel')}
        </button>
        {doCreate.isError && (
          <span className="text-xs text-[#fca5a5]">
            {(doCreate.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '❌'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────

export default function Users() {
  const { t } = useI18n()
  const [addingUser, setAddingUser] = useState(false)

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  })

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#e2e8f0]">{t('users.title')}</h1>
        {!addingUser && (
          <button
            onClick={() => setAddingUser(true)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white transition-colors"
          >
            ＋ {t('users.add.title')}
          </button>
        )}
      </div>

      {addingUser && <AddUserForm onDone={() => setAddingUser(false)} />}

      <Card title={t('users.list.title')}>
        {isLoading && <p className="text-xs text-[#64748b]">{t('prompts.loading')}</p>}
        {isError && <p className="text-xs text-[#fca5a5]">❌ {t('users.err.load')}</p>}
        {users && (
          <div className="flex flex-col gap-3">
            {users.map(user => <UserPanel key={user.id} user={user} />)}
          </div>
        )}
      </Card>
    </div>
  )
}
