import { Suspense } from 'react';
import ProjectDetailClient from './ProjectDetailClient';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Longitudinal Research Project | SmartSapp Surveys',
  description: 'Multi-wave survey research project workspace and longitudinal comparative analytics.',
};

export default async function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <ProjectDetailClient projectId={params.id} />
    </Suspense>
  );
}
