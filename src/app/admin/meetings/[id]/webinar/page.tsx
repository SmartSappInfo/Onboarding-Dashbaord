import { WebinarStageClient } from './WebinarStageClient';

interface WebinarStagePageProps {
  params: Promise<{ id: string }>;
}

export default async function WebinarStagePage(props: WebinarStagePageProps) {
  const params = await props.params;
  return (
    <div className="space-y-6">
      <WebinarStageClient meetingId={params.id} />
    </div>
  );
}
