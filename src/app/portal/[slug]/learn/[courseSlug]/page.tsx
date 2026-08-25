/**
 * {{Org_name}} Experience Platform — Course Overview Route
 *
 * Async Server Component with dynamic OpenGraph metadata for individual course landing.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { PortalService } from '@/lib/services/portal-service';
import { CourseService } from '@/lib/services/course-service';
import PortalCourseOverviewClient from './PortalCourseOverviewClient';

interface CoursePageProps {
  params: Promise<{ slug: string; courseSlug: string }>;
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug, courseSlug } = await params;
  const portal = await PortalService.getPortalBySlug(slug);

  if (!portal) {
    return {
      title: 'Course Overview | Experience Platform',
    };
  }

  const course = await CourseService.getCourseBySlug(portal.id, courseSlug);
  const brandName = portal.branding?.brandName || portal.name;

  if (!course) {
    return {
      title: `Course | ${brandName}`,
    };
  }

  return {
    title: `${course.title} | ${brandName}`,
    description: course.summary || course.description || `Master ${course.title} on ${brandName}.`,
    openGraph: {
      title: `${course.title} — ${brandName}`,
      description: course.summary || course.description || `Master ${course.title}.`,
      images: course.thumbnailUrl ? [{ url: course.thumbnailUrl }] : undefined,
    },
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug, courseSlug } = await params;
  return <PortalCourseOverviewClient slug={slug} courseSlug={courseSlug} />;
}
