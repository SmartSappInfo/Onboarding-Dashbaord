import { Suspense } from 'react';
import { Metadata } from 'next';
import TagsClient from './TagsClient';
import { TagsSkeleton } from '@/components/tags/TagsSkeleton';

export const metadata: Metadata = {
  title: 'Tag Management',
  description: 'Create, organize, and manage contact tags for intelligent segmentation.',
};

export default async function TagsPage() {
  return (
    <Suspense fallback={<TagsSkeleton />}>
      <TagsClient />
    </Suspense>
  );
}
