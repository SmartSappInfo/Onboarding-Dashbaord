'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Eye,
  Users,
  Play,
  CheckCircle2,
  RotateCcw,
  MousePointerClick,
  Mail,
  Smartphone,
  MessageSquare,
  QrCode,
  Globe,
  User,
} from 'lucide-react';
import type {
  CustomPageStats,
  CustomPageEventWithEntity,
  PageEventType,
  PageEventChannel,
} from '@/lib/types';
import type { CustomPageAnalyticsResult } from '@/lib/custom-page-analytics-actions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  slug: string;
  data: CustomPageAnalyticsResult;
}

// ─── KPI stat card ────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  highlight?: boolean;
  subLabel?: string;
}

function StatCard({ label, value, icon: Icon, highlight, subLabel }: StatCardProps) {
  return (
    <div
      className={`flex flex-col gap-2 p-5 rounded-2xl border ${
        highlight
          ? 'border-blue-200 bg-blue-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon
          className={`h-4 w-4 ${highlight ? 'text-blue-500' : 'text-slate-400'}`}
        />
        {subLabel && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {subLabel}
          </span>
        )}
      </div>
      <p
        className={`text-3xl font-bold tabular-nums ${
          highlight ? 'text-blue-700' : 'text-slate-900'
        }`}
      >
        {(value ?? 0).toLocaleString()}
      </p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

// ─── Channel badge ────────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<
  PageEventChannel,
  { label: string; icon: React.ElementType; className: string }
> = {
  email: { label: 'Email', icon: Mail, className: 'bg-blue-50 text-blue-700 border-blue-100' },
  sms: { label: 'SMS', icon: Smartphone, className: 'bg-green-50 text-green-700 border-green-100' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  qr: { label: 'QR Code', icon: QrCode, className: 'bg-purple-50 text-purple-700 border-purple-100' },
  direct: { label: 'Direct', icon: Globe, className: 'bg-slate-50 text-slate-600 border-slate-100' },
};

function ChannelBadge({ channel }: { channel: PageEventChannel }) {
  const config = CHANNEL_CONFIG[channel] ?? CHANNEL_CONFIG.direct;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ─── Event icon ───────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<PageEventType, { icon: React.ElementType; label: string; className: string }> = {
  page_view: { icon: Eye, label: 'Viewed', className: 'text-slate-400' },
  video_start: { icon: Play, label: 'Played', className: 'text-blue-500' },
  video_complete: { icon: CheckCircle2, label: 'Completed', className: 'text-emerald-500' },
  video_replay: { icon: RotateCcw, label: 'Replayed', className: 'text-amber-500' },
  cta_click: { icon: MousePointerClick, label: 'CTA Click', className: 'text-rose-500' },
};

function EventBadge({ type }: { type: PageEventType }) {
  const config = EVENT_CONFIG[type];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

// ─── Known contacts table ─────────────────────────────────────────────────────

function ContactsTable({ events }: { events: CustomPageEventWithEntity[] }) {
  // Group events by entityId to build a per-contact timeline
  const contactRows = useMemo(() => {
    const map = new Map<
      string,
      {
        entityId: string;
        displayName: string;
        channel: PageEventChannel;
        firstSeen: string;
        eventTypes: Set<PageEventType>;
      }
    >();

    events
      .filter((e) => e.entityId)
      .forEach((e) => {
        const id = e.entityId as string;
        if (!map.has(id)) {
          map.set(id, {
            entityId: id,
            displayName: e.entityDisplayName ?? id,
            channel: e.channel,
            firstSeen: e.timestamp,
            eventTypes: new Set(),
          });
        }
        const row = map.get(id)!;
        row.eventTypes.add(e.type);
        // Keep the earliest timestamp
        if (e.timestamp < row.firstSeen) {
          row.firstSeen = e.timestamp;
        }
      });

    return [...map.values()].sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
  }, [events]);

  if (contactRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <User className="h-8 w-8 text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">No identified contacts yet.</p>
        <p className="text-xs text-slate-400 mt-1">
          Contacts appear here when they arrive via a tracked email link.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wide">
              Contact
            </th>
            <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wide">
              Channel
            </th>
            <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wide">
              First Visit
            </th>
            <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {contactRows.map((row) => (
            <tr key={row.entityId} className="hover:bg-slate-50 transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">
                      {row.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium text-slate-900 truncate max-w-[180px]">
                    {row.displayName}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4">
                <ChannelBadge channel={row.channel} />
              </td>
              <td className="py-3 px-4 text-slate-500 text-xs">
                {new Date(row.firstSeen).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {(['page_view', 'video_start', 'video_complete', 'video_replay', 'cta_click'] as PageEventType[]).map(
                    (type) =>
                      row.eventTypes.has(type) ? (
                        <EventBadge key={type} type={type} />
                      ) : null
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AnalyticsDrilldownClient({ slug, data }: Props) {
  const { stats, recentEvents, anonymousCount, totalKnownContacts } = data;

  const completionRate =
    stats.videoStarts > 0
      ? Math.round((stats.videoCompletions / stats.videoStarts) * 100)
      : 0;

  const ctaConversionRate =
    stats.uniqueViews > 0
      ? Math.round((stats.ctaClicks / stats.uniqueViews) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Views" value={stats.views} icon={Eye} />
        <StatCard label="Unique Visitors" value={stats.uniqueViews} icon={Users} highlight />
        <StatCard label="Video Plays" value={stats.videoStarts} icon={Play} />
        <StatCard
          label="Completions"
          value={stats.videoCompletions}
          icon={CheckCircle2}
          subLabel={completionRate > 0 ? `${completionRate}%` : undefined}
        />
        <StatCard label="Replays" value={stats.videoReplays} icon={RotateCcw} />
        <StatCard
          label="CTA Clicks"
          value={stats.ctaClicks}
          icon={MousePointerClick}
          subLabel={ctaConversionRate > 0 ? `${ctaConversionRate}%` : undefined}
        />
      </div>

      {/* Known contacts panel */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Known Contacts</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalKnownContacts} identified &middot; {anonymousCount} anonymous
            </p>
          </div>
          <Link
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            View page ↗
          </Link>
        </div>
        <ContactsTable events={recentEvents} />
        {recentEvents.length >= 100 && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 text-center">
            Showing most recent 100 events. Full export coming soon.
          </div>
        )}
      </div>
    </div>
  );
}
