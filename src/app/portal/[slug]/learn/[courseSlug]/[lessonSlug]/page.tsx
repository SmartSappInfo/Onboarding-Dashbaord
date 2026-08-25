/**
 * {{Org_name}} Experience Platform — Focused Course Learning Player Route
 *
 * Async Server Component with dynamic OpenGraph metadata for lesson player.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import { CourseService } from '@/lib/services/course-service';
import PortalCoursePlayerClient from './PortalCoursePlayerClient';

interface LessonPlayerPageProps {
  params: Promise<{ slug: string; courseSlug: string; lessonSlug: string }>;
}

export async function generateMetadata({ params }: LessonPlayerPageProps): Promise<Metadata> {
  const { slug, courseSlug, lessonSlug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Lesson Player | Experience Platform',
    };
  }

  const course = await CourseService.getCourseBySlug(portal.id, courseSlug);
  const brandName = portal.branding?.brandName || portal.name;

  if (!course) {
    return {
      title: `Lesson | ${brandName}`,
    };
  }

  const lesson = await CourseService.getLessonBySlug(course.id, lessonSlug);

  return {
    title: `${lesson?.title || 'Lesson'} | ${course.title} — ${brandName}`,
    description: lesson?.summary || course.summary || `Watch lesson on ${brandName}.`,
    robots: { index: false, follow: false }, // Learning workspace is member-focused
  };
}

export default async function LessonPlayerPage({ params }: LessonPlayerPageProps) {
  const { slug, courseSlug, lessonSlug } = await params;
  return (
    <PortalCoursePlayerClient
      slug={slug}
      courseSlug={courseSlug}
      lessonSlug={lessonSlug}
    />
  );
}
