
import { BelgianLocation } from "../locations";
import { BELGIAN_LOCATIONS } from "../locations";

export const getLocality = (address: string): string => {
  if (!address) return '---';
  const parts = address.split(',').map(p => p.trim());
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

export const filterLocationsWithGlobal = (query: string, globalResults: BelgianLocation[]) => {
  if (query.length < 2) return [];
  const local = BELGIAN_LOCATIONS.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
  const uniqueLocal = local.filter((loc, index, self) =>
    index === self.findIndex((t) => t.name === loc.name)
  ).slice(0, 5);
  
  const filteredGlobal = globalResults.filter(g => !uniqueLocal.some(l => l.name.toLowerCase() === g.name.toLowerCase()));
  return [...uniqueLocal, ...filteredGlobal].slice(0, 8);
};
