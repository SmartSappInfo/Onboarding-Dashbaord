import FlipbookEditorClient from './FlipbookEditorClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit Flipbook | Studio',
  description: 'Customize page turn effects, hotspots, lead capture gating, and branding.',
};

export default async function FlipbookEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return <FlipbookEditorClient flipbookId={resolvedParams.id} />;
}
