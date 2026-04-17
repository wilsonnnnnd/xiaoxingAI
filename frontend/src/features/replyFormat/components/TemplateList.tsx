import React from 'react'
import { Button } from '../../../components/common/Button'
import type { ReplyTemplate } from '../types'

type Props = {
  title: string
  btnNew: string
  noTemplates: string
  defaultLabel: string
  templates: ReplyTemplate[]
  selectedId: number | null
  defaultTemplateId: number | null
  onSelect: (id: number) => void
  onCreate: () => void
  creating: boolean
}

export const TemplateList: React.FC<Props> = ({
  title,
  btnNew,
  noTemplates,
  defaultLabel,
  templates,
  selectedId,
  defaultTemplateId,
  onSelect,
  onCreate,
  creating,
}) => {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Library
          </div>
          <div className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-900">
            {title}
          </div>
        </div>

        <Button onClick={onCreate} loading={creating} className="px-4">
          {btnNew}
        </Button>
      </div>

      <div className="flex max-h-[460px] flex-col gap-2 overflow-auto pr-1">
        {templates.length === 0 ? (
          <div className="rounded-[18px] border border-white/80 bg-white/62 px-4 py-5 text-sm text-slate-500 ring-1 ring-black/[0.03]">
            {noTemplates}
          </div>
        ) : (
          templates.map((tpl) => {
            const isActive = selectedId === tpl.id
            const isDefault = tpl.is_default || defaultTemplateId === tpl.id

            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onSelect(tpl.id)}
                className={[
                  'group w-full rounded-[20px] border px-4 py-3 text-left transition-all duration-200',
                  'backdrop-blur-xl ring-1 ring-black/[0.03]',
                  isActive
                    ? 'border-white/80 bg-[rgba(217,235,255,0.82)] shadow-[0_8px_24px_rgba(15,23,42,0.04)]'
                    : 'border-white/75 bg-[rgba(255,255,255,0.64)] hover:bg-[rgba(255,255,255,0.82)]',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className={[
                        'truncate text-sm font-medium tracking-[-0.01em]',
                        isActive ? 'text-[#0b3c5d]' : 'text-slate-800 group-hover:text-slate-900',
                      ].join(' ')}
                    >
                      {tpl.name}
                    </div>

                    <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">
                      {tpl.body_template.replaceAll('\n', ' ').slice(0, 96)}
                    </div>
                  </div>

                  {isDefault && (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-white/80 bg-white/78 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b3c5d] ring-1 ring-black/[0.03]">
                      {defaultLabel}
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}