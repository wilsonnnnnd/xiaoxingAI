import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'

function useQueryParam(name: string): string | null {
  const { search } = useLocation()
  return new URLSearchParams(search).get(name)
}

export default function OAuthComplete() {
  const { t, lang } = useI18n()
  const result = useQueryParam('result')
  const provider = useQueryParam('provider')
  const ok = result === 'success'

  const title =
    lang === 'zh'
      ? ok ? '授权完成' : '授权失败'
      : ok ? 'Authorization complete' : 'Authorization failed'

  const body =
    lang === 'zh'
      ? ok
        ? `已完成 ${provider ?? 'Google'} 授权，你可以关闭此页面返回应用。`
        : `未能完成 ${provider ?? 'Google'} 授权，请返回应用重试。`
      : ok
        ? `${provider ?? 'Google'} authorization completed. You can close this page and return to the app.`
        : `${provider ?? 'Google'} authorization failed. Please return to the app and try again.`

  return (
    <div className="flex items-center justify-center h-full p-4 sm:p-8">
      <div className="w-full max-w-xl rounded-2xl border border-[#1f2a3a] bg-[#0b1220] p-6 sm:p-8 text-center">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-sm text-[#94a3b8] leading-6">{body}</p>

        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => window.close()}
            className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] active:bg-[#4338ca] text-white font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
          >
            {lang === 'zh' ? '关闭窗口' : 'Close window'}
          </button>
          <Link
            to="/settings"
            className="px-4 py-2 rounded-lg bg-[#0b1220] border border-[#1f2a3a] hover:border-[#334155] text-[#e2e8f0] font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
          >
            {lang === 'zh' ? '返回设置' : 'Back to Settings'}
          </Link>
          <Link
            to="/home"
            className="px-4 py-2 rounded-lg bg-[#0b1220] border border-[#1f2a3a] hover:border-[#334155] text-[#e2e8f0] font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
          >
            {t('nav.home')}
          </Link>
        </div>
      </div>
    </div>
  )
}

