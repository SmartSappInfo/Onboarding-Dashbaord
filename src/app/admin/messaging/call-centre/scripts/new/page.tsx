import { ScriptBuilderClient } from './ScriptBuilderClient';

export default async function NewScriptPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <ScriptBuilderClient scriptId={id} />;
}
