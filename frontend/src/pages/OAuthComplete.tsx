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
      ? ok
        ? '授权完成'
        : '授权失败'
      : ok
        ? 'Authorization complete'
        : 'Authorization failed'

  const body =
    lang === 'zh'
      ? ok
        ? `已完成 ${provider ?? 'Google'} 授权，你可以关闭此页面返回应用。`
        : `未能完成 ${provider ?? 'Google'} 授权，请返回应用重试。`
      : ok
        ? `${provider ?? 'Google'} authorization completed. You can close this page and return to the app.`
        : `${provider ?? 'Google'} authorization failed. Please return to the app and try again.`

  return (
    <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center px-4 py-8 sm:px-8">
      <div
        className={[
          'w-full max-w-xl rounded-[28px] p-6 text-center sm:p-8',
          'border border-white/70 bg-white/72 backdrop-blur-xl',
          'ring-1 ring-black/[0.03]',
          'shadow-[0_8px_24px_rgba(15,23,42,0.04)]',
          'bg-[linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0.1)_42%,transparent)]',
        ].join(' ')}
      >
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-600 ring-1 ring-black/[0.03]">
          <span
            className={[
              'inline-block h-2 w-2 rounded-full',
              ok ? 'bg-[rgba(217,235,255,1)]' : 'bg-slate-300',
            ].join(' ')}
          />
          {provider ?? 'Google'}
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          {body}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.close()}
            className={[
              'rounded-full px-4 py-2.5 text-sm font-semibold',
              'border border-white/80 bg-[rgba(217,235,255,0.92)] text-[#0b3c5d]',
              'ring-1 ring-black/[0.03]',
              'shadow-[0_8px_20px_rgba(15,23,42,0.04)]',
              'transition-all duration-200 hover:brightness-[1.02]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.9)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(248,250,252,1)]',
            ].join(' ')}
          >
            {lang === 'zh' ? '关闭窗口' : 'Close window'}
          </button>

          <Link
            to="/settings"
            className={[
              'rounded-full px-4 py-2.5 text-sm font-semibold',
              'border border-white/70 bg-white/72 backdrop-blur-xl text-slate-700',
              'ring-1 ring-black/[0.03]',
              'shadow-[0_8px_20px_rgba(15,23,42,0.04)]',
              'transition-all duration-200 hover:bg-white/82 hover:text-slate-900',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.9)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(248,250,252,1)]',
            ].join(' ')}
          >
            {lang === 'zh' ? '返回设置' : 'Back to Settings'}
          </Link>

          <Link
            to="/home"
            className={[
              'rounded-full px-4 py-2.5 text-sm font-semibold',
              'border border-white/70 bg-white/72 backdrop-blur-xl text-slate-700',
              'ring-1 ring-black/[0.03]',
              'shadow-[0_8px_20px_rgba(15,23,42,0.04)]',
              'transition-all duration-200 hover:bg-white/82 hover:text-slate-900',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(217,235,255,0.9)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(248,250,252,1)]',
            ].join(' ')}
          >
            {t('nav.home')}
          </Link>
        </div>
      </div>
    </div>
  )
}