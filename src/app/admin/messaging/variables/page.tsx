import { redirect } from 'next/navigation';

// Variables page moved to settings/fields
export default function VariablesPage() {
    redirect('/admin/settings/fields');
}
