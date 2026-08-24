/**
 * SmartSapp Finance 2.0 - Universal Report Export Service
 * Modular CSV & Tabular Exporter handling multi-currency formatting, escaping, and browser downloads.
 */

export interface ExportCsvOptions {
  filename: string;
  title?: string;
  headers: string[];
  rows: (string | number | undefined | null)[][];
  summaryRows?: (string | number | undefined | null)[][];
}

export class ReportExportService {
  /**
   * Sanitizes and escapes CSV cells against formula injection and delimiters.
   */
  static escapeCsvCell(val: string | number | undefined | null): string {
    if (val === undefined || val === null) return '""';
    let str = String(val);

    // Prevent CSV formula injection in spreadsheet software
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
      str = `'${str}`;
    }

    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  }

  /**
   * Compiles and triggers an immediate client-side CSV download.
   */
  static exportToCsv(options: ExportCsvOptions): void {
    const { filename, title, headers, rows, summaryRows } = options;

    const lines: string[] = [];

    if (title) {
      lines.push(this.escapeCsvCell(title));
      lines.push(this.escapeCsvCell(`Generated: ${new Date().toISOString()}`));
      lines.push('');
    }

    // Header row
    lines.push(headers.map(h => this.escapeCsvCell(h)).join(','));

    // Data rows
    for (const row of rows) {
      lines.push(row.map(c => this.escapeCsvCell(c)).join(','));
    }

    // Summary / Footer rows
    if (summaryRows && summaryRows.length > 0) {
      lines.push('');
      for (const sRow of summaryRows) {
        lines.push(sRow.map(c => this.escapeCsvCell(c)).join(','));
      }
    }

    const csvString = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    const cleanName = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    link.setAttribute('download', cleanName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
