export type AppRole = 'admin' | 'user'

export type NavSection = 'main' | 'settings' | 'admin' | 'support' | 'legal'

export type NavItem = {
  id: string
  labelKey: string
  path?: string
  section?: NavSection
  roles: AppRole[]
  children?: NavItem[]
  end?: boolean
}

export const NAV_SECTIONS: NavSection[] = ['main', 'settings', 'admin', 'support', 'legal']

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    labelKey: 'nav.home',
    path: '/home',
    section: 'main',
    roles: ['admin', 'user'],
  },
  {
    id: 'inbox',
    labelKey: 'nav.inbox',
    path: '/inbox',
    section: 'main',
    roles: ['admin', 'user'],
  },
  {
    id: 'skills',
    labelKey: 'nav.skill',
    path: '/skill',
    section: 'main',
    roles: ['admin', 'user'],
    children: [
      { id: 'skills_gmail', labelKey: 'nav.skill.gmail', path: '/skill/gmail', roles: ['admin', 'user'] },
    ],
  },
  {
    id: 'reply_format',
    labelKey: 'nav.reply_format',
    path: '/settings/reply-format',
    section: 'settings',
    roles: ['admin', 'user'],
  },
  {
    id: 'automation_rules',
    labelKey: 'nav.automation_rules',
    path: '/settings/automation-rules',
    section: 'settings',
    roles: ['admin', 'user'],
  },
  {
    id: 'users',
    labelKey: 'nav.users',
    path: '/users',
    section: 'admin',
    roles: ['admin'],
  },
  {
    id: 'prompts',
    labelKey: 'nav.prompts',
    path: '/prompts',
    section: 'admin',
    roles: ['admin'],
  },
  {
    id: 'debug',
    labelKey: 'nav.debug',
    path: '/debug',
    section: 'admin',
    roles: ['admin'],
  },
  {
    id: 'help',
    labelKey: 'nav.help',
    path: '/help',
    section: 'support',
    roles: ['admin', 'user'],
  },
  {
    id: 'privacy',
    labelKey: 'nav.privacy',
    path: '/privacy',
    section: 'legal',
    roles: ['admin', 'user'],
  },
  {
    id: 'terms',
    labelKey: 'nav.terms',
    path: '/terms',
    section: 'legal',
    roles: ['admin', 'user'],
  },
]

export function filterNavByRole(items: NavItem[], role: AppRole): NavItem[] {
  const out: NavItem[] = []

  for (const item of items) {
    const childItems = item.children ? filterNavByRole(item.children, role) : undefined
    const allowed = item.roles.includes(role)

    if (!allowed && (!childItems || childItems.length === 0)) continue

    out.push({
      ...item,
      children: childItems && childItems.length > 0 ? childItems : undefined,
    })
  }

  return out
}

