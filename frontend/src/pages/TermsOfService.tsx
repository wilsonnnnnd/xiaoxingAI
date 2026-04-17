import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { getTermsOfService } from './legalContent'
import { Surface } from '../components/common/Surface'

export default function TermsOfService() {
  const { lang } = useI18n()
  const doc = getTermsOfService(lang)

  const labelHome = lang === 'zh' ? '返回首页' : 'Back to Home'
  const labelPrivacy = lang === 'zh' ? '隐私政策' : 'Privacy Policy'

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <Surface
        title={doc.title}
        eyebrow={lang === 'zh' ? '服务条款' : 'Terms of Service'}
        badge={(lang === 'zh' ? '生效日期：' : 'Effective date: ') + doc.effectiveDate}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/privacy"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-900 text-xs font-semibold ring-1 ring-black/[0.03] transition-colors"
          >
            {labelPrivacy}
          </Link>
          <Link
            to="/home"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-700 text-xs font-semibold ring-1 ring-black/[0.03] transition-colors"
          >
            {labelHome}
          </Link>
        </div>

        <div className="mt-6 space-y-8">
          {doc.sections.map((s, idx) => (
            <section key={s.title} className={idx === 0 ? undefined : 'pt-8 border-t border-white/70'}>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">{s.title}</h2>
              <div className="mt-2 space-y-3 text-sm leading-7 text-slate-700">
                {s.paragraphs?.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {s.bullets && (
                  <ul className="list-disc pl-5 space-y-1 text-slate-700">
                    {s.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </Surface>
    </div>
  )
}
