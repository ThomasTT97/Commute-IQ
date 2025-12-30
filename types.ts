export type Language = 'en' | 'fr' | 'nl';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface CommuteSettings {
  homeLocation: string;
  homeCoords?: Coordinates;
  workLocation: string;
  workCoords?: Coordinates;
  morningWindow: [string, string]; // [start, end] e.g. ["07:30", "09:00"]
  eveningWindow: [string, string]; // [start, end]
  roadDistance?: number;
  language: Language;
  theme: 'dark' | 'light';
  disableAI: boolean;
}

export interface LocationSuggestion {
  name: string;
  distanceFromHome?: number; // Made optional, as not always present
  distanceFromTrainingCenter?: number; // Added for training specific advice
  score?: number;
}

export interface TrainingState {
  location: string;
  coords: Coordinates;
  distance: number;
  dateOffset: number;
  preferredDirection: number; 
}

export interface WeatherCondition {
  temp: number;
  minTemp?: number;
  maxTemp?: number;
  condition: 'Sunny' | 'Rainy' | 'Cloudy' | 'Windy' | 'Stormy';
  precipitation: number;
  windSpeed: number;
  windDirection: number; // Degrees
  humidity: number;
  isDark: boolean;
  slipperyChance: number; 
  wetSurfaceChance: number; 
  headwindImpact: number; // -100 to 100
  iceRisk: boolean; 
  overnightFreeze?: boolean;
  activeFreezing?: boolean;
  surfaceReason?: string;
}

export interface CommuteInsight {
  day: string;
  morning: WeatherCondition;
  evening: WeatherCondition;
  score: number;
}

export interface RouteOption {
  id: string;
  name: string;
  description: string;
  distance: number;
  estimatedTime: number;
  headwindFactor: number;
  bendsCount: number;
  waypoints: { x: number; y: number }[];
  gpxString?: string;
}

export interface ClothingAdvice {
  baseLayer: string;
  midLayer: string;
  outerLayer: string;
  accessories: string[];
  reasoning: string;
}