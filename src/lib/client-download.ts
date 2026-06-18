/**
 * Trigger a browser download of in-memory text content. Client-only.
 * Used e.g. to export call scripts as `.cflow` files.
 */
export function downloadTextFile(
  filename: string,
  text: string,
  mime = 'application/json'
): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Release the object URL on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
