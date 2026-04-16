export interface NavItemConfig {
  to: string
  key: string
  adminOnly: boolean
  end?: boolean
}

export const NAV_CONFIG: NavItemConfig[] = [
  { to: '/home', key: 'nav.home', adminOnly: false },
  { to: '/help', key: 'nav.help', adminOnly: false },
  { to: '/skill', key: 'nav.skill', adminOnly: false },
  { to: '/users', key: 'nav.users', adminOnly: true },
  { to: '/settings', key: 'nav.settings', adminOnly: false, end: true },
  { to: '/settings/reply-format', key: 'nav.reply_format', adminOnly: false },
  { to: '/prompts', key: 'nav.prompts', adminOnly: true },
  { to: '/debug', key: 'nav.debug', adminOnly: true },
]
