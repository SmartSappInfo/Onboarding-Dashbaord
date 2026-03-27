'use client';

import * as React from 'react';
import type { FocalPerson } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Contact, Mail, Phone, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContactSelectorProps {
  contacts: FocalPerson[];
  channel: 'email' | 'sms';
  onSelectionChange: (contactIndices: number[]) => void;
  selectedContactIndices: number[];
  maxSelections?: number;
}

const CONTACT_CHANNEL_ICONS = {
  email: Mail,
  sms: Phone,
};

/**
 * ContactSelector Component
 * 
 * Displays Focal_Person records for a selected entity and allows multi-selection
 * based on the communication channel (email/SMS).
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export function ContactSelector({
  contacts,
  channel,
  onSelectionChange,
  selectedContactIndices,
  maxSelections = 50,
}: ContactSelectorProps) {
  // Filter contacts by channel (Requirement 2.4, 2.5)
  const filteredContacts = React.useMemo(() => {
    return contacts
      .map((contact, index) => ({ contact, originalIndex: index }))
      .filter(({ contact }) => {
        if (channel === 'email') {
          return contact.email && contact.email.trim() !== '';
        } else {
          return contact.phone && contact.phone.trim() !== '';
        }
      });
  }, [contacts, channel]);

  // Handle individual contact selection
  const handleToggleContact = (originalIndex: number) => {
    const isSelected = selectedContactIndices.includes(originalIndex);
    
    if (isSelected) {
      // Remove from selection
      onSelectionChange(selectedContactIndices.filter(idx => idx !== originalIndex));
    } else {
      // Add to selection if under limit
      if (selectedContactIndices.length >= maxSelections) {
        return; // Silently ignore if at max
      }
      onSelectionChange([...selectedContactIndices, originalIndex]);
    }
  };

  const ChannelIcon = CONTACT_CHANNEL_ICONS[channel];

  // No valid contacts for channel (Requirement 2.4, 2.5)
  if (filteredContacts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Contact className="h-4 w-4" />
            Select Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-900 dark:text-amber-100">
              No contacts with valid {channel === 'email' ? 'email addresses' : 'phone numbers'} found for this school.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Contact className="h-4 w-4" />
            Select Contacts
          </CardTitle>
          <Badge variant="secondary">
            {selectedContactIndices.length} / {maxSelections} selected
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Maximum Selection Warning (Requirement 2.6) */}
        {selectedContactIndices.length >= maxSelections && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-900 dark:text-amber-100">
              Maximum selection limit of {maxSelections} contacts reached
            </span>
          </div>
        )}

        <ScrollArea className="h-64">
          <div className="space-y-2">
            {filteredContacts.map(({ contact, originalIndex }) => {
              const isSelected = selectedContactIndices.includes(originalIndex);
              const isDisabled = !isSelected && selectedContactIndices.length >= maxSelections;
              const contactValue = channel === 'email' ? contact.email : contact.phone;

              return (
                <div
                  key={originalIndex}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-md border transition-colors",
                    isSelected && "bg-primary/5 border-primary",
                    !isSelected && "hover:bg-muted",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Checkbox
                    id={`contact-${originalIndex}`}
                    checked={isSelected}
                    onCheckedChange={() => handleToggleContact(originalIndex)}
                    disabled={isDisabled}
                    className="mt-1"
                  />
                  <label
                    htmlFor={`contact-${originalIndex}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="space-y-1">
                      {/* Contact Name and Type (Requirement 2.2) */}
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{contact.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {contact.type}
                        </Badge>
                      </div>
                      
                      {/* Contact Details (Requirement 2.2) */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {contact.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Channel Indicator */}
                      <div className="flex items-center gap-1 text-xs">
                        <ChannelIcon className="h-3 w-3 text-primary" />
                        <span className="text-primary font-medium">
                          Will receive via {channel === 'email' ? 'email' : 'SMS'}: {contactValue}
                        </span>
                      </div>
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Selection Summary (Requirement 2.7) */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} available for {channel === 'email' ? 'email' : 'SMS'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
