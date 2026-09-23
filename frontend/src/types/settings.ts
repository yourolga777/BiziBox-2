export interface Settings {
  telegram_poll_interval: number
  email_poll_interval: number
  theme: 'light' | 'dark'
  [key: string]: unknown
}

export interface SettingsUpdate {
  values: Record<string, unknown>
}

