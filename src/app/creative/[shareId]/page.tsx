import * as React from 'react';
import { SharedCreativeClient } from './SharedCreativeClient';

export const metadata = {
  title: 'Shared Creative Preview | SmartSapp',
};

export default async function SharedCreativePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  return <SharedCreativeClient shareId={shareId} />;
}
