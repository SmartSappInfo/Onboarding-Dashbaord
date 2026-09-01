'use client';

/**
 * ARCHITECTURE:
 * Creative Publishing Center Client (Phase 8 - Multi-Platform Distribution)
 * 
 * Manages active multi-platform syndications, scheduled publication queues,
 * and connected social media channel accounts.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import type {
  PublicationRecord,
  ConnectedChannel,
  PublishingChannel,
} from '@/lib/creative/creative-types';
import { CHANNEL_SPECS } from '@/lib/creative/creative-publishing-engine';
import { Button } from '@/components/ui/button';
import {
  Globe,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Youtube,
  Facebook,
  Instagram,
  Linkedin,
  Zap,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CHANNEL_ICONS: Record<PublishingChannel, React.ComponentType<{ className?: string }>> = {
  youtube: Youtube,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  crm_asset: Zap,
};

interface PublishingClientProps {
  initialPublications: PublicationRecord[];
  initialChannels: ConnectedChannel[];
}

export function PublishingClient({
  initialPublications,
  initialChannels,
}: PublishingClientProps) {
  const [publications] = useState<PublicationRecord[]>(initialPublications);
  const [channels] = useState<ConnectedChannel[]>(initialChannels);
  const [activeTab, setActiveTab] = useState<'history' | 'channels'>('history');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/creative-studio/projects"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white">Publishing & Distribution Center</h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Monitor multi-platform syndications, scheduled queue timeline, and connected marketing accounts.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97]',
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Syndication History & Queue ({publications.length})
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={cn(
              'px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97]',
              activeTab === 'channels'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Connected Channels ({channels.length})
          </button>
        </div>
      </div>

      {activeTab === 'history' ? (
        /* History & Queue View */
        publications.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-slate-850 bg-slate-900/20 space-y-3">
            <div className="text-sm font-bold text-slate-300">No publications dispatched yet</div>
            <p className="text-xs text-slate-500">
              Open any approved visual in the editor and click &quot;Publish&quot; to syndicate to YouTube, Facebook, or LinkedIn.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publications.map((pub) => {
              const spec = CHANNEL_SPECS[pub.channel];
              const Icon = CHANNEL_ICONS[pub.channel];

              return (
                <div
                  key={pub.id}
                  className="p-5 rounded-3xl border border-slate-850 bg-slate-900/60 flex flex-col justify-between space-y-4 shadow-xl hover:border-slate-700 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          style={{ backgroundColor: `${spec.brandColor}20`, color: spec.brandColor }}
                          className="p-2 rounded-xl border border-slate-800"
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white">{spec.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                            {pub.targetIdentifier}
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider flex items-center gap-1',
                          pub.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : pub.status === 'scheduled'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        )}
                      >
                        {pub.status === 'published' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Calendar className="w-3 h-3" />
                        )}
                        {pub.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div>
                        <span className="text-slate-500">Author:</span> {pub.authorName}
                      </div>
                      <div>
                        <span className="text-slate-500">
                          {pub.status === 'published' ? 'Published:' : 'Scheduled for:'}
                        </span>{' '}
                        {new Date(pub.publishedAt || pub.scheduledFor || pub.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {pub.platformPostUrl && (
                    <div className="pt-2 border-t border-slate-850">
                      <a
                        href={pub.platformPostUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-900 active:scale-[0.98]"
                      >
                        <ExternalLink className="w-3 h-3" /> View on {spec.name}
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Connected Accounts View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {channels.map((ch) => {
            const spec = CHANNEL_SPECS[ch.channel];
            const Icon = CHANNEL_ICONS[ch.channel];

            return (
              <div
                key={ch.id}
                className="p-5 rounded-3xl border border-slate-850 bg-slate-900/60 flex items-center justify-between gap-4 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: `${spec.brandColor}20`, color: spec.brandColor }}
                    className="p-3 rounded-2xl border border-slate-800"
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{ch.accountName}</h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                      <span>Connected & Synced</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold border-slate-800 bg-slate-950 text-slate-300 hover:text-white rounded-xl"
                >
                  Manage
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
