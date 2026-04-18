import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useI18n } from '../../../i18n/useI18n'
import {
    listUsers, updateUser, listBots, createBot, updateBot, deleteBot, setDefaultBot, createUser, getMe, getTelegramChatId,
    listInvites, createInvite, revokeInvite,
} from '../api'
import type { User, Bot } from '../../../types'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { Select } from '../../../components/common/Select'
import { Switch } from '../../../components/common/Switch'
import { FormInput } from '../../../components/common/form/FormInput'
import { Badge } from '../../../components/common/Badge'
import toast from 'react-hot-toast'

// ── Bot row form ─────────────────────────────────────────────────

const BotRow: React.FC<{ bot: Bot; userId: number }> = ({ bot, userId }) => {
    const { t } = useI18n()
    const qc = useQueryClient()
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({ name: bot.name, token: bot.token, chat_id: bot.chat_id, bot_mode: bot.bot_mode ?? 'all' })
    const [gettingChatId, setGettingChatId] = useState(false)

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
            <div className="rounded-[24px] border border-white/70 bg-[rgba(255,255,255,0.72)] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] backdrop-blur-xl flex flex-col gap-3">
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
                    disabled
                    placeholder={t('users.bot.hint.btn_get_chat_id')}
                />

                <div className="flex gap-2 -mt-1">
                    <Button
                        variant="primary"
                        className="text-xs px-3 py-1.5 bg-[rgba(217,235,255,0.82)] text-[#0b3c5d] border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:brightness-[1.02]"
                        loading={gettingChatId}
                        disabled={!form.token || gettingChatId}
                        onClick={async () => {
                            const token = form.token.trim()
                            if (!token) return
                            setGettingChatId(true)
                            try {
                                const res = await getTelegramChatId(token)
                                const chatId = (res?.chat_id ?? '').toString().trim()
                                if (!chatId) {
                                    toast.error(t('users.bot.hint.no_chat_id'))
                                    return
                                }
                                setForm(f => ({ ...f, chat_id: chatId }))
                                toast.success(t('users.bot.hint.filled'))
                            } finally {
                                setGettingChatId(false)
                            }
                        }}
                    >
                        {t('users.bot.hint.btn_get_chat_id')}
                    </Button>
                </div>

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

                <div className="flex gap-2 pt-1">
                    <Button onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
                        {t('users.btn.save')}
                    </Button>
                    <Button
                        variant="ghost"
                        className="text-slate-600 hover:text-slate-900 hover:bg-[rgba(255,255,255,0.55)]"
                        onClick={() => setEditing(false)}
                    >
                        {t('users.btn.cancel')}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-between gap-3 rounded-[22px] border border-white/70 bg-[rgba(255,255,255,0.72)] p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] backdrop-blur-xl">
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    {bot.name}

                    {bot.is_default && (
                        <span className="rounded-md border border-white/80 bg-[rgba(217,235,255,0.82)] px-1.5 py-0 text-[10px] font-bold uppercase text-[#0b3c5d] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                            {t('users.bot.default')}
                        </span>
                    )}

                    {bot.bot_mode === 'notify' && (
                        <span className="rounded-md border border-white/70 bg-[rgba(255,243,205,0.82)] px-1.5 py-0 text-[10px] font-bold uppercase text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                            {t('users.bot.mode.notify')}
                        </span>
                    )}

                    {bot.bot_mode === 'chat' && (
                        <span className="rounded-md border border-white/70 bg-[rgba(232,238,255,0.86)] px-1.5 py-0 text-[10px] font-bold uppercase text-indigo-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                            {t('users.bot.mode.chat')}
                        </span>
                    )}
                </span>

                <span className="truncate font-mono text-xs text-slate-500">
                    {bot.chat_id}
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
                {!bot.is_default && (
                    <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs text-slate-600 hover:bg-[rgba(217,235,255,0.55)] hover:text-slate-900"
                        onClick={() => defaultMut.mutate()}
                        loading={defaultMut.isPending}
                    >
                        {t('users.bot.btn.set_default')}
                    </Button>
                )}

                <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs text-slate-600 hover:bg-[rgba(255,255,255,0.55)] hover:text-slate-900"
                    onClick={() => setEditing(true)}
                >
                    {t('users.btn.edit')}
                </Button>

                <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs text-rose-500 hover:bg-[rgba(255,240,242,0.8)] hover:text-rose-600"
                    onClick={() => {
                        if (confirm(t('users.bot.confirm_delete'))) deleteMut.mutate()
                    }}
                    loading={deleteMut.isPending}
                >
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
    const [gettingChatId, setGettingChatId] = useState(false)

    const createMut = useMutation({
        mutationFn: () => createBot(userId, form),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bots', userId] })
            onDone()
            toast.success(t('users.bot.btn.add'))
        },
    })

    return (
        <div className="flex flex-col gap-3 rounded-[24px] border border-white/70 bg-[rgba(255,255,255,0.72)] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] backdrop-blur-xl">
            <div className="rounded-[18px] border border-white/70 bg-[rgba(255,255,255,0.52)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <div className="text-xs leading-relaxed text-slate-500">
                    <div className="font-semibold text-slate-700">
                        {t('users.bot.hint.title')}
                    </div>
                    <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-5">
                        <li>
                            {t('users.bot.hint.step1')}{' '}
                            <a
                                href="https://t.me/BotFather"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#0b3c5d] underline decoration-[rgba(11,60,93,0.28)] underline-offset-2 hover:text-slate-900"
                            >
                                BotFather
                            </a>
                        </li>
                        <li>{t('users.bot.hint.step2')}</li>
                        <li>{t('users.bot.hint.step3')}</li>
                    </ol>
                </div>
            </div>

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
                disabled
                placeholder={t('users.bot.hint.btn_get_chat_id')}
            />

            <div className="flex gap-2 -mt-1">
                <Button
                    variant="primary"
                    className="px-3 py-1.5 text-xs bg-[rgba(217,235,255,0.82)] text-[#0b3c5d] border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:brightness-[1.02]"
                    loading={gettingChatId}
                    disabled={!form.token || gettingChatId}
                    onClick={async () => {
                        const token = form.token.trim()
                        if (!token) return
                        setGettingChatId(true)
                        try {
                            const res = await getTelegramChatId(token)
                            const chatId = (res?.chat_id ?? '').toString().trim()
                            if (!chatId) {
                                toast.error(t('users.bot.hint.no_chat_id'))
                                return
                            }
                            setForm(f => ({ ...f, chat_id: chatId }))
                            toast.success(t('users.bot.hint.filled'))
                        } finally {
                            setGettingChatId(false)
                        }
                    }}
                >
                    {t('users.bot.hint.btn_get_chat_id')}
                </Button>
            </div>

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

            <div className="flex gap-2 pt-1">
                <Button
                    onClick={() => createMut.mutate()}
                    loading={createMut.isPending}
                    disabled={!form.name || !form.token || !form.chat_id}
                >
                    {t('users.bot.btn.add')}
                </Button>

                <Button
                    variant="ghost"
                    className="text-slate-600 hover:bg-[rgba(255,255,255,0.55)] hover:text-slate-900"
                    onClick={onDone}
                >
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
        <div className="overflow-hidden rounded-[28px] border border-white/80 bg-[rgba(255,255,255,0.82)] shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] backdrop-blur-xl">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 transition-all hover:bg-[rgba(255,255,255,0.42)]"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-[rgba(217,235,255,0.82)] text-sm font-bold text-[#0b3c5d] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                        {user.email[0].toUpperCase()}
                    </div>

                    <div className="text-left">
                        <div className="text-sm font-semibold text-slate-900">
                            {user.email}
                        </div>

                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                            <span className="uppercase tracking-[0.08em] text-slate-400">
                                {user.role}
                            </span>
                            {user.worker_enabled && (
                                <span className="text-emerald-500">
                                    ● {t('users.enabled')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <span
                    className="text-slate-400 transition-transform duration-200"
                    style={{ transform: open ? 'rotate(180deg)' : 'none' }}
                >
                    ▾
                </span>
            </button>

            {open && (
                <div className="flex flex-col gap-6 border-t border-white/70 px-6 py-5 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                            {t('users.section.settings')}
                        </h3>

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
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                            {t('users.section.bots')}
                        </h3>

                        {botsLoading ? (
                            <p className="py-2 text-xs text-slate-500">
                                {t('prompts.loading')}
                            </p>
                        ) : bots && bots.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {bots.map(bot => (
                                    <BotRow key={bot.id} bot={bot} userId={user.id} />
                                ))}
                            </div>
                        ) : (
                            <p className="py-2 text-xs italic text-slate-500">
                                {t('users.bots.empty')}
                            </p>
                        )}

                        {addingBot ? (
                            <AddBotForm userId={user.id} onDone={() => setAddingBot(false)} />
                        ) : (
                            <Button
                                onClick={() => setAddingBot(true)}
                                className="self-start px-4 py-1.5 text-xs"
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
            <form
                onSubmit={handleSubmit((data) => createMut.mutate(data))}
                className="flex flex-col gap-5"
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormInput
                        name="email"
                        control={control}
                        label={t('users.email')}
                        type="email"
                        placeholder="user@example.com"
                    />
                    <FormInput
                        name="display_name"
                        control={control}
                        label={t('users.add.display_name')}
                        placeholder={t('users.add.display_name_hint')}
                    />
                    <FormInput
                        name="password"
                        control={control}
                        label={t('login.password')}
                        type="password"
                        placeholder="至少4个字符"
                    />
                </div>

                <div className="flex items-center gap-3 pt-1">
                    <Button
                        type="submit"
                        loading={isSubmitting || createMut.isPending}
                    >
                        {t('users.add.confirm')}
                    </Button>

                    <Button
                        variant="ghost"
                        className="text-slate-600 hover:bg-[rgba(255,255,255,0.55)] hover:text-slate-900"
                        onClick={onDone}
                    >
                        {t('users.btn.cancel')}
                    </Button>
                </div>
            </form>
        </Card>
    )
}

// ── Page ─────────────────────────────────────────────────────────

const InvitePanel: React.FC = () => {
    const { t, lang } = useI18n()
    const qc = useQueryClient()
    const [ttl, setTtl] = useState(86400)
    const [note, setNote] = useState('')

    const { data: invites = [], isLoading } = useQuery({
        queryKey: ['invites'],
        queryFn: listInvites,
        staleTime: 30_000,
    })

    const createMut = useMutation({
        mutationFn: () => createInvite({ ttl_seconds: ttl, note: note.trim() || undefined }),
        onSuccess: async (inv) => {
            await qc.invalidateQueries({ queryKey: ['invites'] })
            try {
                await navigator.clipboard.writeText(inv.code)
                toast.success(t('users.invite.copied'))
            } catch {
                toast.success(t('users.invite.created'))
            }
        },
    })

    const revokeMut = useMutation({
        mutationFn: (code: string) => revokeInvite(code),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['invites'] })
            toast.success(t('users.invite.revoked'))
        },
    })

    const [now, setNow] = useState<number | null>(null)

    useEffect(() => {
        const id = window.setTimeout(() => setNow(Date.now()), 0)
        return () => clearTimeout(id)
    }, [])

    const rows = useMemo(() => {
        if (now === null) return []
        return invites.map((x) => {
            const exp = Date.parse(x.expires_at)
            const isExpired = Number.isFinite(exp) ? exp <= now : false
            const isUsed = !!x.used_at || !!x.used_by
            const isRevoked = !!x.revoked_at
            const status = isRevoked ? 'revoked' : isUsed ? 'used' : isExpired ? 'expired' : 'active'
            const variant: 'success' | 'warning' | 'error' | 'neutral' =
                status === 'active' ? 'success' : status === 'expired' ? 'warning' : status === 'revoked' ? 'neutral' : 'neutral'
            const statusText =
                status === 'active' ? t('users.invite.status.active')
                    : status === 'expired' ? t('users.invite.status.expired')
                        : status === 'revoked' ? t('users.invite.status.revoked')
                            : t('users.invite.status.used')
            const usedBy = x.used_by_email || x.used_email || '—'
            const createdBy = x.created_by_email || '—'
            const expText = x.expires_at ? x.expires_at.replace('T', ' ').slice(0, 19) : '—'
            return { x, status, variant, statusText, usedBy, createdBy, expText }
        })
    }, [invites, now, t])

    return (
        <Card title={t('users.invite.title')} subtitle={t('users.invite.subtitle')}>
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_auto] gap-3 items-end">
                <Select
                    label={t('users.invite.ttl')}
                    value={ttl}
                    onChange={(e) => setTtl(Number(e.target.value))}
                    options={[
                        { label: lang === 'zh' ? '1 小时' : '1 hour', value: 3600 },
                        { label: lang === 'zh' ? '24 小时' : '24 hours', value: 86400 },
                        { label: lang === 'zh' ? '7 天' : '7 days', value: 86400 * 7 },
                    ]}
                />
                <InputField
                    label={t('users.invite.note')}
                    value={note}
                    onChange={setNote}
                    placeholder={t('users.invite.note_ph')}
                />
                <Button onClick={() => createMut.mutate()} loading={createMut.isPending} className="h-10">
                    {t('users.invite.btn_create')}
                </Button>
            </div>

            <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            <th className="py-2 pr-3">{t('users.invite.col.code')}</th>
                            <th className="py-2 pr-3">{t('users.invite.col.status')}</th>
                            <th className="py-2 pr-3">{t('users.invite.col.expires')}</th>
                            <th className="py-2 pr-3">{t('users.invite.col.created_by')}</th>
                            <th className="py-2 pr-3">{t('users.invite.col.used_by')}</th>
                            <th className="py-2 pr-0 text-right">{t('users.invite.col.action')}</th>
                        </tr>
                    </thead>
                    <tbody className="align-top">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="py-6 text-center text-slate-500">
                                    {t('prompts.loading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-6 text-center text-slate-500">
                                    {t('users.invite.empty')}
                                </td>
                            </tr>
                        ) : (
                            rows.map(({ x, status, variant, statusText, usedBy, createdBy, expText }) => (
                                <tr key={x.id} className="border-t border-white/60">
                                    <td className="py-3 pr-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-slate-900">{x.code}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-slate-600 hover:text-slate-900"
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(x.code)
                                                        toast.success(t('users.invite.copied'))
                                                    } catch {
                                                        toast.error(t('users.invite.copy_failed'))
                                                    }
                                                }}
                                            >
                                                {t('users.invite.btn_copy')}
                                            </Button>
                                        </div>
                                        {x.note ? <div className="mt-1 text-xs text-slate-500">{x.note}</div> : null}
                                    </td>
                                    <td className="py-3 pr-3">
                                        <Badge variant={variant}>{statusText}</Badge>
                                    </td>
                                    <td className="py-3 pr-3 text-xs text-slate-600 font-mono tabular-nums">{expText}</td>
                                    <td className="py-3 pr-3 text-xs text-slate-600">{createdBy}</td>
                                    <td className="py-3 pr-3 text-xs text-slate-600">{usedBy}</td>
                                    <td className="py-3 pr-0 text-right">
                                        {status === 'active' ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-slate-600 hover:text-slate-900"
                                                onClick={() => {
                                                    if (confirm(t('users.invite.confirm_revoke'))) revokeMut.mutate(x.code)
                                                }}
                                                loading={revokeMut.isPending}
                                            >
                                                {t('users.invite.btn_revoke')}
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-slate-400">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    )
}

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
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center sm:p-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-[rgba(217,235,255,0.82)] text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    🔒
                </div>

                <div className="text-lg font-semibold text-slate-900">
                    {t('error.admin_only')}
                </div>

                <div className="max-w-sm text-sm leading-relaxed text-slate-500">
                    {t('error.admin_only_hint')}
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full max-w-6xl min-w-0 flex-col gap-6 mx-auto px-4 py-6 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                        {t('users.title')}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Manage system users and their bots
                    </p>
                </div>

                {!addingUser && (
                    <Button onClick={() => setAddingUser(true)}>
                        ＋ {t('users.add.title')}
                    </Button>
                )}
            </div>

            {addingUser && <AddUserForm onDone={() => setAddingUser(false)} />}

            <InvitePanel />

            <Card title={t('users.list.title')}>
                {isLoading ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                        {t('prompts.loading')}
                    </p>
                ) : (
                    <div className="flex flex-col gap-4">
                        {users?.map(user => (
                            <UserPanel key={user.id} user={user} />
                        ))}
                    </div>
                )}
            </Card>
        </div>
    )
}
