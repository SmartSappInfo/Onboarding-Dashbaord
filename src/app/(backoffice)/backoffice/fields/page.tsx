import FieldsPageClient from './FieldsPageClient';
import { listNativeFields, listFieldPacks, getContactTypeDefaults } from '@/lib/backoffice/backoffice-field-actions';

export const metadata = {
  title: 'Fields & Defaults | Backoffice',
};

export default async function FieldsPage() {
  // Fetch data in parallel on the server to eliminate waterfalls
  const [nativeFieldsRes, packsRes, contactTypesRes] = await Promise.all([
    listNativeFields(),
    listFieldPacks(),
    getContactTypeDefaults('institution'),
  ]);

  return (
    <FieldsPageClient 
      initialNativeFields={nativeFieldsRes.success ? nativeFieldsRes.data : undefined}
      initialPacks={packsRes.success ? packsRes.data : undefined}
      initialContactTypes={contactTypesRes.success ? contactTypesRes.data?.types : undefined}
    />
  );
}
