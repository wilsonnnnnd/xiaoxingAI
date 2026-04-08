import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { login } from '../api'

export default function Login() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await login(email, password)
      localStorage.setItem('auth_token', data.access_token)
      navigate('/home', { replace: true })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? t('login.error'))
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full bg-[#0b0e14] border border-[#2d3748] rounded-md px-3 py-2 text-sm text-[#e2e8f0] outline-none focus:border-[#6366f1] transition-colors'

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <div className="w-full max-w-sm bg-[#1e2330] border border-[#2d3748] rounded-2xl p-8 flex flex-col gap-6 shadow-xl">
        <div className="text-center">
          <div className="text-2xl font-bold text-[#e2e8f0]">小星</div>
          <div className="text-sm text-[#64748b] mt-1">{t('login.title')}</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#94a3b8]">{t('login.email')}</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#94a3b8]">{t('login.password')}</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          {error && <p className="text-xs text-[#fca5a5]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? '…' : t('login.btn')}
          </button>
        </form>
      </div>
    </div>
  )
}
