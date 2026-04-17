import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useI18n } from '../../../i18n/useI18n'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { changePassword } from '../../auth/api'
import toast from 'react-hot-toast'

export const ChangePasswordCard: React.FC = () => {
  const { t } = useI18n()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const pwCls = [
    'w-full rounded-xl px-3 py-2 pr-16 text-sm',
    'bg-white/70 backdrop-blur-xl',
    'border border-white/70 ring-1 ring-black/[0.03]',
    'text-slate-900 placeholder:text-slate-400',
    'shadow-[0_8px_22px_rgba(15,23,42,0.03)]',
    'outline-none transition-all duration-200',
    'focus:border-sky-200/70 focus:ring-2 focus:ring-sky-300/30',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' ')
  const toggleCls = [
    'absolute right-2 top-1/2 -translate-y-1/2',
    'text-[11px] font-semibold',
    'text-slate-500 hover:text-slate-900',
    'transition-colors',
  ].join(' ')

  const mut = useMutation({
    mutationFn: () => changePassword(oldPassword, newPassword),
    onSuccess: (d) => {
      if (d?.access_token) localStorage.setItem('auth_token', d.access_token)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success(t('settings.password.changed'))
    },
  })

  const disabled =
    mut.isPending ||
    !oldPassword ||
    !newPassword ||
    newPassword.length < 4 ||
    newPassword !== confirmPassword

  return (
    <Card title={t('settings.password.title')}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 w-full">
          <label className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{t('settings.password.old')}</label>
          <div className="relative">
            <input className={pwCls} type={showOld ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
            <button type="button" className={toggleCls} onClick={() => setShowOld(v => !v)}>
              {showOld ? t('settings.password.hide') : t('settings.password.show')}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full">
          <label className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{t('settings.password.new')}</label>
          <div className="relative">
            <input className={pwCls} type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button type="button" className={toggleCls} onClick={() => setShowNew(v => !v)}>
              {showNew ? t('settings.password.hide') : t('settings.password.show')}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full">
          <label className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{t('settings.password.confirm')}</label>
          <div className="relative">
            <input className={pwCls} type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <button type="button" className={toggleCls} onClick={() => setShowConfirm(v => !v)}>
              {showConfirm ? t('settings.password.hide') : t('settings.password.show')}
            </button>
          </div>
        </div>

        <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={disabled} className="self-start px-8">
          {t('settings.password.save')}
        </Button>
      </div>
    </Card>
  )
}
