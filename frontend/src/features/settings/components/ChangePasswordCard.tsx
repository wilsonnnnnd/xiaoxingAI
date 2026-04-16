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

  const pwCls = 'w-full bg-[#0b0e14] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] outline-none focus:border-[#6366f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed pr-16'
  const toggleCls = 'absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#94a3b8] hover:text-[#e2e8f0] transition-colors'

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
          <label className="text-xs text-[#94a3b8]">{t('settings.password.old')}</label>
          <div className="relative">
            <input className={pwCls} type={showOld ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
            <button type="button" className={toggleCls} onClick={() => setShowOld(v => !v)}>
              {showOld ? t('settings.password.hide') : t('settings.password.show')}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs text-[#94a3b8]">{t('settings.password.new')}</label>
          <div className="relative">
            <input className={pwCls} type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button type="button" className={toggleCls} onClick={() => setShowNew(v => !v)}>
              {showNew ? t('settings.password.hide') : t('settings.password.show')}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs text-[#94a3b8]">{t('settings.password.confirm')}</label>
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
