import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Robust Title Case normalization for multi-word strings.
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolves a technical variable key to its actual value based on school context.
 * Used for high-fidelity previews and final PDF generation.
 * Upgraded to look for the designated 'Signatory' in focal persons.
 */
export function resolveVariableValue(key: string, school?: any): string | null {
    if (!school) return null;
    
    // 1. Resolve Signatory Context
    const signatory = (school.focalPersons || []).find((p: any) => p.isSignatory);
    
    const currency = school.currency || 'GHS';
    const rate = school.subscriptionRate || 0;
    const roll = school.nominalRoll || 0;
    
    switch(key) {
        // Institutional Data
        case 'school_name': return school.name;
        case 'school_initials': return school.initials || '';
        case 'school_location': return school.location || '';
        case 'school_phone': return school.phone || '';
        case 'school_email': return school.email || '';
        
        // Signatory Data (Primary variables)
        case 'contact_name': return signatory?.name || '';
        case 'contact_email': return signatory?.email || '';
        case 'contact_phone': return signatory?.phone || '';
        case 'contact_position': return signatory?.type || '';
        
        // Financial Logic
        case 'school_package': return school.subscriptionPackageName || 'Standard';
        case 'subscription_rate': return `${currency} ${rate.toLocaleString()}`;
        case 'subscription_total': return `${currency} ${(rate * roll).toLocaleString()}`;
        case 'nominal_roll': return roll.toLocaleString();
        case 'arrears_balance': return `${currency} ${(school.arrearsBalance || 0).toLocaleString()}`;
        
        // Smart URL Resolution for Simulation
        case 'agreement_url': {
            // Note: In a real simulation, we'd need to know which contract/PDF is in context.
            // For general preview, we point to a representative portal.
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://onboarding.smartsapp.com';
            return `${baseUrl}/forms/contract-simulation?schoolId=${school.id}`;
        }
        
        default: return null;
    }
}

/** Returns '#ffffff' or '#000000' based on background hex color luminance (WCAG) */
export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
