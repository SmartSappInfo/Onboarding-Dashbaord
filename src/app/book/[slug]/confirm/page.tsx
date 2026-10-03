import { redirect } from 'next/navigation';

/**
 * @fileoverview Legacy Confirmation Redirect.
 * Automatically forwards legacy bookmarks and external links to the modern /book/[slug] flow.
 */

interface ConfirmPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ConfirmBookingPage({ params }: ConfirmPageProps) {
  const { slug } = await params;
  redirect(`/book/${encodeURIComponent(slug)}`);
}
