import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../i18n/useI18n'
import { getMe, getPersonaConfig, savePersonaConfigItem, type PersonaConfigData } from '../api'

// ── Static category definitions ───────────────────────────────────

const ZODIAC_ITEMS = [
    { key: 'aries',       emoji: '♈', zh: '白羊座', en: 'Aries' },
    { key: 'taurus',      emoji: '♉', zh: '金牛座', en: 'Taurus' },
    { key: 'gemini',      emoji: '♊', zh: '双子座', en: 'Gemini' },
    { key: 'cancer',      emoji: '♋', zh: '巨蟹座', en: 'Cancer' },
    { key: 'leo',         emoji: '♌', zh: '狮子座', en: 'Leo' },
    { key: 'virgo',       emoji: '♍', zh: '处女座', en: 'Virgo' },
    { key: 'libra',       emoji: '♎', zh: '天秤座', en: 'Libra' },
    { key: 'scorpio',     emoji: '♏', zh: '天蝎座', en: 'Scorpio' },
    { key: 'sagittarius', emoji: '♐', zh: '射手座', en: 'Sagittarius' },
    { key: 'capricorn',   emoji: '♑', zh: '摩羯座', en: 'Capricorn' },
    { key: 'aquarius',    emoji: '♒', zh: '水瓶座', en: 'Aquarius' },
    { key: 'pisces',      emoji: '♓', zh: '双鱼座', en: 'Pisces' },
]

const CHINESE_ZODIAC_ITEMS = [
    { key: 'rat',     emoji: '🐭', zh: '鼠',  en: 'Rat' },
    { key: 'ox',      emoji: '🐮', zh: '牛',  en: 'Ox' },
    { key: 'tiger',   emoji: '🐯', zh: '虎',  en: 'Tiger' },
    { key: 'rabbit',  emoji: '🐰', zh: '兔',  en: 'Rabbit' },
    { key: 'dragon',  emoji: '🐲', zh: '龙',  en: 'Dragon' },
    { key: 'snake',   emoji: '🐍', zh: '蛇',  en: 'Snake' },
    { key: 'horse',   emoji: '🐴', zh: '马',  en: 'Horse' },
    { key: 'goat',    emoji: '🐑', zh: '羊',  en: 'Goat' },
    { key: 'monkey',  emoji: '🐵', zh: '猴',  en: 'Monkey' },
    { key: 'rooster', emoji: '🐔', zh: '鸡',  en: 'Rooster' },
    { key: 'dog',     emoji: '🐶', zh: '狗',  en: 'Dog' },
    { key: 'pig',     emoji: '🐷', zh: '猪',  en: 'Pig' },
]

const GENDER_ITEMS = [
    { key: 'male',   emoji: '♂️', zh: '男性', en: 'Male' },
    { key: 'female', emoji: '♀️', zh: '女性', en: 'Female' },
    { key: 'other',  emoji: '⚧',  zh: '其他', en: 'Other' },
]

type TabKey = 'zodiac' | 'chinese_zodiac' | 'gender'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-[#1e2330] border border-[#2d3748] rounded-xl p-5 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[#cbd5e1]">{title}</h2>
            {children}
        </div>
    )
}

interface ItemCardProps {
    category: string
    itemKey: string
    emoji: string
    label: string
    initialContent: string
    onSaved: () => void
}

function ItemCard({ category, itemKey, emoji, label, initialContent, onSaved }: ItemCardProps) {
    const { t } = useI18n()
    const [content, setContent] = useState(initialContent)
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

    useEffect(() => { setContent(initialContent) }, [initialContent])

    const handleSave = async () => {
        setStatus('saving')
        try {
            await savePersonaConfigItem(category, itemKey, content)
            setStatus('saved')
            onSaved()
            setTimeout(() => setStatus('idle'), 2500)
        } catch {
            setStatus('error')
            setTimeout(() => setStatus('idle'), 3000)
        }
    }

    return (
        <div className="bg-[#0b0e14] border border-[#2d3748] rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span className="text-base">{emoji}</span>
                <span className="text-sm font-semibold text-[#e2e8f0]">{label}</span>
            </div>
            <textarea
                rows={4}
                value={content}
                onChange={e => { setContent(e.target.value); setStatus('idle') }}
                placeholder={t('persona_config.placeholder')}
                className="bg-[#111827] border border-[#1f2937] rounded-md px-2.5 py-2 text-xs text-[#e2e8f0] placeholder-[#374151] resize-none focus:outline-none focus:border-[#475569] font-mono leading-relaxed"
            />
            <div className="flex items-center justify-between">
                <button
                    onClick={handleSave}
                    disabled={status === 'saving'}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 bg-[#1d4ed8] hover:bg-[#1e40af] text-white"
                >
                    {status === 'saving' ? t('persona_config.saving') : t('persona_config.btn_save')}
                </button>
                {status === 'saved' && <span className="text-xs text-[#86efac]">{t('persona_config.saved')}</span>}
                {status === 'error' && <span className="text-xs text-[#fca5a5]">{t('persona_config.save_error')}</span>}
            </div>
        </div>
    )
}

export default function PersonaConfig() {
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
            <div className="p-8 flex flex-col items-center justify-center gap-3">
                <p className="text-[#fca5a5] font-semibold">{t('error.admin_only')}</p>
                <p className="text-xs text-[#64748b]">{t('error.admin_only_hint')}</p>
            </div>
        )
    }

    const labelFor = (item: { zh: string; en: string }) => lang === 'zh' ? item.zh : item.en

    const TABS: { key: TabKey; label: string; items: typeof ZODIAC_ITEMS }[] = [
        { key: 'zodiac',          label: t('persona_config.tab.zodiac'),          items: ZODIAC_ITEMS },
        { key: 'chinese_zodiac',  label: t('persona_config.tab.chinese_zodiac'),  items: CHINESE_ZODIAC_ITEMS },
        { key: 'gender',          label: t('persona_config.tab.gender'),           items: GENDER_ITEMS },
    ]

    const activeItems = TABS.find(tb => tb.key === tab)?.items ?? []
    const categoryData = configData?.[tab] ?? {}

    return (
        <div className="flex flex-col h-full p-5 gap-4 min-w-0">
            {/* Header */}
            <div>
                <h1 className="text-lg font-bold text-[#e2e8f0]">{t('persona_config.page_title')}</h1>
                <p className="text-xs text-[#64748b] mt-1">{t('persona_config.page_desc')}</p>
            </div>

            <Card title="">
                {/* Tabs */}
                <div className="flex gap-1 border-b border-[#2d3748] pb-0 -mb-3">
                    {TABS.map(tb => (
                        <button
                            key={tb.key}
                            onClick={() => setTab(tb.key)}
                            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                                tab === tb.key
                                    ? 'bg-[#1e2330] text-[#60a5fa] border border-b-0 border-[#2d3748]'
                                    : 'text-[#64748b] hover:text-[#94a3b8]'
                            }`}
                        >
                            {tb.label}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <p className="text-xs text-[#475569] py-6 text-center">{t('prompts.loading')}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
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
