import FieldsPageClient from './FieldsPageClient';

export const metadata = {
  title: 'Fields & Defaults | Backoffice',
};

// Thin server wrapper — data is fetched client-side by the tab components
// (NativeFieldRegistry, FieldPackEditor, ContactTypeDefaults, …), each of
// which passes the caller's verified ID token to the server actions. This
// keeps reads authorized and avoids an unauthenticated SSR data pull.
export default function FieldsPage() {
  return <FieldsPageClient />;
}
