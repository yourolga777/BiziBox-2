import { Mail, MessageSquare, Phone, type LucideIcon } from 'lucide-react'

export const channelIcons: Record<string, LucideIcon> = {
  telegram: MessageSquare,
  email: Mail,
  phone: Phone,
}

export function getChannelIcon(channel: string | null | undefined): LucideIcon {
  if (!channel) return MessageSquare
  return channelIcons[channel] || MessageSquare
}
