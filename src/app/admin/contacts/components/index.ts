/**
 * Contact Components - Scope-specific UI components for the unified entity model
 * 
 * This module exports all contact-related components that adapt based on workspace contactScope.
 * Implements Requirements 14, 15, 16, 17, and 25 from the contacts-expansion spec.
 */

export { InstitutionForm } from './InstitutionForm';
export { FamilyForm } from './FamilyForm';
export { PersonForm } from './PersonForm';
export { ContactListColumns, ContactListHeaders } from './ContactListColumns';
export { ContactDetailPage } from './ContactDetailPage';
export { 
  ScopeBadge, 
  ScopeLabel, 
  ScopeSelector, 
  ScopeMismatchError 
} from './ScopeBadge';
