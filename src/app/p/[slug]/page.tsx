import PublicPageClient from './PublicPageClient';

export default async function PublicPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicPageClient slug={slug} />;
}
