import { Suspense } from 'react';
import PromptEditorClient from './PromptEditorClient';

type Props = { params: Promise<{ id: string }> };

export default async function PromptEditorPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6 w-full text-left">
      <Suspense fallback={<div className="animate-pulse h-64 bg-muted/20 rounded-2xl" />}>
        <PromptEditorClient flowName={id} />
      </Suspense>
    </div>
  );
}
