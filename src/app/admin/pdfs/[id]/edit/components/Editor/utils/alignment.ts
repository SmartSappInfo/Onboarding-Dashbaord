import { LocalPDFFormField, AlignmentType, DistributionType } from '../types';

/**
 * Calculates new positions for a set of fields based on an alignment type.
 */
export function calculateAlignment(
  selectedFields: LocalPDFFormField[],
  type: AlignmentType
): Record<string, { x: number; y: number }> {
  if (selectedFields.length < 2) return {};

  const updates: Record<string, { x: number; y: number }> = {};

  switch (type) {
    case 'left': {
      const minX = Math.min(...selectedFields.map(f => f.position.x));
      selectedFields.forEach(f => {
        updates[f.id] = { x: minX, y: f.position.y };
      });
      break;
    }
    case 'top': {
      const minY = Math.min(...selectedFields.map(f => f.position.y));
      selectedFields.forEach(f => {
        updates[f.id] = { x: f.position.x, y: minY };
      });
      break;
    }
    case 'right': {
      const maxRight = Math.max(...selectedFields.map(f => f.position.x + f.dimensions.width));
      selectedFields.forEach(f => {
        updates[f.id] = { x: maxRight - f.dimensions.width, y: f.position.y };
      });
      break;
    }
    case 'bottom': {
      const maxBottom = Math.max(...selectedFields.map(f => f.position.y + f.dimensions.height));
      selectedFields.forEach(f => {
        updates[f.id] = { x: f.position.x, y: maxBottom - f.dimensions.height };
      });
      break;
    }
    case 'center-h': {
      const minX = Math.min(...selectedFields.map(f => f.position.x));
      const maxX = Math.max(...selectedFields.map(f => f.position.x + f.dimensions.width));
      const midX = (minX + maxX) / 2;
      selectedFields.forEach(f => {
        updates[f.id] = { x: midX - (f.dimensions.width / 2), y: f.position.y };
      });
      break;
    }
    case 'center-v': {
      const minY = Math.min(...selectedFields.map(f => f.position.y));
      const maxY = Math.max(...selectedFields.map(f => f.position.y + f.dimensions.height));
      const midY = (minY + maxY) / 2;
      selectedFields.forEach(f => {
        updates[f.id] = { x: f.position.x, y: midY - (f.dimensions.height / 2) };
      });
      break;
    }
  }

  return updates;
}

/**
 * Calculates new positions for a set of fields to distribute them evenly.
 */
export function calculateDistribution(
  selectedFields: LocalPDFFormField[],
  type: DistributionType
): Record<string, { x: number; y: number }> {
  if (selectedFields.length < 3) return {};

  const updates: Record<string, { x: number; y: number }> = {};
  const sorted = [...selectedFields].sort((a, b) => 
    type === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
  );

  const start = type === 'horizontal' ? sorted[0].position.x : sorted[0].position.y;
  const lastItem = sorted[sorted.length - 1];
  const end = type === 'horizontal' 
    ? (lastItem.position.x + lastItem.dimensions.width) 
    : (lastItem.position.y + lastItem.dimensions.height);

  const totalSize = sorted.reduce((sum, f) => 
    sum + (type === 'horizontal' ? f.dimensions.width : f.dimensions.height), 0
  );

  const gap = (end - start - totalSize) / (sorted.length - 1);
  let currentPos = start;

  sorted.forEach(f => {
    updates[f.id] = type === 'horizontal' 
      ? { x: currentPos, y: f.position.y }
      : { x: f.position.x, y: currentPos };
    
    currentPos += (type === 'horizontal' ? f.dimensions.width : f.dimensions.height) + gap;
  });

  return updates;
}
