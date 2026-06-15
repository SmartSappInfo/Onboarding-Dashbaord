export interface JSONDiffResult {
  editDistance: number;
  corrections: {
    addedKeys: string[];
    removedKeys: string[];
    modifiedValues: string[];
  };
}

/**
 * Calculates a semantic structural edit distance between initial and final JSON outputs.
 * Returns a normalized float between 0.0 (perfect generation) and 1.0 (complete rewrite).
 * Matches array elements by their unique 'id' parameter if present to ignore reordering shifts.
 */
export function calculateJsonDiff(initial: any, final: any): JSONDiffResult {
  const result = {
    addedKeys: [] as string[],
    removedKeys: [] as string[],
    modifiedValues: [] as string[],
  };

  const traverseAndDiff = (initObj: any, finObj: any, path: string = '') => {
    // If types differ, it's a complete overwrite at this node
    if (typeof initObj !== typeof finObj || Array.isArray(initObj) !== Array.isArray(finObj)) {
      result.modifiedValues.push(path || 'root');
      return;
    }

    // Handle Null/Undefined values
    if (initObj === null || finObj === null || initObj === undefined || finObj === undefined) {
      if (initObj !== finObj) {
        result.modifiedValues.push(path || 'root');
      }
      return;
    }

    // Handle Arrays (e.g. survey elements, automation steps, template blocks)
    if (Array.isArray(initObj)) {
      // Check if all elements in both arrays are objects and have an 'id' property
      const hasIds = initObj.every((item: any) => item && typeof item === 'object' && 'id' in item) &&
                      finObj.every((item: any) => item && typeof item === 'object' && 'id' in item);

      if (hasIds) {
        const initMap = new Map<string, any>(initObj.map((item: any) => [String(item.id), item]));
        const finMap = new Map<string, any>(finObj.map((item: any) => [String(item.id), item]));

        initMap.forEach((val, id) => {
          if (!finMap.has(id)) {
            result.removedKeys.push(`${path ? `${path}.` : ''}[id=${id}]`);
          } else {
            traverseAndDiff(val, finMap.get(id), `${path ? `${path}.` : ''}[id=${id}]`);
          }
        });

        finMap.forEach((val, id) => {
          if (!initMap.has(id)) {
            result.addedKeys.push(`${path ? `${path}.` : ''}[id=${id}]`);
          }
        });
      } else {
        const maxLength = Math.max(initObj.length, finObj.length);
        for (let i = 0; i < maxLength; i++) {
          if (initObj[i] === undefined) {
            result.addedKeys.push(`${path ? `${path}.` : ''}[${i}]`);
          } else if (finObj[i] === undefined) {
            result.removedKeys.push(`${path ? `${path}.` : ''}[${i}]`);
          } else {
            traverseAndDiff(initObj[i], finObj[i], `${path ? `${path}.` : ''}[i]`);
          }
        }
      }
      return;
    }

    // Handle Objects
    if (typeof initObj === 'object') {
      const initKeys = Object.keys(initObj);
      const finKeys = Object.keys(finObj);

      initKeys.forEach(key => {
        if (!finKeys.includes(key)) {
          result.removedKeys.push(`${path ? `${path}.` : ''}${key}`);
        } else {
          traverseAndDiff(initObj[key], finObj[key], `${path ? `${path}.` : ''}${key}`);
        }
      });

      finKeys.forEach(key => {
        if (!initKeys.includes(key)) {
          result.addedKeys.push(`${path ? `${path}.` : ''}${key}`);
        }
      });
      return;
    }

    // Handle Primitives (number, string, boolean, etc.)
    if (initObj !== finObj) {
      result.modifiedValues.push(path);
    }
  };

  try {
    traverseAndDiff(initial, final);
  } catch (error) {
    console.error('[JSON-DIFF] Error traversing JSON shapes:', error);
    return {
      editDistance: 1.0, // fallback to complete rewrite
      corrections: { addedKeys: [], removedKeys: [], modifiedValues: ['root_traversal_error'] }
    };
  }

  // Heuristic calculation: total differences divided by the size of the final object
  const totalEdits = result.addedKeys.length + result.removedKeys.length + result.modifiedValues.length;
  
  let totalNodes = 1;
  try {
    totalNodes = JSON.stringify(final || {}).split(/[:{[,]/).length || 1;
  } catch (stringifyError) {
    console.error('[JSON-DIFF] Error serializing final object for nodes count:', stringifyError);
  }

  const editDistance = Math.min(totalEdits / Math.max(1, totalNodes), 1.0);

  return {
    editDistance,
    corrections: result,
  };
}
