import FlipbookReaderClient from './FlipbookReaderClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interactive Flipbook Reader',
  description: 'View publication flipbook landing page.',
};

export default async function PublicFlipbookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  return <FlipbookReaderClient slug={resolvedParams.slug} />;
}
