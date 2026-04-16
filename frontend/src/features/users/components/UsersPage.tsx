import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useI18n } from '../../../i18n/useI18n'
import {
  listUsers, updateUser, listBots, createBot, updateBot, deleteBot, setDefaultBot, createUser, getMe,
} from '../api'
import type { User, Bot } from '../../../types'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { Select } from '../../../components/common/Select'
import { Switch } from '../../../components/common/Switch'
import { FormInput } from '../../../components/common/form/FormInput'
import toast from 'react-hot-toast'

// ── Bot row form ─────────────────────────────────────────────────

const BotRow: React.FC<{ bot: Bot; userId: number }> = ({ bot, userId }) => {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({ name: bot.name, token: bot.token, chat_id: bot.chat_id, bot_mode: bot.bot_mode ?? 'all' })

    const key = ['bots', userId]

    const updateMut = useMutation({
        mutationFn: () => updateBot(userId, bot.id, form),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: key })
            setEditing(false)
            toast.success(t('result.saved'))
        },
    })

    const deleteMut = useMutation({
        mutationFn: () => deleteBot(userId, bot.id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: key })
            toast.success(t('chat.prompts.deleted'))
        },
    })

    const defaultMut = useMutation({
        mutationFn: () => setDefaultBot(userId, bot.id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: key })
            toast.success(t('users.bot.default'))
        },
    })

    if (editing) {
        return (
            <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-4 flex flex-col gap-3">
                <InputField
                    label={t('users.bot.name')}
                    value={form.name}
                    onChange={v => setForm(f => ({ ...f, name: v }))}
                />
                <InputField
                    label={t('users.bot.token')}
                    value={form.token}
                    onChange={v => setForm(f => ({ ...f, token: v }))}
                    className="font-mono text-xs"
                />
                <InputField
                    label={t('users.bot.chat_id')}
                    value={form.chat_id}
                    onChange={v => setForm(f => ({ ...f, chat_id: v }))}
                />
                <Select
                    label="Mode"
                    value={form.bot_mode}
                    onChange={e => setForm(f => ({ ...f, bot_mode: e.target.value }))}
                    options={[
                        { label: t('users.bot.mode.all'), value: 'all' },
                        { label: t('users.bot.mode.notify'), value: 'notify' },
                        { label: t('users.bot.mode.chat'), value: 'chat' },
                    ]}
                />
                <div className="flex gap-2">
                    <Button onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
                        {t('users.btn.save')}
                    </Button>
                    <Button variant="primary" className="bg-[#334155]" onClick={() => setEditing(false)}>
                        {t('users.btn.cancel')}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm text-[#e2e8f0] font-medium flex items-center gap-2">
                    {bot.name}
                    {bot.is_default && <span className="text-[10px] bg-[#1d4ed8] text-white px-1.5 py-0 rounded font-bold uppercase">{t('users.bot.default')}</span>}
                    {bot.bot_mode === 'notify' && <span className="text-[10px] bg-[#854d0e] text-[#fef08a] px-1.5 py-0 rounded font-bold uppercase">{t('users.bot.mode.notify')}</span>}
                    {bot.bot_mode === 'chat' && <span className="text-[10px] bg-[#312e81] text-[#c4b5fd] px-1.5 py-0 rounded font-bold uppercase">{t('users.bot.mode.chat')}</span>}
                </span>
                <span className="text-xs text-[#64748b] font-mono truncate">{bot.chat_id}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {!bot.is_default && (
                    <Button variant="primary" className="px-2 py-1 text-xs bg-[#334155] text-[#94a3b8]" onClick={() => defaultMut.mutate()} loading={defaultMut.isPending}>
                        {t('users.bot.btn.set_default')}
                    </Button>
                )}
                <Button variant="primary" className="px-2 py-1 text-xs bg-[#334155] text-[#94a3b8]" onClick={() => setEditing(true)}>
                    {t('users.btn.edit')}
                </Button>
                <Button variant="primary" className="px-2 py-1 text-xs bg-[#7f1d1d] hover:bg-[#991b1b] text-[#fca5a5]" onClick={() => {
                    if (confirm(t('users.bot.confirm_delete'))) deleteMut.mutate()
                }} loading={deleteMut.isPending}>
                    {t('users.bot.btn.delete')}
                </Button>
            </div>
        </div>
    )
}

// ── Add-bot form ─────────────────────────────────────────────────

const AddBotForm: React.FC<{ userId: number; onDone: () => void }> = ({ userId, onDone }) => {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [form, setForm] = useState({ name: '', token: '', chat_id: '', bot_mode: 'all' })

    const createMut = useMutation({
        mutationFn: () => createBot(userId, form),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ['bots', userId] })
            onDone()
            toast.success(t('users.bot.btn.add'))
        },
    })

    return (
        <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-4 flex flex-col gap-3">
            <InputField
                label={t('users.bot.name')}
                value={form.name}
                onChange={v => setForm(f => ({ ...f, name: v }))}
            />
            <InputField
                label={t('users.bot.token')}
                value={form.token}
                onChange={v => setForm(f => ({ ...f, token: v }))}
                className="font-mono text-xs"
            />
            <InputField
                label={t('users.bot.chat_id')}
                value={form.chat_id}
                onChange={v => setForm(f => ({ ...f, chat_id: v }))}
            />
            <Select
                label="Mode"
                value={form.bot_mode}
                onChange={e => setForm(f => ({ ...f, bot_mode: e.target.value }))}
                options={[
                    { label: t('users.bot.mode.all'), value: 'all' },
                    { label: t('users.bot.mode.notify'), value: 'notify' },
                    { label: t('users.bot.mode.chat'), value: 'chat' },
                ]}
            />
            <div className="flex gap-2">
                <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!form.name || !form.token || !form.chat_id}>
                    {t('users.bot.btn.add')}
                </Button>
                <Button variant="primary" className="bg-[#334155]" onClick={onDone}>
                    {t('users.btn.cancel')}
                </Button>
            </div>
        </div>
    )
}

// ── Single user panel ────────────────────────────────────────────

const UserPanel: React.FC<{ user: User }> = ({ user }) => {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [open, setOpen] = useState(false)
    const [addingBot, setAddingBot] = useState(false)
    const [workerEnabled, setWorkerEnabled] = useState(user.worker_enabled)
    const [saving, setSaving] = useState(false)

    const { data: bots, isLoading: botsLoading } = useQuery({
        queryKey: ['bots', user.id],
        queryFn: () => listBots(user.id),
        enabled: open,
    })

    async function handleSave() {
        setSaving(true)
        try {
            await updateUser(user.id, { worker_enabled: workerEnabled })
            qc.invalidateQueries({ queryKey: ['users'] })
            toast.success(t('result.saved'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-[#1a2235] border border-[#2d3748] rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#1e293b] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#334155] flex items-center justify-center text-sm font-bold text-[#94a3b8]">
                        {user.email[0].toUpperCase()}
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-semibold text-[#e2e8f0]">{user.email}</div>
                        <div className="text-xs text-[#64748b] mt-0.5 flex items-center gap-2">
                            <span className="uppercase">{user.role}</span>
                            {user.worker_enabled && <span className="text-[#22c55e]">● {t('users.enabled')}</span>}
                        </div>
                    </div>
                </div>
                <span className="text-[#64748b] transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>

            {open && (
                <div className="border-t border-[#2d3748] px-6 py-5 flex flex-col gap-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-[10px] font-bold text-[#475569] uppercase tracking-widest">{t('users.section.settings')}</h3>
                        <div className="flex items-center gap-4">
                            <Switch
                                label={t('users.enabled')}
                                checked={workerEnabled}
                                onChange={setWorkerEnabled}
                            />
                            <Button
                                onClick={handleSave}
                                loading={saving}
                                disabled={workerEnabled === user.worker_enabled}
                                className="px-6 py-1.5 text-xs"
                            >
                                {t('users.btn.save')}
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h3 className="text-[10px] font-bold text-[#475569] uppercase tracking-widest">{t('users.section.bots')}</h3>
                        {botsLoading ? (
                            <p className="text-xs text-[#64748b] py-2">{t('prompts.loading')}</p>
                        ) : bots && bots.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {bots.map(bot => <BotRow key={bot.id} bot={bot} userId={user.id} />)}
                            </div>
                        ) : (
                            <p className="text-xs text-[#64748b] py-2 italic">{t('users.bots.empty')}</p>
                        )}
                        {addingBot ? (
                            <AddBotForm userId={user.id} onDone={() => setAddingBot(false)} />
                        ) : (
                            <Button
                                onClick={() => setAddingBot(true)}
                                variant="primary"
                                className="self-start px-4 py-1.5 text-xs bg-[#334155] text-[#e2e8f0]"
                            >
                                ＋ {t('users.bot.btn.add')}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Add User form ─────────────────────────────────────────────────

const addUserSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(4, 'Minimum 4 characters'),
    display_name: z.string().optional(),
})

type AddUserFormValues = z.infer<typeof addUserSchema>

const AddUserForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { t } = useI18n()
  const qc = useQueryClient()
  
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { email: '', password: '', display_name: '' }
  })

  const createMut = useMutation({
    mutationFn: (data: AddUserFormValues) => createUser(data),
    onSuccess: () => { 
        qc.invalidateQueries({ queryKey: ['users'] })
        onDone()
        toast.success(t('users.add.confirm'))
    },
  })

  return (
    <Card title={t('users.add.title')}>
      <form onSubmit={handleSubmit((data) => createMut.mutate(data))} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormInput name="email" control={control} label={t('users.email')} type="email" placeholder="user@example.com" />
          <FormInput name="display_name" control={control} label={t('users.add.display_name')} placeholder={t('users.add.display_name_hint')} />
          <FormInput name="password" control={control} label={t('login.password')} type="password" placeholder="至少4个字符" />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting || createMut.isPending}>
            {t('users.add.confirm')}
          </Button>
          <Button variant="primary" className="bg-[#334155]" onClick={onDone}>
            {t('users.btn.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────

export const UsersPage: React.FC = () => {
  const { t } = useI18n()
  const [addingUser, setAddingUser] = useState(false)

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: 120_000 })
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  })

  if (me && me.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-4 sm:p-8">
        <div className="text-4xl">🔒</div>
        <div className="text-lg font-bold text-[#e2e8f0]">{t('error.admin_only')}</div>
        <div className="text-sm text-[#64748b]">{t('error.admin_only_hint')}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 sm:p-5 gap-6 min-w-0 max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('users.title')}</h1>
          <p className="text-sm text-[#64748b] mt-1">Manage system users and their bots</p>
        </div>
        {!addingUser && (
          <Button onClick={() => setAddingUser(true)}>
            ＋ {t('users.add.title')}
          </Button>
        )}
      </div>

      {addingUser && <AddUserForm onDone={() => setAddingUser(false)} />}

      <Card title={t('users.list.title')}>
        {isLoading ? (
            <p className="text-sm text-[#64748b] py-8 text-center">{t('prompts.loading')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {users?.map(user => <UserPanel key={user.id} user={user} />)}
          </div>
        )}
      </Card>
    </div>
  )
}
