/**
 * @fileOverview Unit tests for Dialog and AlertDialog root component padding behavior.
 * Verifies that root base components supply standard p-6 padding by default,
 * while allowing demarcated modals and custom containers to override with p-0 cleanly.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

describe('Modal & Dialog Base Padding Architecture', () => {
  describe('DialogContent base padding', () => {
    it('applies default p-6 padding to DialogContent when no padding class is passed', () => {
      render(
        <Dialog open>
          <DialogContent data-testid="dialog-content">
            <DialogHeader>
              <DialogTitle>Standard Dialog</DialogTitle>
              <DialogDescription>Description text</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      const content = screen.getByTestId('dialog-content');
      expect(content.className).toContain('p-6');
    });

    it('allows demarcated modals to cleanly override default padding with p-0', () => {
      render(
        <Dialog open>
          <DialogContent
            data-testid="demarcated-dialog-content"
            className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col"
          >
            <DialogHeader demarcated>
              <DialogTitle>Demarcated Dialog</DialogTitle>
              <DialogDescription className="sr-only">Accessibility note</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      const content = screen.getByTestId('demarcated-dialog-content');
      expect(content.className).toContain('p-0');
      expect(content.className).not.toContain('p-6');
    });

    it('renders DialogFooter with demarcated styling when demarcated prop is set', () => {
      render(
        <Dialog open>
          <DialogContent data-testid="dialog-footer-content" className="p-0">
            <DialogHeader>
              <DialogTitle>Footer Test</DialogTitle>
            </DialogHeader>
            <DialogFooter demarcated data-testid="dialog-footer">
              <button type="button">Close</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      const footer = screen.getByTestId('dialog-footer');
      expect(footer.className).toContain('border-t');
      expect(footer.className).toContain('px-6');
      expect(footer.className).toContain('py-3.5');
    });
  });

  describe('AlertDialogContent base padding', () => {
    it('applies default p-6 padding to AlertDialogContent (resolving missing padding on confirm/delete dialogs)', () => {
      render(
        <AlertDialog open>
          <AlertDialogContent data-testid="alert-dialog-content" className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete School?</AlertDialogTitle>
              <AlertDialogDescription>
                This will archive the school record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Archive School</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      const content = screen.getByTestId('alert-dialog-content');
      expect(content.className).toContain('p-6');
      expect(content.className).toContain('rounded-2xl');
      expect(content.className).toContain('bg-card');
      expect(content.className).toContain('text-card-foreground');
    });

    it('allows custom AlertDialog to override padding with p-0 when demarcated', () => {
      render(
        <AlertDialog open>
          <AlertDialogContent
            data-testid="demarcated-alert-dialog"
            className="p-0 gap-0 overflow-hidden"
          >
            <AlertDialogHeader demarcated>
              <AlertDialogTitle>Demarcated Alert</AlertDialogTitle>
              <AlertDialogDescription className="sr-only">Screen reader notice</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter demarcated data-testid="alert-footer">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      const content = screen.getByTestId('demarcated-alert-dialog');
      expect(content.className).toContain('p-0');
      expect(content.className).not.toContain('p-6');

      const footer = screen.getByTestId('alert-footer');
      expect(footer.className).toContain('border-t');
      expect(footer.className).toContain('px-6');
    });
  });
});
