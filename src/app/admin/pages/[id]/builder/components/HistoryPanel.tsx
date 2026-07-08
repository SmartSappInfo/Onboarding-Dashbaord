'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, FolderHeart, Loader2, Sparkles, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignPageVersion, PageSectionTemplate } from '@/lib/types';

interface HistoryPanelProps {
    readonly versions: CampaignPageVersion[];
    readonly currentVersionId: string | null;
    readonly savedSections: PageSectionTemplate[];
    readonly isRestoring: boolean;
    readonly onRestoreVersion: (version: CampaignPageVersion) => void;
    readonly onAddSectionFromTemplate: (template: PageSectionTemplate) => void;
}
const STATIC_HOMEPAGE_SECTIONS: Omit<PageSectionTemplate, 'workspaceId' | 'createdAt'>[] = [
  {
    id: 'tpl-home-hero',
    organizationId: '',
    name: 'Welcome Video Hero',
    category: 'homepage',
    structure: {
      id: 'home-hero-sec',
      type: 'section',
      props: {
        paddingTop: '0rem',
        paddingBottom: '0rem',
        paddingLeft: '0rem',
        paddingRight: '0rem',
      },
      blocks: [
        {
          id: 'home-hero-blk',
          type: 'video_hero',
          props: {
            heading: 'Streamlined Onboarding for Schools & Teams',
            subheading: 'Register profiles, collect agreements, and launch automated workflows in minutes.',
            videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-his-computer-34354-large.mp4',
            loop: true,
            muted: true,
            overlayOpacity: 0.7,
            ctaText: 'Start Onboarding Now',
            ctaHref: '#persona-selector',
            secondaryCtaText: 'Download Mobile App',
            secondaryCtaHref: '#downloads',
          }
        }
      ]
    }
  },
  {
    id: 'tpl-home-countdown',
    organizationId: '',
    name: 'Onboarding Countdown',
    category: 'homepage',
    structure: {
      id: 'home-countdown-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#070a13',
        paddingTop: '3rem',
        paddingBottom: '3rem',
      },
      blocks: [
        {
          id: 'home-countdown-blk',
          type: 'countdown',
          props: {
            targetDate: '2026-12-31T23:59:59Z',
            heading: 'Limited Registration Period',
            subtext: 'Secure your team seat and complete onboarding setup before the system window closes.',
            theme: 'accent',
            showDays: true,
            showHours: true,
            showMinutes: true,
            showSeconds: true,
          }
        }
      ]
    }
  },
  {
    id: 'tpl-home-personas',
    organizationId: '',
    name: 'Persona Choice Cards',
    category: 'homepage',
    structure: {
      id: 'home-personas-sec',
      type: 'section',
      props: {
        backgroundType: 'gradient',
        gradientFrom: '#0A1427',
        gradientTo: '#070A13',
        gradientAngle: 180,
        paddingTop: '4rem',
        paddingBottom: '4rem',
      },
      blocks: [
        {
          id: 'home-personas-blk',
          type: 'choice_cards',
          props: {
            heading: 'Identify Your Persona Track',
            columns: '2',
            cards: [
              {
                id: 'p1',
                badgeText: 'FOR OFFICIALS',
                title: 'School Administrator',
                description: 'Manage nominal rolls, verify teacher certifications, and coordinate class approvals.',
                imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
                gradient: 'from-emerald-950/80 to-slate-900/90',
                ctaText: 'Select Admin Track',
                ctaHref: '#modal-admin',
                openInModal: true,
              },
              {
                id: 'p2',
                badgeText: 'FOR STUDENTS & STAFF',
                title: 'General Signup / Nominee',
                description: 'Register credentials, review policies, and check onboarding compliance records.',
                imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644',
                gradient: 'from-blue-950/80 to-slate-900/90',
                ctaText: 'Select Nominee Track',
                ctaHref: '#modal-nominee',
                openInModal: true,
              }
            ]
          }
        }
      ]
    }
  },
  {
    id: 'tpl-home-steps',
    organizationId: '',
    name: 'Onboarding Steps Guide',
    category: 'homepage',
    structure: {
      id: 'home-steps-sec',
      type: 'section',
      props: {
        heading: 'Simple Onboarding Steps',
        backgroundType: 'color',
        backgroundColor: '#070a13',
        paddingTop: '4rem',
        paddingBottom: '4rem',
      },
      blocks: [
        {
          id: 'home-step1',
          type: 'step_section',
          props: {
            stepNumber: 1,
            heading: 'Account Enrollment',
            description: 'Enter organization details, verify identity parameters, and establish your tenant profile workspace.',
            imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
            mediaPosition: 'right',
            accentColor: '#10b981',
          }
        },
        {
          id: 'home-step2',
          type: 'step_section',
          props: {
            stepNumber: 2,
            heading: 'Policy Approvals',
            description: 'Digitally review and authorize compliance documents, nominal rolls, and usage agreements.',
            imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b',
            mediaPosition: 'left',
            accentColor: '#3b82f6',
          }
        }
      ]
    }
  },
  {
    id: 'tpl-home-testimonials',
    organizationId: '',
    name: 'Video Testimonials Grid',
    category: 'homepage',
    structure: {
      id: 'home-testimonials-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0A1427',
        paddingTop: '4rem',
        paddingBottom: '4rem',
      },
      blocks: [
        {
          id: 'home-testimonials-blk',
          type: 'testimonial_grid',
          props: {
            heading: 'Trusted by Operations Teams Everywhere',
            subheading: 'Listen to verified video responses detailing our fast migration metrics.',
            columns: '2',
            cardStyle: 'video-quote',
            items: [
              {
                id: 't1',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                quote: 'The automation triggers saved us over 40 hours of manual verification checks during rollout.',
                author: 'Ama K. Mensah',
                role: 'Registrar, Tech Academy',
              },
              {
                id: 't2',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                quote: 'Using persona choice cards cut our user registration drop-off rate by half.',
                author: 'Kofi Aidoo',
                role: 'Operations Director',
              }
            ]
          }
        }
      ]
    }
  },
  {
    id: 'tpl-home-downloads',
    organizationId: '',
    name: 'App Download Banner',
    category: 'homepage',
    structure: {
      id: 'home-downloads-sec',
      type: 'section',
      props: {
        paddingTop: '4rem',
        paddingBottom: '4rem',
      },
      blocks: [
        {
          id: 'home-downloads-blk',
          type: 'app_download',
          props: {
            heading: 'Take Onboarding On The Go',
            subtext: 'Scan nominal rosters, capture compliance photos, and execute signups anywhere using the SmartSapp mobile client.',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c',
            parallaxEnabled: true,
            overlayColor: '#070a13',
            overlayOpacity: 0.85,
            showAppStoreBadges: true,
            iosUrl: 'https://apps.apple.com',
            androidUrl: 'https://play.google.com',
          }
        }
      ]
    }
  }
];

const STATIC_TESTIMONIAL_SECTIONS: Omit<PageSectionTemplate, 'workspaceId' | 'createdAt'>[] = [
  {
    id: 'tpl-testimonial-parents',
    organizationId: '',
    name: 'Happy Parents Testimonials',
    category: 'testimonials',
    structure: {
      id: 'testimonial-parents-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0A1427',
        paddingTop: '4rem',
        paddingBottom: '4rem',
      },
      blocks: [
        {
          id: 'testimonial-parents-blk',
          type: 'testimonial_grid',
          props: {
            heading: 'Hear From Our Happy Parents',
            subheading: 'See what parents are saying about their experience with K.NAS.',
            columns: '3',
            cardStyle: 'video-quote',
            items: [
              {
                id: 'tp1',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                thumbnailUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
                badgeText: 'SATISFIED PARENTS',
                quote: 'My child is safe with top security, learning well, growing confident, responsible, and even praying over meals with joy.',
                author: "Ma'am Edlyn",
                avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2',
                role: 'Satisfied Parent',
              },
              {
                id: 'tp2',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
                badgeText: 'SATISFIED PARENTS',
                quote: 'Since joining KIS, my kids changed in behavior, learning, and faith. They now sing good songs, learn with joy, and live by Christian values.',
                author: 'Pastor Simpson',
                avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
                role: 'Satisfied Parent',
              },
              {
                id: 'tp3',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
                badgeText: 'SATISFIED PARENTS',
                quote: 'At K.NAS, small classes and caring teachers helped my child improve in reading, writing, and confidence through close attention.',
                author: 'Esi Kali',
                avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
                role: 'Satisfied Parent',
              }
            ]
          }
        }
      ]
    }
  }
];

export const HistoryPanel = React.memo(function HistoryPanel({
    versions, currentVersionId, savedSections, isRestoring,
    onRestoreVersion, onAddSectionFromTemplate
}: HistoryPanelProps) {
    const [filter, setFilter] = useState<'all' | 'homepage' | 'testimonials' | 'saved'>('all');

    // Combine static and custom saved sections
    const combined = [
        ...STATIC_HOMEPAGE_SECTIONS.map(s => ({
            ...s,
            workspaceId: '',
            createdAt: new Date().toISOString()
        } as PageSectionTemplate)),
        ...STATIC_TESTIMONIAL_SECTIONS.map(s => ({
            ...s,
            workspaceId: '',
            createdAt: new Date().toISOString()
        } as PageSectionTemplate)),
        ...savedSections
    ];

    const filtered = combined.filter((s) => {
        if (filter === 'homepage') return s.category === 'homepage';
        if (filter === 'testimonials') return s.category === 'testimonials';
        if (filter === 'saved') return s.category !== 'homepage' && s.category !== 'testimonials';
        return true;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Version History */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-amber-500/10 rounded-lg">
                        <History className="h-4 w-4 text-amber-400" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Version History</h4>
                </div>

                {versions.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {versions.map((v) => (
                            <div
                                key={v.id}
                                className={cn(
                                    "p-3 rounded-xl border transition-all duration-200 group",
                                    v.id === currentVersionId
                                        ? "bg-emerald-500/10 border-emerald-500/30"
                                        : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-200">
                                            v{v.versionNumber}
                                            {v.isPublishedVersion && (
                                                <Badge className="ml-2 text-[7px] h-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">LIVE</Badge>
                                            )}
                                            {v.id === currentVersionId && (
                                                <Badge className="ml-2 text-[7px] h-4 bg-violet-500/20 text-violet-400 border-violet-500/30">CURRENT</Badge>
                                            )}
                                        </p>
                                        <p className="text-[9px] text-slate-500 mt-0.5">
                                            {new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            {' · '}{v.structureJson.sections.length} section{v.structureJson.sections.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    {v.id !== currentVersionId && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={isRestoring}
                                            onClick={() => onRestoreVersion(v)}
                                            className="h-7 text-[9px] font-bold text-amber-400 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            {isRestoring ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Restore'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/30">
                        <History className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                        <p className="text-[10px] text-slate-500 font-medium">No versions saved yet</p>
                    </div>
                )}
            </section>

            {/* Section Library */}
            <section className="space-y-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-violet-500/10 rounded-lg">
                            <FolderHeart className="h-4 w-4 text-violet-400" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Section Library</h4>
                    </div>
                </div>

                {/* Filter Chips */}
                <div className="flex gap-1.5 pb-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('all')}
                        className={cn(
                            "h-6 px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                            filter === 'all' ? "bg-slate-700 text-emerald-400" : "text-slate-400 hover:text-slate-350"
                        )}
                    >
                        All ({combined.length})
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('homepage')}
                        className={cn(
                            "h-6 px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider gap-1",
                            filter === 'homepage' ? "bg-slate-700 text-emerald-400" : "text-slate-400 hover:text-slate-350"
                        )}
                    >
                        <Sparkles className="w-2.5 h-2.5" /> Homepage ({STATIC_HOMEPAGE_SECTIONS.length})
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('testimonials')}
                        className={cn(
                            "h-6 px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider gap-1",
                            filter === 'testimonials' ? "bg-slate-700 text-emerald-400" : "text-slate-400 hover:text-slate-350"
                        )}
                    >
                        <Quote className="w-2.5 h-2.5" /> Testimonials ({STATIC_TESTIMONIAL_SECTIONS.length})
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilter('saved')}
                        className={cn(
                            "h-6 px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                            filter === 'saved' ? "bg-slate-700 text-emerald-400" : "text-slate-400 hover:text-slate-350"
                        )}
                    >
                        Saved ({savedSections.length})
                    </Button>
                </div>

                {filtered.length > 0 ? (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {filtered.map(s => (
                            <div
                                key={s.id}
                                className="group p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-violet-500/20 cursor-pointer transition-all duration-200 flex items-center justify-between"
                                onClick={() => onAddSectionFromTemplate(s)}
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-bold text-slate-300 group-hover:text-violet-400 transition-colors">{s.name}</p>
                                    <p className="text-[9px] text-slate-500">
                                        {s.category === 'homepage' ? 'Homepage block' : s.category} · {s.structure.blocks.length} block{s.structure.blocks.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <Badge variant="outline" className="text-[7px] h-4 bg-slate-900 border-slate-700 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    + ADD
                                </Badge>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/30">
                        <FolderHeart className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-[10px] text-slate-500 font-medium px-4 leading-relaxed">No templates found in this category.</p>
                        {filter === 'saved' && <p className="text-[9px] text-slate-600 mt-1">Save sections from the canvas to reuse them.</p>}
                    </div>
                )}
            </section>
        </div>
    );
});

HistoryPanel.displayName = 'HistoryPanel';
export default HistoryPanel;
