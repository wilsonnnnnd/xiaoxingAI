import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { InputField } from '../components/common/InputField'
import { Select } from '../components/common/Select'
import { Switch } from '../components/common/Switch'
import { Modal } from '../components/common/Modal'
import { Badge } from '../components/common/Badge'
import { useI18n } from '../i18n/useI18n'
import { KpiCard } from '../components/common/KpiCard'
import { Surface } from '../components/common/Surface'



export default function UiDemo() {
  const { t } = useI18n()
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('Wilson')
  const [email, setEmail] = useState('weimengding@gmail.com')
  const [plan, setPlan] = useState('pro')
  const [enabled, setEnabled] = useState(true)

  const kpis = useMemo(() => {
    return [
      { label: t('ui_demo.kpi.uptime'), value: '99.98%', tone: 'sky' as const },
      { label: t('ui_demo.kpi.latency'), value: '148ms', tone: 'emerald' as const },
      { label: t('ui_demo.kpi.queue'), value: '2', tone: 'violet' as const },
    ]
  }, [t])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(217,235,255,0.42),transparent_26%),radial-gradient(circle_at_85%_12%,rgba(224,238,255,0.34),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,252,255,0.96)_52%,rgba(246,249,253,0.95)_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
        <section className="relative  rounded-[36px] border border-white/60 bg-white/72 px-5 py-6 shadow-[0_20px_70px_rgba(15,23,42,0.07)] backdrop-blur-2xl sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/80 to-transparent" />
          <div className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-violet-200/40 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-600">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Product Surface
              </div>

              <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[0.96] tracking-[-0.06em] text-slate-950 sm:text-5xl">
                {t('header.title.ui_demo')}
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                {t('header.subtitle.ui_demo')}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start lg:self-auto">
              <Badge variant="info">{t('ui_demo.badge.light')}</Badge>
              <Button
                variant="primary"
                className="rounded-full bg-slate-950 px-5 hover:bg-slate-800"
                onClick={() => setModalOpen(true)}
              >
                {t('ui_demo.btn.open_modal')}
              </Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {kpis.map((x) => (
            <KpiCard
              key={x.label}
              label={x.label}
              value={x.value}
              note={t('ui_demo.kpi.note')}
              tone={x.tone}
            />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Card 1 - KPI */}
          <Card
            subtitle="Analytics"
            title="12,480 Users"
            rightSlot={
              <div className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs text-sky-600">
                +12%
              </div>
            }
          >
            Active users in the last 7 days, steadily increasing across all regions.
          </Card>

          {/* Card 2 - System */}
          <Card
            subtitle="System"
            title="API Health"
            footer={
              <>
                <span className="text-xs text-slate-500">
                  All services operational
                </span>
                <button className="rounded-full  px-4 py-1.5 text-xs text-white transition-colors group-hover:text-slate-900 hover:bg-slate-800">
                  Check
                </button>
              </>
            }
          >
            All endpoints responding under 200ms. No incidents reported.
          </Card>

          {/* Card 3 - Activity */}
          <Card subtitle="Activity" title="Recent Events">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                New user registered
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                Email processed
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                Worker restarted
              </li>
            </ul>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Surface
            eyebrow="Configuration"
            title={t('ui_demo.section.form')}
            badge="Editable"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField label={t('ui_demo.form.name')} value={name} onChange={setName} />
              <InputField label={t('ui_demo.form.email')} type="email" value={email} onChange={setEmail} />
              <Select
                label={t('ui_demo.form.plan')}
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                options={[
                  { label: 'Free', value: 'free' },
                  { label: 'Pro', value: 'pro' },
                  { label: 'Team', value: 'team' },
                ]}
              />

              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('ui_demo.form.enabled')}
                </div>
                <div className="mt-3 flex min-h-[40px] items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900">
                    {enabled ? t('ui_demo.form.on') : t('ui_demo.form.off')}
                  </div>
                  <Switch checked={enabled} onChange={setEnabled} label="" />
                </div>
              </div>
            </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button
                    className="rounded-full bg-slate-950 px-5 transition-colors group-hover:text-slate-900 hover:bg-slate-800"
                    onClick={() => toast.success(t('ui_demo.toast.saved'))}
                  >
                    {t('btn.save')}
                  </Button>

              <Button
                variant="primary"
                className="rounded-full bg-white px-5 ring-1 ring-slate-200"
                onClick={() => {
                  setName('Wilson')
                  setEmail('weimengding@gmail.com')
                  setPlan('pro')
                  setEnabled(true)
                  toast.success(t('ui_demo.toast.reset'))
                }}
              >
                {t('btn.reload')}
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="success">{t('ui_demo.badge.success')}</Badge>
              <Badge variant="warning">{t('ui_demo.badge.warning')}</Badge>
              <Badge variant="error">{t('ui_demo.badge.error')}</Badge>
              <Badge variant="neutral">{t('ui_demo.badge.neutral')}</Badge>
            </div>
          </Surface>

          <Surface
            eyebrow="Activity"
            title={t('ui_demo.section.list')}
            badge={t('ui_demo.badge.new')}
          >
            <div className="flex flex-col gap-3">
              {[
                { title: t('ui_demo.item.title1'), meta: t('ui_demo.item.meta1') },
                { title: t('ui_demo.item.title2'), meta: t('ui_demo.item.meta2') },
                { title: t('ui_demo.item.title3'), meta: t('ui_demo.item.meta3') },
              ].map((x, index) => (
                <div
                  key={x.title}
                  className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                >
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-sky-400 via-cyan-300 to-violet-300 opacity-80" />

                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full 
                            bg-[rgba(217,235,255,0.9)] 
                            text-[#0b3c5d] 
                            border border-sky-200/70
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.06)]"
                        >
                          {index + 1}
                        </div>
                        <div className="truncate text-sm font-semibold text-slate-950">
                          {x.title}
                        </div>
                      </div>

                      <div className="mt-2 pl-8 text-xs leading-6 text-slate-500">
                        {x.meta}
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      className="rounded-full bg-white px-3 py-1 text-xs text-slate-950 ring-1 ring-slate-200 transition-colors group-hover:bg-slate-50"
                      onClick={() => toast.success(t('ui_demo.toast.action'))}
                    >
                      {t('ui_demo.btn.action')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-xs leading-6 text-slate-500">
              {t('ui_demo.note')}
            </div>
          </Surface>
        </section>

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={t('ui_demo.modal.title')}
          footer={
            <>
              <Button
                variant="primary"
                className="rounded-full bg-white px-5 ring-1 ring-slate-200 transition-colors group-hover:bg-slate-50"
                onClick={() => setModalOpen(false)}
              >
                {t('btn.cancel')}
              </Button>
              <Button
                className="rounded-full bg-slate-950 px-5 hover:bg-slate-800"
                onClick={() => {
                  setModalOpen(false)
                  toast.success(t('ui_demo.toast.confirmed'))
                }}
              >
                {t('btn.confirm')}
              </Button>
            </>
          }
        >
          <div className="text-sm leading-7 text-slate-600">
            {t('ui_demo.modal.body')}
          </div>
        </Modal>
      </div>
    </div>
  )
}