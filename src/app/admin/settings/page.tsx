import SettingsClient from './SettingsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Configuration',
  description: 'Initialize platform data, reset dashboard layouts, and configure core system modules.',
};

export default function SettingsPage() {
  return <SettingsClient />;
}
