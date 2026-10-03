'use client';

/**
 * @fileoverview New Session / Webinar Creation Page.
 * Delegates form state, wizard validation, and persistence to the SSOT <MeetingSessionForm>.
 *
 * ARCHITECTURAL DESIGN:
 * - Directives: Zero 'any' or 'any[]'. Strict typing.
 * - Single Source of Truth: MeetingSessionForm manages all 6 wizard steps and responsive preview.
 */

import * as React from 'react';
import { MeetingSessionForm } from '../components/session-form/MeetingSessionForm';

export default function NewMeetingPage() {
  return <MeetingSessionForm mode="create" />;
}
