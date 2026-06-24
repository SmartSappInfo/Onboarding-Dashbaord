/**
 * @fileOverview Single source of truth for per-channel visual identity (icon,
 * colors, labels). Shared by the templates gallery and the messaging template
 * selector so adding a channel is a one-line map edit. Pure data.
 */
import { Mail, Smartphone, MessageCircle, type LucideIcon } from 'lucide-react';

export type KnownChannel = 'email' | 'sms' | 'whatsapp';

export interface ChannelMeta {
  Icon: LucideIcon;
  /** Badge/chip classes. */
  chip: string;
  /** Icon-wrapper classes. */
  iconWrap: string;
  label: string;
  /** Heading used when grouping by channel. */
  group: string;
}

export const CHANNEL_META: Record<KnownChannel, ChannelMeta> = {
  email: {
    Icon: Mail,
    chip: 'bg-blue-500/5 text-blue-500 border-blue-200',
    iconWrap: 'bg-blue-500/10 text-blue-500 border-blue-100',
    label: 'Email',
    group: 'Email Templates',
  },
  sms: {
    Icon: Smartphone,
    chip: 'bg-orange-500/5 text-orange-500 border-orange-200',
    iconWrap: 'bg-orange-500/10 text-orange-500 border-orange-100',
    label: 'SMS',
    group: 'SMS Templates',
  },
  whatsapp: {
    Icon: MessageCircle,
    chip: 'bg-emerald-500/5 text-emerald-600 border-emerald-200',
    iconWrap: 'bg-emerald-500/10 text-emerald-600 border-emerald-100',
    label: 'WhatsApp',
    group: 'WhatsApp Templates',
  },
};

/** Resolve channel identity, falling back to email for unknown channels. */
export function channelMeta(channel: string): ChannelMeta {
  return CHANNEL_META[channel as KnownChannel] ?? CHANNEL_META.email;
}
