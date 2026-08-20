/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Survey File Validation & URL Processing Engine.
 * 
 * Provides centralized, strictly typed validation for file upload blocks,
 * including format restriction bundle presets, custom extension checks,
 * file size enforcement, and comma-separated URL parsing for multi-file answers.
 */

export interface FileTypePreset {
  id: 'all' | 'spreadsheets' | 'documents' | 'images' | 'archives' | 'custom';
  label: string;
  extensions: string[];
  mimeTypes: string[];
  description: string;
}

export const FILE_TYPE_PRESETS: Record<string, FileTypePreset> = {
  all: {
    id: 'all',
    label: 'All Formats (No restriction)',
    extensions: [],
    mimeTypes: [],
    description: 'Accepts any file format up to maximum size limit',
  },
  spreadsheets: {
    id: 'spreadsheets',
    label: 'Spreadsheets (.xlsx, .xls, .csv)',
    extensions: ['.xlsx', '.xls', '.csv'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
      'text/plain',
    ],
    description: 'Excel workbooks and CSV data sheets',
  },
  documents: {
    id: 'documents',
    label: 'Documents & PDFs (.pdf, .docx, .doc, .txt)',
    extensions: ['.pdf', '.docx', '.doc', '.txt', '.rtf'],
    mimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'application/rtf',
    ],
    description: 'PDF documents, Word files, and plain text documents',
  },
  images: {
    id: 'images',
    label: 'Images (.png, .jpg, .jpeg, .webp, .svg)',
    extensions: ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'],
    mimeTypes: [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
      'image/gif',
    ],
    description: 'Standard image formats',
  },
  archives: {
    id: 'archives',
    label: 'Archives (.zip, .rar, .7z)',
    extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
    mimeTypes: [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
    ],
    description: 'Compressed archive packages',
  },
};

/**
 * Normalizes custom extension string (e.g. "xlsx, .csv, PDF") into normalized lowercase extensions ([".xlsx", ".csv", ".pdf"])
 */
export function normalizeCustomExtensions(customExtStr?: string): string[] {
  if (!customExtStr || typeof customExtStr !== 'string') return [];
  return customExtStr
    .split(/[,\s]+/)
    .map((ext) => ext.trim().toLowerCase())
    .filter(Boolean)
    .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`));
}

/**
 * Validates a file against allowed type presets and custom extensions
 */
export function validateFileType(
  file: File,
  allowedTypes?: ('all' | 'spreadsheets' | 'documents' | 'images' | 'archives' | 'custom')[],
  customExtensions?: string
): { valid: boolean; error?: string } {
  // If no restriction or 'all' is explicitly in allowedTypes, all formats are valid
  if (!allowedTypes || allowedTypes.length === 0 || allowedTypes.includes('all')) {
    return { valid: true };
  }

  const fileName = file.name.toLowerCase();
  const fileExt = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
  const fileMime = (file.type || '').toLowerCase();

  const acceptedExtensions = new Set<string>();
  const acceptedMimeTypes = new Set<string>();

  for (const typeKey of allowedTypes) {
    if (typeKey === 'custom') {
      const customExts = normalizeCustomExtensions(customExtensions);
      customExts.forEach((ext) => acceptedExtensions.add(ext));
    } else if (FILE_TYPE_PRESETS[typeKey]) {
      FILE_TYPE_PRESETS[typeKey].extensions.forEach((ext) => acceptedExtensions.add(ext));
      FILE_TYPE_PRESETS[typeKey].mimeTypes.forEach((mime) => acceptedMimeTypes.add(mime));
    }
  }

  const matchesExt = acceptedExtensions.has(fileExt);
  const matchesMime = fileMime ? acceptedMimeTypes.has(fileMime) : false;

  if (matchesExt || matchesMime) {
    return { valid: true };
  }

  const acceptedExtList = Array.from(acceptedExtensions).join(', ');
  return {
    valid: false,
    error: acceptedExtList
      ? `Invalid file format "${fileExt || file.name}". Allowed formats: ${acceptedExtList}`
      : `Invalid file format "${fileExt || file.name}".`,
  };
}

/**
 * Validates a file's size against maximum limit in megabytes
 */
export function validateFileSize(
  file: File,
  maxFileSizeMB: number = 25
): { valid: boolean; error?: string } {
  const maxBytes = maxFileSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File "${file.name}" (${formatFileSize(file.size)}) exceeds the ${maxFileSizeMB}MB limit.`,
    };
  }
  return { valid: true };
}

/**
 * Splits comma-separated or array-based file URLs into clean, trimmed URLs
 */
export function splitFileUrls(value?: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0 && item.startsWith('http'));
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.startsWith('http'));
  }
  return [];
}

/**
 * Formats file size in bytes to human-readable string (e.g. "1.4 MB")
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const formatted = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${formatted} ${units[i] || 'B'}`;
}
