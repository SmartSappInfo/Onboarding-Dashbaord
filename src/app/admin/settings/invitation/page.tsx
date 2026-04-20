import OrganizationInvitationSettings from './InvitationSettingsClient';

export const metadata = {
  title: 'Messaging Settings - Admin',
  description: 'Customize institutional invitation and recovery templates.',
};

export default function InvitationSettingsPage() {
  return <OrganizationInvitationSettings />;
}
