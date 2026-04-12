import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../../../i18n/useI18n'
import { Card } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { getMe } from '../../auth/api'
import { getPersonaConfig, savePersonaConfigItem } from '../api'
import type { PersonaConfigData } from '../../../types'
import toast from 'react-hot-toast'

// ── Static category definitions ───────────────────────────────────

const ZODIAC_ITEMS = [
    { key: 'aries', emoji: '♈', zh: '白羊座', en: 'Aries' },
    { key: 'taurus', emoji: '♉', zh: '金牛座', en: 'Taurus' },
    { key: 'gemini', emoji: '♊', zh: '双子座', en: 'Gemini' },
    { key: 'cancer', emoji: '♋', zh: '巨蟹座', en: 'Cancer' },
    { key: 'leo', emoji: '♌', zh: '狮子座', en: 'Leo' },
    { key: 'virgo', emoji: '♍', zh: '处女座', en: 'Virgo' },
    { key: 'libra', emoji: '♎', zh: '天秤座', en: 'Libra' },
    { key: 'scorpio', emoji: '♏', zh: '天蝎座', en: 'Scorpio' },
    { key: 'sagittarius', emoji: '♐', zh: '射手座', en: 'Sagittarius' },
    { key: 'capricorn', emoji: '♑', zh: '摩羯座', en: 'Capricorn' },
    { key: 'aquarius', emoji: '♒', zh: '水瓶座', en: 'Aquarius' },
    { key: 'pisces', emoji: '♓', zh: '双鱼座', en: 'Pisces' },
]

const CHINESE_ZODIAC_ITEMS = [
    { key: 'rat', emoji: '🐭', zh: '鼠', en: 'Rat' },
    { key: 'ox', emoji: '🐮', zh: '牛', en: 'Ox' },
    { key: 'tiger', emoji: '🐯', zh: '虎', en: 'Tiger' },
    { key: 'rabbit', emoji: '🐰', zh: '兔', en: 'Rabbit' },
    { key: 'dragon', emoji: '🐲', zh: '龙', en: 'Dragon' },
    { key: 'snake', emoji: '🐍', zh: '蛇', en: 'Snake' },
    { key: 'horse', emoji: '🐴', zh: '马', en: 'Horse' },
    { key: 'goat', emoji: '🐑', zh: '羊', en: 'Goat' },
    { key: 'monkey', emoji: '🐵', zh: '猴', en: 'Monkey' },
    { key: 'rooster', emoji: '🐔', zh: '鸡', en: 'Rooster' },
    { key: 'dog', emoji: '🐶', zh: '狗', en: 'Dog' },
    { key: 'pig', emoji: '🐷', zh: '猪', en: 'Pig' },
]

const GENDER_ITEMS = [
    { key: 'male', emoji: '♂️', zh: '男性', en: 'Male' },
    { key: 'female', emoji: '♀️', zh: '女性', en: 'Female' },
    { key: 'other', emoji: '⚧', zh: '其他', en: 'Other' },
]

type TabKey = 'zodiac' | 'chinese_zodiac' | 'gender'

interface ItemCardProps {
    category: string
    itemKey: string
    emoji: string
    label: string
    initialContent: string
    onSaved: () => void
}

const ItemCard: React.FC<ItemCardProps> = ({ category, itemKey, emoji, label, initialContent, onSaved }) => {
    const { t } = useI18n()
    const [content, setContent] = useState(initialContent)
    const [saving, setSaving] = useState(false)

    useEffect(() => { setContent(initialContent) }, [initialContent])

    const handleSave = async () => {
        setSaving(true)
        try {
            await savePersonaConfigItem(category, itemKey, content)
            toast.success(`${label} ${t('persona_config.saved')}`)
            onSaved()
        } catch {
            /* handled globally */
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <span className="text-xl">{emoji}</span>
                <span className="text-sm font-semibold text-[#e2e8f0]">{label}</span>
            </div>
            <InputField
                label=""
                multi
                rows={4}
                value={content}
                onChange={(v) => setContent(v)}
                placeholder={t('persona_config.placeholder')}
                className="font-mono text-xs leading-relaxed"
            />
            <Button
                onClick={handleSave}
                loading={saving}
                disabled={content === initialContent}
                className="self-end px-4 py-1 text-xs"
            >
                {t('persona_config.btn_save')}
            </Button>
        </div>
    )
}

export const PersonaConfigPage: React.FC = () => {
    const { t, lang } = useI18n()
    const qc = useQueryClient()
    const [tab, setTab] = useState<TabKey>('zodiac')

    const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: 120_000 })
    const isAdmin = me?.role === 'admin'

    const { data: configData, isLoading } = useQuery<PersonaConfigData>({
        queryKey: ['personaConfig'],
        queryFn: getPersonaConfig,
        enabled: isAdmin === true,
        staleTime: 30_000,
    })

    if (me && !isAdmin) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="text-4xl">🔒</div>
                <p className="text-lg font-semibold text-[#e2e8f0]">{t('error.admin_only')}</p>
                <p className="text-sm text-[#64748b]">{t('error.admin_only_hint')}</p>
            </div>
        )
    }

    const labelFor = (item: { zh: string; en: string }) => lang === 'zh' ? item.zh : item.en

    const TABS: { key: TabKey; label: string; items: typeof ZODIAC_ITEMS }[] = [
        { key: 'zodiac', label: t('persona_config.tab.zodiac'), items: ZODIAC_ITEMS },
        { key: 'chinese_zodiac', label: t('persona_config.tab.chinese_zodiac'), items: CHINESE_ZODIAC_ITEMS },
        { key: 'gender', label: t('persona_config.tab.gender'), items: GENDER_ITEMS },
    ]

    const activeItems = TABS.find(tb => tb.key === tab)?.items ?? []
    const categoryData = configData?.[tab] ?? {}

    return (
        <div className="flex flex-col h-full p-5 gap-6 min-w-0 max-w-6xl mx-auto w-full">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{t('persona_config.page_title')}</h1>
                <p className="text-sm text-[#64748b] mt-1">{t('persona_config.page_desc')}</p>
            </div>

            <Card title="">
                {/* Tabs */}
                <div className="flex gap-1 border-b border-[#2d3748] pb-0 mb-4 overflow-x-auto">
                    {TABS.map(tb => (
                        <button
                            key={tb.key}
                            onClick={() => setTab(tb.key)}
                            className={`px-6 py-2.5 text-sm font-medium transition-all relative ${tab === tb.key
                                    ? 'text-[#60a5fa]'
                                    : 'text-[#64748b] hover:text-[#94a3b8]'
                                }`}
                        >
                            {tb.label}
                            {tab === tb.key && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#60a5fa] rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-sm text-[#475569]">{t('prompts.loading')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {activeItems.map(item => (
                            <ItemCard
                                key={item.key}
                                category={tab}
                                itemKey={item.key}
                                emoji={item.emoji}
                                label={labelFor(item)}
                                initialContent={categoryData[item.key] ?? ''}
                                onSaved={() => qc.invalidateQueries({ queryKey: ['personaConfig'] })}
                            />
                        ))}
                    </div>
                )}
            </Card>
        </div>
    )
}


