export type PreviewDevice = 'mobile' | 'tablet' | 'desktop';

/**
 * Returns the target pixel width for the given preview device.
 * @param device The device to preview
 * @returns The pixel width
 */
export function getTargetViewportWidth(device: PreviewDevice): number {
  switch (device) {
    case 'mobile':
      return 390;
    case 'tablet':
      return 768;
    case 'desktop':
      return 1200;
  }
}

/**
 * Calculates the CSS scale transform value for the preview iframe.
 * 
 * @param fitMode Whether to automatically scale the preview to fit the container
 * @param containerWidth The available width in the preview container
 * @param device The current preview device mode
 * @param zoomPercent Manual zoom percentage (e.g. 50, 75, 100)
 * @param padding Horizontal padding to reserve in fit mode
 * @returns Scale multiplier (e.g. 0.5 for 50%)
 */
export function calculatePreviewScale(
  fitMode: boolean,
  containerWidth: number,
  device: PreviewDevice,
  zoomPercent: number,
  padding: number = 32
): number {
  if (!fitMode) {
    return zoomPercent / 100;
  }

  const targetWidth = getTargetViewportWidth(device);
  const availableWidth = containerWidth - padding;
  
  if (availableWidth <= 0) return 1; // Fallback for edge cases where container hasn't sized yet

  // If container is smaller than target viewport, scale down.
  // Otherwise, cap at 1 (100%) so we don't scale up past native resolution.
  return Math.min(1, availableWidth / targetWidth);
}
