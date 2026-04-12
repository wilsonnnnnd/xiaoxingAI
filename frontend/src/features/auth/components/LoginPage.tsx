import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../i18n/useI18n'
import { login } from '../api'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'

export const LoginPage: React.FC = () => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const data = await login(email, password)
      localStorage.setItem('auth_token', data.access_token)
      navigate('/home', { replace: true })
    } catch (err: unknown) {
      // Error handled by global interceptor
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1e2330] border border-[#2d3748] rounded-2xl p-8 flex flex-col gap-6 shadow-xl">
        <div className="text-center">
          <div className="text-3xl font-bold text-white tracking-tight">小星</div>
          <div className="text-sm text-[#94a3b8] mt-2">{t('login.title')}</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <InputField
            label={t('login.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(v) => setEmail(v)}
            required
            disabled={busy}
          />
          <InputField
            label={t('login.password')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(v) => setPassword(v)}
            required
            disabled={busy}
          />
          
          <Button
            type="submit"
            loading={busy}
            className="w-full py-2.5 mt-2"
          >
            {t('login.btn')}
          </Button>
        </form>
      </div>
    </div>
  )
}
