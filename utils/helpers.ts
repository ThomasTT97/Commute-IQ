
import { BelgianLocation } from "../locations";
import { BELGIAN_LOCATIONS } from "../locations";

export const getLocality = (address: string): string => {
  if (!address) return '---';
  const parts = address.split(',').map(p => p.trim());
  // For European addresses, if there's only one part it's likely just the city/street
  // We remove leading numbers for the locality label
  return parts[0].replace(/^\d+\s+/, '').toUpperCase();
};

export function shuffleArray<T>(array: T[]): T[] {
  let currentIndex: number = array.length; 
  let randomIndex: number;
  const newArray = [...array]; 
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [newArray[currentIndex], newArray[randomIndex]] = [
      newArray[randomIndex], newArray[currentIndex]];
  }
  return newArray;
};

/**
 * Merges internal Belgian registry with global European API results.
 * Strictly avoids duplicates by normalizing names.
 */
export const filterLocationsWithGlobal = (query: string, globalResults: BelgianLocation[]) => {
  if (query.length < 2) return [];
  
  const normalizedQuery = query.toLowerCase();
  const seenNames = new Set<string>();
  const finalResults: BelgianLocation[] = [];

  // Helper to add if name is unique (normalized)
  const addIfUnique = (loc: BelgianLocation) => {
    // Normalize name for comparison: take part before comma, trim, lowercase
    const baseName = loc.name.split(',')[0].trim().toLowerCase();
    if (!seenNames.has(baseName)) {
      seenNames.add(baseName);
      finalResults.push(loc);
      return true;
    }
    return false;
  };

  // 1. Prioritize global results but check for duplicates
  globalResults.forEach(addIfUnique);

  // 2. Add local results from static database
  const local = BELGIAN_LOCATIONS.filter(l => l.name.toLowerCase().includes(normalizedQuery));
  local.forEach(addIfUnique);

  return finalResults.slice(0, 8);
};
