import SystemDefaultsClient from './SystemDefaultsClient';

export const metadata = {
  title: 'System Defaults - Backoffice',
  description: 'Manage global message templates and baseline configuration.',
};

export default function SystemDefaultsPage() {
  return <SystemDefaultsClient />;
}
