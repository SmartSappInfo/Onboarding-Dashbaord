'use client';

/**
 * Shared Portal Spaces Grid Component (Single Source of Truth)
 *
 * Renders the authoritative Active Learning Spaces feature grid across both
 * the live customer runtime (`PortalRuntimeClient.tsx`) and the Studio visual
 * preview canvas (`PortalLivePreviewCanvas.tsx`).
 *
 * Rules:
 * - Strictly typed (Zero any / any[] / unknown).
 * - Matches 100% of live feature cards with theme styling and animated action links.
 * - Single Source of Truth preventing layout and content drift.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import {
  GraduationCap,
  Users,
  Award,
  FileCode,
  FolderArchive,
  Newspaper,
  ArrowRight,
} from 'lucide-react';
import type {
  PortalThemeConfig,
  PortalFeatureToggles,
} from '@/lib/types/portal';
import { usePortalTheme } from './PortalThemeProvider';

export interface PortalSpacesGridProps {
  slug: string;
  theme: PortalThemeConfig;
  features: PortalFeatureToggles;
  radiusCss: string;
  isPreview?: boolean;
  onNavigateRoute?: (route: '/' | '/learn' | '/community' | '/dashboard') => void;
}

export function PortalSpacesGrid({
  slug,
  theme: _theme,
  features,
  radiusCss,
  isPreview = false,
  onNavigateRoute,
}: PortalSpacesGridProps) {
  const { activeColors } = usePortalTheme();

  const renderCardWrapper = (
    href: string,
    routeTarget: '/' | '/learn' | '/community' | '/dashboard',
    children: React.ReactNode
  ) => {
    if (isPreview) {
      return (
        <div
          onClick={() => onNavigateRoute?.(routeTarget)}
          className="group block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-2xl cursor-pointer"
        >
          {children}
        </div>
      );
    }
    return (
      <Link
        href={href}
        className="group block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
      >
        {children}
      </Link>
    );
  };

  return (
    <section className="max-w-7xl mx-auto w-full p-6 md:p-12 space-y-12">
      <div className="space-y-6">
        {/* ── Section Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-[var(--portal-border)] pb-4">
          <div>
            <h2
              className="text-xl font-bold tracking-tight text-[var(--portal-text)]"
              style={{ fontFamily: 'var(--portal-heading-font)' }}
            >
              Active Learning Spaces
            </h2>
            <p className="text-xs text-[var(--portal-muted)] mt-0.5">
              Explore modules and resources available inside this portal.
            </p>
          </div>
        </div>

        {/* ── Active Spaces Cards Grid ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.enableCourses &&
            renderCardWrapper(
              `/portal/${slug}/learn`,
              '/learn',
              <Card
                className="h-full border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 hover:shadow-xl hover:border-[var(--portal-primary)] transition-all duration-200 active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                style={{ borderRadius: radiusCss }}
              >
                <div className="space-y-3">
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: 'var(--portal-primary, #3B82F6)', borderRadius: radiusCss }}
                  >
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-[var(--portal-text)] group-hover:text-[var(--portal-primary)] transition-colors">
                    Course Curriculum
                  </h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Interactive step-by-step masterclasses, structured lessons, and knowledge checks.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-[var(--portal-primary)]">
                  <span>Browse Courses</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </Card>
            )}

          {features.enableDocs &&
            renderCardWrapper(
              `/portal/${slug}/content?type=doc`,
              '/learn',
              <Card
                className="h-full border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 hover:shadow-xl hover:border-[var(--portal-primary)] transition-all duration-200 active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                style={{ borderRadius: radiusCss }}
              >
                <div className="space-y-3">
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: activeColors.accent, borderRadius: radiusCss }}
                  >
                    <FileCode className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-[var(--portal-text)] group-hover:text-[var(--portal-primary)] transition-colors">
                    Help Centre & Documentation
                  </h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Comprehensive knowledge base, step-by-step documentation, and FAQs.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-[var(--portal-primary)]">
                  <span>View Documentation</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </Card>
            )}

          {features.enableCommunity &&
            renderCardWrapper(
              `/portal/${slug}/community`,
              '/community',
              <Card
                className="h-full border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 hover:shadow-xl hover:border-[var(--portal-primary)] transition-all duration-200 active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                style={{ borderRadius: radiusCss }}
              >
                <div className="space-y-3">
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: 'var(--portal-primary, #3B82F6)', borderRadius: radiusCss }}
                  >
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-[var(--portal-text)] group-hover:text-[var(--portal-primary)] transition-colors">
                    Member Community
                  </h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Engage with fellow learners, participate in discussion threads, and ask questions.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-[var(--portal-primary)]">
                  <span>Enter Community</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </Card>
            )}

          {features.enableResources &&
            renderCardWrapper(
              `/portal/${slug}/content?type=resource`,
              '/learn',
              <Card
                className="h-full border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 hover:shadow-xl hover:border-[var(--portal-primary)] transition-all duration-200 active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                style={{ borderRadius: radiusCss }}
              >
                <div className="space-y-3">
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: 'var(--portal-secondary, #1E293B)', borderRadius: radiusCss }}
                  >
                    <FolderArchive className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-[var(--portal-text)] group-hover:text-[var(--portal-primary)] transition-colors">
                    Resource Vault
                  </h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Downloadable worksheets, PDF templates, checklists, and guides.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-[var(--portal-primary)]">
                  <span>Access Vault</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </Card>
            )}

          {features.enableBlog &&
            renderCardWrapper(
              `/portal/${slug}/content?type=article`,
              '/learn',
              <Card
                className="h-full border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 hover:shadow-xl hover:border-[var(--portal-primary)] transition-all duration-200 active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                style={{ borderRadius: radiusCss }}
              >
                <div className="space-y-3">
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: 'var(--portal-accent, #6366F1)', borderRadius: radiusCss }}
                  >
                    <Newspaper className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-[var(--portal-text)] group-hover:text-[var(--portal-primary)] transition-colors">
                    Insights & Articles
                  </h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Editorial publications, thought leadership, and operational strategies.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-[var(--portal-primary)]">
                  <span>Read Articles</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </Card>
            )}

          {features.enableGamification &&
            renderCardWrapper(
              `/portal/${slug}/dashboard`,
              '/dashboard',
              <Card
                className="h-full border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 hover:shadow-xl hover:border-[var(--portal-primary)] transition-all duration-200 active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                style={{ borderRadius: radiusCss }}
              >
                <div className="space-y-3">
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: 'var(--portal-primary, #3B82F6)', borderRadius: radiusCss }}
                  >
                    <Award className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-[var(--portal-text)] group-hover:text-[var(--portal-primary)] transition-colors">
                    Certifications & Badges
                  </h3>
                  <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                    Earn verifiable completion certificates and competency credentials.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-[var(--portal-primary)]">
                  <span>View Credentials</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </Card>
            )}
        </div>
      </div>
    </section>
  );
}
