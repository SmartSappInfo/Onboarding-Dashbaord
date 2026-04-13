import PublicPageClient from './PublicPageClient';

export default function PublicPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  return <PublicPageClient params={params} />;
}
