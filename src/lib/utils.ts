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
 * Resolves a technical variable key to its actual value based on school context.
 * Used for high-fidelity previews and final PDF generation.
 */
export function resolveVariableValue(key: string, school?: any): string | null {
    if (!school) return null;
    const currency = school.currency || 'GHS';
    const rate = school.subscriptionRate || 0;
    const roll = school.nominalRoll || 0;
    
    switch(key) {
        case 'school_name': return school.name;
        case 'school_initials': return school.initials || '';
        case 'school_location': return school.location || '';
        case 'school_phone': return school.phone || '';
        case 'school_email': return school.email || '';
        case 'contact_name': return school.contactPerson || '';
        case 'school_package': return school.subscriptionPackageName || 'Standard';
        case 'subscription_rate': return `${currency} ${rate.toLocaleString()}`;
        case 'subscription_total': return `${currency} ${(rate * roll).toLocaleString()}`;
        case 'nominal_roll': return roll.toLocaleString();
        case 'arrears_balance': return `${currency} ${(school.arrearsBalance || 0).toLocaleString()}`;
        default: return null;
    }
}
