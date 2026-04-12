import React from 'react'
import type { Control } from 'react-hook-form'
import { Card } from '../../../components/common/Card'
import { FormInput } from '../../../components/common/form/FormInput'
import { FormSelect } from '../../../components/common/form/FormSelect'
import { useI18n } from '../../../i18n/useI18n'
import type { SettingsFormInput } from '../types'

interface GmailSettingsProps {
  control: Control<SettingsFormInput>
}

const POLL_QUERIES: [string, string][] = [
  ['is:unread in:inbox', 'opt.GMAIL_POLL_QUERY.inbox'],
  ['is:unread in:inbox -category:promotions', 'opt.GMAIL_POLL_QUERY.inbox_no_promo'],
  ['is:unread in:inbox -category:promotions -category:social', 'opt.GMAIL_POLL_QUERY.inbox_no_promo_social'],
  ['is:unread in:inbox -category:promotions -category:social -category:updates', 'opt.GMAIL_POLL_QUERY.inbox_no_promo_social_updates'],
  ['is:unread', 'opt.GMAIL_POLL_QUERY.all_unread'],
]

export const GmailSettings: React.FC<GmailSettingsProps> = ({ control }) => {
  const { t } = useI18n()

  return (
    <Card title={t('card.gmail')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormSelect
          name="min_priority"
          control={control}
          label={t('users.min_priority')}
          options={[
            { label: t('opt.priority.high'), value: 'high' },
            { label: t('opt.priority.medium'), value: 'medium' },
            { label: t('opt.priority.low'), value: 'low' },
          ]}
        />
        <FormInput
          name="max_emails_per_run"
          control={control}
          label={t('users.max_emails')}
          type="number"
          min={1}
          max={100}
        />
        <FormInput
          name="poll_interval"
          control={control}
          label={t('users.poll_interval')}
          type="number"
          min={60}
          step={60}
        />
        <FormSelect
          name="GMAIL_MARK_READ"
          control={control}
          label={t('label.GMAIL_MARK_READ')}
          options={[
            { label: t('opt.GMAIL_MARK_READ.true'), value: 'true' },
            { label: t('opt.GMAIL_MARK_READ.false'), value: 'false' },
          ]}
        />
        <FormSelect
          name="GMAIL_POLL_QUERY"
          control={control}
          label={t('label.GMAIL_POLL_QUERY')}
          className="col-span-full"
          options={POLL_QUERIES.map(([value, key]) => ({ label: t(key), value }))}
        />
      </div>
    </Card>
  )
}
