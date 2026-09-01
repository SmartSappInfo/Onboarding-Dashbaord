import * as React from 'react';
import { ProjectEditorClient } from './ProjectEditorClient';

export const metadata = {
  title: 'Canvas Editor | Creative Studio 2.0',
};

export default async function CreativeProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectEditorClient projectId={id} />;
}
