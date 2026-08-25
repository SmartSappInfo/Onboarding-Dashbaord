import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import type { OfficeHoursRoom } from '@/lib/meetings/types/polls';
import { PublicDropInClient } from './PublicDropInClient';

interface PublicDropInPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function PublicDropInPage({ params }: PublicDropInPageProps) {
  const { slug } = await params;

  const snap = await adminDb
    .collection('office_hours_rooms')
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snap.empty) {
    notFound();
  }

  const room = {
    ...(snap.docs[0].data() as OfficeHoursRoom),
    id: snap.docs[0].id,
  };

  return <PublicDropInClient room={room} />;
}
