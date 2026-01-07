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
 */
export const filterLocationsWithGlobal = (query: string, globalResults: BelgianLocation[]) => {
  if (query.length < 2) return [];
  
  // Get unique results from internal Belgian list for speed
  const local = BELGIAN_LOCATIONS.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
  const uniqueLocal = local.filter((loc, index, self) =>
    index === self.findIndex((t) => t.name === loc.name)
  );
  
  // Combine with global API results (Europe)
  const combined = [...globalResults];
  
  // Add local results if they aren't already in global set
  uniqueLocal.forEach(l => {
    if (!combined.some(g => g.name.toLowerCase() === l.name.toLowerCase())) {
      combined.push(l);
    }
  });

  return combined.slice(0, 8);
};
