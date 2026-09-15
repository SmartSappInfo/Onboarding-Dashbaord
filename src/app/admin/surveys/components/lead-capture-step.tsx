'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Dedicated Lead Capture & CRM Step (Step 3)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Dedicated Lead Capture & CRM Stage:
 *    - Positioned immediately following the Builder (Step 2) and preceding Results (Step 4).
 *    - Hosts the unified CRM & Lead Capture Engine (Identity Bridge, Dynamic Field Mappings,
 *      WYSIWYG Contact Form Canvas, Tags, and Pipeline Routing).
 * 2. Responsive Containment:
 *    - Rendered in a focused container (max-w-5xl mx-auto) allowing full horizontal width for
 *      complex tables, schemas, and live form previews.
 * 3. Strict Zero-Any Invariant & Mobile Ergonomics (min-h-[44px] touch targets).
 */

import * as React from 'react';
import { SurveyCrmEngineCard } from './SurveyCrmEngineCard';

export default function LeadCaptureStep() {
  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-500 text-left pb-32 max-w-5xl mx-auto">
      <SurveyCrmEngineCard />
    </div>
  );
}
