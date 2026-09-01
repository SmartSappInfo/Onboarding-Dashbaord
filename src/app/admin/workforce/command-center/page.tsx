import * as React from 'react';
import { AiCommandCenterClient } from './AiCommandCenterClient';

export const metadata = {
  title: 'AI Administrative Command Center | SmartSapp Workforce',
  description: 'Natural language administrative action proposals, impact diff simulation, and controlled execution',
};

export default function AdminAiCommandCenterPage() {
  return <AiCommandCenterClient />;
}
