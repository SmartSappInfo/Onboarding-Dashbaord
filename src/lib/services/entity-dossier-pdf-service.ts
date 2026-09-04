'use client';

import type { Entity, WorkspaceEntity, EntityContact, Task, Deal } from '@/lib/types';
import type { EntityDossierSummary } from '@/app/actions/entity-dossier-actions';
import { format } from 'date-fns';

export interface EntityDossierPdfOptions {
  entity: Entity;
  workspaceEntity?: WorkspaceEntity | null;
  summary: EntityDossierSummary;
  contacts?: EntityContact[];
  tasks?: Task[];
  deals?: Deal[];
  organization?: {
    name: string;
    logoUrl?: string;
  } | null;
  generatedByName?: string;
  terminologySingular?: string;
}

/**
 * Converts an image URL to a base64 Data URL for embedding into jsPDF.
 */
async function getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Generates and downloads a presentation-grade executive PDF dossier report.
 */
export async function generateEntityDossierPdf(options: EntityDossierPdfOptions): Promise<void> {
  const {
    entity,
    workspaceEntity,
    summary,
    contacts = [],
    tasks = [],
    deals = [],
    organization,
    generatedByName = 'CRM User',
    terminologySingular = 'Entity',
  } = options;

  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180mm
  let y = margin;

  // Colors
  const slate900: [number, number, number] = [15, 23, 42];
  const slate700: [number, number, number] = [51, 65, 85];
  const slate500: [number, number, number] = [100, 116, 139];
  const slate200: [number, number, number] = [226, 232, 240];
  const slate50: [number, number, number] = [248, 250, 252];
  const indigo600: [number, number, number] = [79, 70, 229];
  const indigo50: [number, number, number] = [238, 242, 255];
  const emerald600: [number, number, number] = [16, 185, 129];
  const amber600: [number, number, number] = [217, 119, 6];
  const rose600: [number, number, number] = [225, 29, 72];

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = margin + 5;
    }
  };

  // --- 1. HEADER SECTION ---
  const orgLogo = organization?.logoUrl ? await getBase64ImageFromUrl(organization.logoUrl) : null;
  if (orgLogo) {
    try {
      doc.addImage(orgLogo, 'PNG', margin, y, 14, 14);
    } catch {
      // Fallback if image fails
      doc.setFillColor(...indigo600);
      doc.roundedRect(margin, y, 14, 14, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const letter = organization?.name ? organization.name.charAt(0).toUpperCase() : 'S';
      doc.text(letter, margin + 7, y + 9.5, { align: 'center' });
    }
  } else {
    doc.setFillColor(...indigo600);
    doc.roundedRect(margin, y, 14, 14, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const letter = organization?.name ? organization.name.charAt(0).toUpperCase() : 'S';
    doc.text(letter, margin + 7, y + 9.5, { align: 'center' });
  }

  // Org Name & Dossier Title
  doc.setTextColor(...slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(organization?.name || 'SmartSapp Platform', margin + 18, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate500);
  doc.text('EXECUTIVE PROFILE & INTELLIGENCE DOSSIER', margin + 18, y + 9);
  doc.text(`CONFIDENTIAL  |  Generated on ${format(new Date(), 'PPP p')} by ${generatedByName}`, margin + 18, y + 13);

  y += 20;

  // Banner: Entity Name & Key Badges
  doc.setFillColor(...slate50);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F');
  doc.setDrawColor(...slate200);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'S');

  const displayName = entity.name || workspaceEntity?.displayName || 'Entity Account';
  doc.setTextColor(...slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(displayName, margin + 4, y + 7.5);

  // Subtitle pills inside banner
  const weRecord = workspaceEntity as unknown as Record<string, unknown> | null | undefined;
  const stageName = (weRecord?.currentStageName as string) || workspaceEntity?.track || 'Active';
  const leadScore = workspaceEntity?.leadScore ?? 50;
  const entityType = entity.entityType ? entity.entityType.toUpperCase() : terminologySingular.toUpperCase();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate500);
  doc.text(
    `TYPE: ${entityType}   •   STAGE: ${stageName.toUpperCase()}   •   LEAD SCORE: ${leadScore}/100   •   STATUS: ${summary.relationshipStatus.toUpperCase()}`,
    margin + 4,
    y + 13.5
  );

  y += 24;

  // --- 2. AI STRATEGIC INTELLIGENCE SYNTHESIS ---
  checkPageBreak(50);
  doc.setFillColor(...indigo50);
  doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F');
  doc.setTextColor(...indigo600);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('AI STRATEGIC INTELLIGENCE SYNTHESIS', margin + 4, y + 4.8);

  y += 10;

  // Sentiment Pill & Status
  const sentimentColor =
    summary.recentSentiment === 'positive'
      ? emerald600
      : summary.recentSentiment === 'urgent'
      ? rose600
      : amber600;

  doc.setFillColor(...sentimentColor);
  doc.roundedRect(margin, y, 24, 5, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(summary.recentSentiment.toUpperCase(), margin + 12, y + 3.5, { align: 'center' });

  doc.setTextColor(...slate700);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Relationship Health: ${summary.relationshipStatus}`, margin + 28, y + 3.8);

  y += 8;

  // Executive Summary text
  doc.setTextColor(...slate900);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const splitSummary = doc.splitTextToSize(summary.executiveSummary, contentWidth - 4);
  doc.text(splitSummary, margin + 2, y);
  y += splitSummary.length * 4.2 + 4;

  // Key Themes & Recommended Next Actions in 2 columns
  checkPageBreak(30);
  const colWidth = (contentWidth - 6) / 2;

  // Left column: Key Themes
  doc.setFillColor(...slate50);
  doc.roundedRect(margin, y, colWidth, 26, 2, 2, 'F');
  doc.setDrawColor(...slate200);
  doc.roundedRect(margin, y, colWidth, 26, 2, 2, 'S');

  doc.setTextColor(...slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('DETECTED THEMES & SIGNALS', margin + 3.5, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate700);
  let themeY = y + 10;
  summary.keyThemes.slice(0, 3).forEach((theme) => {
    const splitTheme = doc.splitTextToSize(`• ${theme}`, colWidth - 7);
    doc.text(splitTheme, margin + 3.5, themeY);
    themeY += splitTheme.length * 3.8;
  });

  // Right column: Recommended Actions
  const rightColX = margin + colWidth + 6;
  doc.setFillColor(...slate50);
  doc.roundedRect(rightColX, y, colWidth, 26, 2, 2, 'F');
  doc.setDrawColor(...slate200);
  doc.roundedRect(rightColX, y, colWidth, 26, 2, 2, 'S');

  doc.setTextColor(...indigo600);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('RECOMMENDED ACTION ITEMS', rightColX + 3.5, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate700);
  let actionY = y + 10;
  summary.actionItems.slice(0, 3).forEach((action, idx) => {
    const splitAction = doc.splitTextToSize(`${idx + 1}. ${action}`, colWidth - 7);
    doc.text(splitAction, rightColX + 3.5, actionY);
    actionY += splitAction.length * 3.8;
  });

  y += 32;

  // --- 3. PROFILE & CONTACT DETAILS SNAPSHOT ---
  checkPageBreak(40);
  doc.setFillColor(...slate50);
  doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F');
  doc.setTextColor(...slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CORE PROFILE & ATTRIBUTES', margin + 4, y + 4.8);

  y += 10;

  const entityPersonData = entity.personData as { email?: string; phone?: string } | undefined;
  const entityRecord = entity as unknown as Record<string, unknown>;
  const resolvedEmail =
    workspaceEntity?.primaryEmail ||
    entityPersonData?.email ||
    entity.entityContacts?.[0]?.email ||
    'Not specified';

  const resolvedPhone =
    workspaceEntity?.primaryPhone ||
    entityPersonData?.phone ||
    entity.entityContacts?.[0]?.phone ||
    'Not specified';

  const resolvedWebsite =
    (entityRecord.website as string) ||
    ((entity.onlinePresence as { website?: string } | undefined)?.website) ||
    'Not specified';

  const resolvedLocation =
    [entity.location?.district?.name, entity.location?.region?.name, entity.location?.country?.name]
      .filter(Boolean)
      .join(', ') ||
    entity.location?.locationString ||
    'Not specified';

  const assignedOwner =
    workspaceEntity?.assignedTo?.name ||
    (typeof workspaceEntity?.assignedTo === 'string' ? workspaceEntity.assignedTo : 'Unassigned');

  const profileGrid = [
    { label: 'Primary Email', val: resolvedEmail },
    { label: 'Primary Phone', val: resolvedPhone },
    { label: 'Website', val: resolvedWebsite },
    { label: 'Location', val: resolvedLocation },
    { label: 'Pipeline Stage', val: stageName },
    { label: 'Lead Score', val: `${leadScore} / 100` },
    { label: 'Assigned Owner', val: assignedOwner },
    { label: 'Created Date', val: entity.createdAt ? format(new Date(entity.createdAt), 'PP') : 'N/A' },
  ];

  const cellW = contentWidth / 4;
  profileGrid.forEach((item, idx) => {
    const colIdx = idx % 4;
    const rowIdx = Math.floor(idx / 4);
    const cellX = margin + colIdx * cellW;
    const cellY = y + rowIdx * 11;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...slate500);
    doc.text(item.label.toUpperCase(), cellX + 1, cellY + 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...slate900);
    const valText = doc.splitTextToSize(item.val, cellW - 3);
    doc.text(valText[0] || '—', cellX + 1, cellY + 6.5);
  });

  y += 24;

  // --- 4. KEY STAKEHOLDERS DIRECTORY ---
  checkPageBreak(35);
  doc.setFillColor(...slate50);
  doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F');
  doc.setTextColor(...slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`KEY CONTACTS & STAKEHOLDERS (${contacts.length})`, margin + 4, y + 4.8);

  y += 10;

  if (contacts.length === 0) {
    doc.setTextColor(...slate500);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('No individual contacts linked to this profile.', margin + 2, y + 4);
    y += 10;
  } else {
    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slate700);
    doc.text('NAME', margin + 3, y + 4.2);
    doc.text('ROLE / TITLE', margin + 50, y + 4.2);
    doc.text('EMAIL', margin + 95, y + 4.2);
    doc.text('PHONE', margin + 145, y + 4.2);
    y += 6.5;

    // Rows
    contacts.slice(0, 6).forEach((contact, idx) => {
      checkPageBreak(8);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...slate900);

      const contactName = contact.name || 'Contact';
      const role = contact.typeLabel || contact.typeKey || 'Stakeholder';
      doc.text(contactName.slice(0, 26), margin + 3, y + 4.2);
      doc.text(role.slice(0, 24), margin + 50, y + 4.2);
      doc.text((contact.email || '—').slice(0, 28), margin + 95, y + 4.2);
      doc.text((contact.phone || '—').slice(0, 18), margin + 145, y + 4.2);
      y += 6.5;
    });
    y += 4;
  }

  // --- 5. DEALS & COMMERCIAL PIPELINE ---
  checkPageBreak(35);
  doc.setFillColor(...slate50);
  doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F');
  doc.setTextColor(...slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`COMMERCIAL DEALS (${deals.length})`, margin + 4, y + 4.8);

  y += 10;

  if (deals.length === 0) {
    doc.setTextColor(...slate500);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('No commercial deals currently recorded.', margin + 2, y + 4);
    y += 10;
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slate700);
    doc.text('DEAL NAME', margin + 3, y + 4.2);
    doc.text('PIPELINE / STAGE', margin + 65, y + 4.2);
    doc.text('VALUE', margin + 125, y + 4.2);
    doc.text('CLOSE DATE', margin + 155, y + 4.2);
    y += 6.5;

    deals.slice(0, 5).forEach((deal, idx) => {
      checkPageBreak(8);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...slate900);

      const dealVal =
        typeof deal.value === 'number'
          ? `$${deal.value.toLocaleString()}`
          : (deal as unknown as { amount?: number }).amount
          ? `$${Number((deal as unknown as { amount?: number }).amount).toLocaleString()}`
          : '—';
      const closeDate = deal.expectedCloseDate ? format(new Date(deal.expectedCloseDate), 'PP') : '—';

      doc.text(deal.name.slice(0, 36), margin + 3, y + 4.2);
      doc.text((deal.stageName || 'Open').slice(0, 32), margin + 65, y + 4.2);
      doc.text(dealVal, margin + 125, y + 4.2);
      doc.text(closeDate, margin + 155, y + 4.2);
      y += 6.5;
    });
    y += 4;
  }

  // --- 6. OPERATIONAL TASKS & RECENT ENGAGEMENTS ---
  checkPageBreak(35);
  doc.setFillColor(...slate50);
  doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F');
  doc.setTextColor(...slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`OPERATIONAL TASKS (${tasks.length})`, margin + 4, y + 4.8);

  y += 10;

  if (tasks.length === 0) {
    doc.setTextColor(...slate500);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('No open tasks scheduled for this account.', margin + 2, y + 4);
    y += 10;
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slate700);
    doc.text('TASK TITLE', margin + 3, y + 4.2);
    doc.text('PRIORITY', margin + 95, y + 4.2);
    doc.text('STATUS', margin + 125, y + 4.2);
    doc.text('DUE DATE', margin + 155, y + 4.2);
    y += 6.5;

    tasks.slice(0, 6).forEach((task, idx) => {
      checkPageBreak(8);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...slate900);

      const dueDateText = task.dueDate ? format(new Date(task.dueDate), 'PP') : '—';
      doc.text(task.title.slice(0, 48), margin + 3, y + 4.2);
      doc.text((task.priority || 'Medium').toUpperCase(), margin + 95, y + 4.2);
      doc.text((task.status || 'Pending').toUpperCase(), margin + 125, y + 4.2);
      doc.text(dueDateText, margin + 155, y + 4.2);
      y += 6.5;
    });
    y += 4;
  }

  // --- 7. RUNNING FOOTER ON ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle divider line
    doc.setDrawColor(...slate200);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    // Left Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...slate500);
    doc.text(
      `SmartSapp Enterprise Intelligence  •  ${displayName} Dossier  •  CONFIDENTIAL`,
      margin,
      pageHeight - 8
    );

    // Right Footer: Page Numbers
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // Download Trigger
  const cleanName = displayName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  doc.save(`${cleanName}_Executive_Dossier_${dateStr}.pdf`);
}
