import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SurveySampleFileCard } from '@/components/surveys/SurveySampleFileCard';
import type { SampleFileSource } from '@/lib/surveys/sample-file';

const STORAGE_URL =
  'https://firebasestorage.googleapis.com/v0/b/app.appspot.com/o/media%2Fdocument%2F1740001234567-Staff_Roster.xlsx?alt=media&token=abc';

const enabled: SampleFileSource = {
  sampleFileEnabled: true,
  sampleFileUrl: STORAGE_URL,
};

describe('SurveySampleFileCard', () => {
  describe('visibility', () => {
    // Every question that predates this feature must render byte-identically, which is
    // why the card collapses to nothing rather than to an empty wrapper.
    it('renders nothing when the sample is disabled', () => {
      const { container } = render(<SurveySampleFileCard question={{ sampleFileEnabled: false }} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when no file is chosen', () => {
      const { container } = render(<SurveySampleFileCard question={{ sampleFileEnabled: true }} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when the URL is not allowlisted', () => {
      const { container } = render(
        <SurveySampleFileCard
          question={{ sampleFileEnabled: true, sampleFileUrl: 'https://evil.test/x.xlsx' }}
        />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders the card when a valid sample is configured', () => {
      render(<SurveySampleFileCard question={enabled} />);
      expect(screen.getByRole('link')).toBeInTheDocument();
    });
  });

  describe('content', () => {
    it('shows the file name and the default button label', () => {
      render(<SurveySampleFileCard question={enabled} />);
      expect(screen.getByText('Staff_Roster.xlsx')).toBeInTheDocument();
      expect(screen.getByText('Download sample')).toBeInTheDocument();
    });

    // With no author title the heading already falls back to the file name, so repeating
    // it underneath would be noise.
    it('does not repeat the file name when it is already the heading', () => {
      render(<SurveySampleFileCard question={enabled} />);
      expect(screen.getAllByText('Staff_Roster.xlsx')).toHaveLength(1);
    });

    it('shows the file name under the heading when the author set a title', () => {
      render(<SurveySampleFileCard question={{ ...enabled, sampleFileTitle: 'Staff template' }} />);
      expect(screen.getByText('Staff template')).toBeInTheDocument();
      expect(screen.getByText('Staff_Roster.xlsx')).toBeInTheDocument();
    });

    it('shows the author title, note and button label', () => {
      render(
        <SurveySampleFileCard
          question={{
            ...enabled,
            sampleFileTitle: 'Staff template',
            sampleFileDescription: 'Fill this in and upload it below.',
            sampleFileButtonText: 'Get the sheet',
          }}
        />,
      );
      expect(screen.getByText('Staff template')).toBeInTheDocument();
      expect(screen.getByText('Fill this in and upload it below.')).toBeInTheDocument();
      expect(screen.getByText('Get the sheet')).toBeInTheDocument();
    });

    it('never prints markup pasted into the copy fields', () => {
      const { container } = render(
        <SurveySampleFileCard
          question={{
            ...enabled,
            sampleFileTitle: '<span style="color: rgb(1,2,3)">Staff template</span>',
          }}
        />,
      );
      expect(screen.getByText('Staff template')).toBeInTheDocument();
      expect(container.textContent).not.toContain('<span');
      expect(container.textContent).not.toContain('rgb(1,2,3)');
    });

    it('applies the caller-supplied interpolator to author copy', () => {
      render(
        <SurveySampleFileCard
          question={{ ...enabled, sampleFileTitle: 'Template for {{entity_name}}' }}
          interpolate={(text) => text.replace('{{entity_name}}', 'Beacon Academy')}
        />,
      );
      expect(screen.getByText('Template for Beacon Academy')).toBeInTheDocument();
    });
  });

  describe('the download link', () => {
    it('points at the sample URL', () => {
      render(<SurveySampleFileCard question={enabled} />);
      expect(screen.getByRole('link')).toHaveAttribute('href', STORAGE_URL);
    });

    // Opening a storage URL in a new tab without this is a reverse-tabnabbing vector.
    it('is hardened against reverse tabnabbing', () => {
      render(<SurveySampleFileCard question={enabled} />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    });

    // "Download sample" alone is meaningless out of context for a screen-reader user
    // moving by links, so the accessible name carries the file name.
    it('names the file in its accessible name', () => {
      render(<SurveySampleFileCard question={enabled} />);
      expect(screen.getByRole('link').getAttribute('aria-label')).toContain('Staff_Roster.xlsx');
    });

    it('meets the 44px minimum touch target', () => {
      render(<SurveySampleFileCard question={enabled} />);
      expect(screen.getByRole('link').className).toContain('min-h-[44px]');
    });

    it('is not a button, so it can never submit the surrounding form', () => {
      render(<SurveySampleFileCard question={enabled} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
