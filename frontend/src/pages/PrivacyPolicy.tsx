import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { getPrivacyPolicy } from './legalContent'

export default function PrivacyPolicy() {
  const { lang } = useI18n()
  const doc = getPrivacyPolicy(lang)
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{doc.title}</h1>
        <p className="text-sm text-[#94a3b8] mt-2">
          {lang === 'zh' ? '生效日期：' : 'Effective date: '}
          {doc.effectiveDate}
        </p>
      </div>

      <div className="space-y-6 text-sm text-[#cbd5e1] leading-6">
        {doc.sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-lg font-semibold text-white">{s.title}</h2>
            {s.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.bullets && (
              <ul className="list-disc pl-5 space-y-1 text-[#94a3b8]">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <div className="pt-4 border-t border-[#1f2a3a] flex items-center justify-between gap-3">
          <Link className="text-[#60a5fa] hover:underline" to="/terms">{lang === 'zh' ? '服务条款' : 'Terms of Service'}</Link>
          <Link className="text-[#94a3b8] hover:underline" to="/home">{lang === 'zh' ? '返回首页' : 'Back to Home'}</Link>
        </div>
      </div>
    </div>
  )
}
