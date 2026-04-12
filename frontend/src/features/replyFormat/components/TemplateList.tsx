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
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[#e2e8f0]">{title}</div>
        <Button onClick={onCreate} loading={creating} className="px-3 py-1 text-xs">
          {btnNew}
        </Button>
      </div>
      <div className="flex flex-col gap-2 max-h-[420px] overflow-auto pr-1">
        {templates.length === 0 ? (
          <div className="text-xs text-[#64748b]">{noTemplates}</div>
        ) : (
          templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl.id)}
              className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                selectedId === tpl.id
                  ? 'border-[#3b82f6] bg-[#0b1220]'
                  : 'border-[#2d3748] bg-[#0b0e14] hover:bg-[#0f172a]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-[#e2e8f0] truncate">{tpl.name}</div>
                {(tpl.is_default || defaultTemplateId === tpl.id) && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e293b] text-[#93c5fd] border border-[#334155]">
                    {defaultLabel}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#64748b] mt-1 truncate">
                {tpl.body_template.replaceAll('\n', ' ').slice(0, 80)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

