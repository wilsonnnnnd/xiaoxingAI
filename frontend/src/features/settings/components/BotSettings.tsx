import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../../../i18n/useI18n'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { Select } from '../../../components/common/Select'
import { listBots, createBot, updateBot, deleteBot, setDefaultBot, getTelegramChatId } from '../../users/api'
import type { Bot } from '../../../types'
import toast from 'react-hot-toast'

interface BotRowProps {
  bot: Bot
  userId: number
}

const BotRow: React.FC<BotRowProps> = ({ bot, userId }) => {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ 
    name: bot.name, 
    token: bot.token, 
    chat_id: bot.chat_id, 
    bot_mode: bot.bot_mode ?? 'all' 
  })
  const [gettingChatId, setGettingChatId] = useState(false)
  
  const queryKey = ['bots', userId]

  const updateMut = useMutation({
    mutationFn: () => updateBot(userId, bot.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      setEditing(false)
    }
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteBot(userId, bot.id),
    onSuccess: () => qc.invalidateQueries({ queryKey })
  })

  const defaultMut = useMutation({
    mutationFn: () => setDefaultBot(userId, bot.id),
    onSuccess: () => qc.invalidateQueries({ queryKey })
  })

  if (editing) {
    return (
      <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-4 flex flex-col gap-3">
        <InputField
          label={t('users.bot.name')}
          value={form.name}
          onChange={(v) => setForm(f => ({ ...f, name: v }))}
        />
        <InputField
          label={t('users.bot.token')}
          value={form.token}
          onChange={(v) => setForm(f => ({ ...f, token: v }))}
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
            className="bg-[#334155] hover:bg-[#475569] text-xs px-3 py-1.5"
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
          onChange={(e) => setForm(f => ({ ...f, bot_mode: e.target.value }))}
          options={[
            { label: t('users.bot.mode.all'), value: 'all' },
            { label: t('users.bot.mode.notify'), value: 'notify' },
          ]}
        />
        <div className="flex gap-2 mt-1">
          <Button onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
            {t('users.btn.save')}
          </Button>
          <Button variant="primary" className="bg-[#334155] hover:bg-[#475569]" onClick={() => setEditing(false)}>
            {t('users.btn.cancel')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm text-[#e2e8f0] font-medium flex items-center gap-2 flex-wrap">
          {bot.name}
          {bot.is_default && <span className="text-[10px] bg-[#1d4ed8] text-white px-1.5 py-0 rounded uppercase font-bold">{t('users.bot.default')}</span>}
          {bot.bot_mode === 'notify' && <span className="text-[10px] bg-[#854d0e] text-[#fef08a] px-1.5 py-0 rounded uppercase font-bold">{t('users.bot.mode.notify')}</span>}
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
    }
  })

  const canSubmit = form.name && form.token && form.chat_id

  return (
    <div className="bg-[#0b0e14] border border-[#273347] rounded-lg p-4 flex flex-col gap-3">
      <div className="text-xs text-[#64748b] leading-relaxed">
        <div className="font-semibold text-[#94a3b8]">{t('users.bot.hint.title')}</div>
        <ol className="list-decimal pl-5 mt-1 flex flex-col gap-0.5">
          <li>
            {t('users.bot.hint.step1')}{' '}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline">
              BotFather
            </a>
          </li>
          <li>{t('users.bot.hint.step2')}</li>
          <li>{t('users.bot.hint.step3')}</li>
        </ol>
      </div>
      <InputField
        label={t('users.bot.name')}
        value={form.name}
        onChange={(v) => setForm(f => ({ ...f, name: v }))}
      />
      <InputField
        label={t('users.bot.token')}
        value={form.token}
        onChange={(v) => setForm(f => ({ ...f, token: v }))}
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
          className="bg-[#334155] hover:bg-[#475569] text-xs px-3 py-1.5"
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
        onChange={(e) => setForm(f => ({ ...f, bot_mode: e.target.value }))}
        options={[
          { label: t('users.bot.mode.all'), value: 'all' },
          { label: t('users.bot.mode.notify'), value: 'notify' },
        ]}
      />
      <div className="flex gap-2 mt-1">
        <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!canSubmit}>
          {t('users.bot.btn.add')}
        </Button>
        <Button variant="primary" className="bg-[#334155] hover:bg-[#475569]" onClick={onDone}>
          {t('users.btn.cancel')}
        </Button>
      </div>
    </div>
  )
}

export const BotSettings: React.FC<{ userId: number }> = ({ userId }) => {
  const { t } = useI18n()
  const [addingBot, setAddingBot] = useState(false)

  const { data: bots = [], isLoading } = useQuery({
    queryKey: ['bots', userId],
    queryFn: () => listBots(userId),
  })

  return (
    <Card title={t('card.telegram')}>
      <p className="text-xs text-[#64748b] -mt-2 mb-2">{t('settings.bots.desc')}</p>
      <div className="flex flex-col gap-2">
        {isLoading ? (
          <p className="text-xs text-[#64748b]">{t('prompts.loading')}</p>
        ) : (
          <>
            {bots.length === 0 && !addingBot && (
              <p className="text-xs text-[#64748b] py-4 text-center border border-dashed border-[#2d3748] rounded-lg">{t('users.bots.empty')}</p>
            )}
            {bots.map(bot => (
              <BotRow key={bot.id} bot={bot} userId={userId} />
            ))}
            {addingBot ? (
              <AddBotForm userId={userId} onDone={() => setAddingBot(false)} />
            ) : (
              <Button 
                variant="primary" 
                className="self-start px-3 py-1.5 text-xs bg-[#334155] text-[#e2e8f0]" 
                onClick={() => setAddingBot(true)}
              >
                ＋ {t('users.bot.btn.add')}
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
