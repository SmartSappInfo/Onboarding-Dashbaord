import * as React from 'react';
import type { Metadata } from 'next';
import EventTypeEditorClient from './EventTypeEditorClient';

export const metadata: Metadata = {
  title: 'Edit Event Type | SmartSapp Meetings',
  description: 'Configure event duration, availability schedule, location, and booking questions.',
};

export default async function EditEventTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventTypeEditorClient eventTypeId={id} />;
}
