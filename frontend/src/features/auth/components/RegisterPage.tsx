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
  const [inviteCode, setInviteCode] = useState('')
  const [notifyLang, setNotifyLang] = useState<'en' | 'zh'>(lang)
  const [busy, setBusy] = useState(false)

  const canSubmit = !!email && !!password && password === password2 && !!inviteCode

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      const data = await register(email, password, displayName || undefined, lang, notifyLang, inviteCode)
      localStorage.setItem('auth_token', data.access_token)
      navigate('/home', { replace: true })
    } catch {
      /* TODO: show error message */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,252,255,0.96)_52%,rgba(246,249,253,0.95)_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.45),transparent_70%)]" />

      <div className="relative w-full max-w-sm">
        <div className="absolute inset-0 rounded-[30px] bg-white/30 blur-2xl" />

        <div className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[rgba(255,255,255,0.84)] backdrop-blur-xl ring-1 ring-black/[0.03] shadow-[0_12px_40px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.85)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,255,255,0.06)_48%,transparent)]" />

          <div className="relative flex flex-col gap-6 p-8">
            <div className="text-center">
              <div className="text-[29px] font-semibold tracking-[-0.04em] text-slate-900">小星</div>
              <div className="mt-2 text-sm text-slate-500">{t('register.title')}</div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
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
                <div className="px-1 text-[11px] leading-5 text-slate-500">
                  {t('register.notify_lang_hint')}
                </div>
              </div>

              <InputField
                label={t('register.invite_code')}
                autoComplete="off"
                value={inviteCode}
                onChange={(v) => setInviteCode(v)}
                required
                disabled={busy}
              />

              <div className="px-1 text-[11px] leading-5 text-slate-500 -mt-3">
                {t('register.invite_hint')}
              </div>

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
                className="w-full mt-2"
              >
                {t('register.btn')}
              </Button>

              <div className="text-center text-xs text-slate-500">
                {t('register.have_account')}{' '}
                <Link
                  to="/login"
                  className="underline underline-offset-4 text-[#0b3c5d] hover:text-slate-900 transition-colors"
                >
                  {t('register.to_login')}
                </Link>
              </div>
            </form>

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
      </div>
    </div>
  )
}
