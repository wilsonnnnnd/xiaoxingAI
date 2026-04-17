type IconProps = {
  className?: string
}

export function GitHubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.48 0-.24-.01-.88-.01-1.72-2.78.62-3.37-1.36-3.37-1.36-.46-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.74-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05.8-.23 1.65-.34 2.5-.35.85.01 1.7.12 2.5.35 1.9-1.32 2.74-1.05 2.74-1.05.56 1.42.21 2.47.11 2.73.64.71 1.03 1.62 1.03 2.74 0 3.93-2.34 4.8-4.57 5.05.36.32.68.95.68 1.92 0 1.39-.01 2.5-.01 2.84 0 .27.18.59.69.48A10.07 10.07 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  )
}

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7H9.32V9h3.4v1.56h.05c.47-.9 1.63-1.86 3.35-1.86 3.58 0 4.24 2.36 4.24 5.44v6.31ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22 2H2C.9 2 0 2.9 0 4v16c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2Z" />
    </svg>
  )
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm7.93 9h-3.17a15.9 15.9 0 0 0-1.27-5.07A8.02 8.02 0 0 1 19.93 11ZM12 4c.9 0 2.25 2.04 3 7H9c.75-4.96 2.1-7 3-7ZM4.07 13h3.17c.22 1.8.69 3.53 1.27 5.07A8.02 8.02 0 0 1 4.07 13Zm3.17-2H4.07a8.02 8.02 0 0 1 4.44-5.07A15.9 15.9 0 0 0 7.24 11ZM12 20c-.9 0-2.25-2.04-3-7h6c-.75 4.96-2.1 7-3 7Zm3.49-1.93c.58-1.54 1.05-3.27 1.27-5.07h3.17a8.02 8.02 0 0 1-4.44 5.07Z" />
    </svg>
  )
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.2-8 5-8-5V6l8 5 8-5v2.2Z" />
    </svg>
  )
}
