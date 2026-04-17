import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../../../i18n/useI18n'
import { register } from '../api'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { Select } from '../../../components/common/Select'

export const RegisterPage: React.FC = () => {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [notifyLang, setNotifyLang] = useState<'en' | 'zh'>(lang)
  const [busy, setBusy] = useState(false)

  const canSubmit = !!email && !!password && password === password2

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      const data = await register(email, password, displayName || undefined, lang, notifyLang)
      localStorage.setItem('auth_token', data.access_token)
      navigate('/home', { replace: true })
    } catch {
        /* TODO: show error message */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1e2330] border border-[#2d3748] rounded-2xl p-8 flex flex-col gap-6 shadow-xl">
        <div className="text-center">
          <div className="text-3xl font-bold text-white tracking-tight">小星</div>
          <div className="text-sm text-[#94a3b8] mt-2">{t('register.title')}</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Select
            label={t('register.notify_lang')}
            value={notifyLang}
            onChange={(e) => {
              const v = e.target.value as 'en' | 'zh'
              setNotifyLang(v)
            }}
            options={[
              { label: 'English', value: 'en' },
              { label: '中文', value: 'zh' },
            ]}
          />
          <div className="text-[11px] text-[#64748b] -mt-3">{t('register.notify_lang_hint')}</div>
          <InputField
            label={t('register.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(v) => setEmail(v)}
            required
            disabled={busy}
          />
          <InputField
            label={t('register.display_name')}
            value={displayName}
            onChange={(v) => setDisplayName(v)}
            disabled={busy}
          />
          <InputField
            label={t('register.password')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(v) => setPassword(v)}
            required
            disabled={busy}
          />
          <InputField
            label={t('register.password2')}
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(v) => setPassword2(v)}
            required
            disabled={busy}
          />

          <Button
            type="submit"
            loading={busy}
            disabled={!canSubmit}
            className="w-full py-2.5 mt-2"
          >
            {t('register.btn')}
          </Button>

          <div className="text-xs text-[#64748b] text-center">
            {t('register.have_account')}{' '}
            <Link to="/login" className="underline hover:text-white transition-colors">
              {t('register.to_login')}
            </Link>
          </div>
        </form>

        <div className="flex items-center justify-center gap-4 text-xs text-[#64748b]">
          <Link to="/privacy" className="hover:underline">{t('nav.privacy')}</Link>
          <span className="opacity-40">•</span>
          <Link to="/terms" className="hover:underline">{t('nav.terms')}</Link>
        </div>
      </div>
    </div>
  )
}
