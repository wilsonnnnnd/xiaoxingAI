import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
    } catch {
      // Error handled by global interceptor
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,252,255,0.96)_52%,rgba(246,249,253,0.95)_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.45),transparent_70%)]" />

      <div className="relative w-full max-w-sm flex flex-col gap-6 rounded-[28px] bg-[rgba(255,255,255,0.82)] backdrop-blur-xl border border-white/80 ring-1 ring-black/[0.03] p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        
        <div className="absolute inset-0 rounded-[28px] pointer-events-none bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,255,255,0.06)_50%,transparent)]" />

        <div className="relative text-center">
          <div className="text-[28px] font-semibold tracking-[-0.02em] text-slate-900">
            小星
          </div>
          <div className="text-sm text-slate-500 mt-2">
            {t('login.title')}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-5">
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
            className="w-full mt-2"
          >
            {t('login.btn')}
          </Button>
        </form>

        <div className="text-xs text-slate-500 text-center">
          {t('register.no_account')}{' '}
          <Link
            to="/register"
            className="underline underline-offset-4 text-[#0b3c5d] hover:text-slate-900 transition-colors"
          >
            {t('register.to_register')}
          </Link>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
          <Link to="/privacy" className="hover:text-slate-900 transition-colors">
            {t('nav.privacy')}
          </Link>
          <span className="opacity-30">•</span>
          <Link to="/terms" className="hover:text-slate-900 transition-colors">
            {t('nav.terms')}
          </Link>
        </div>
      </div>
    </div>
  )
}