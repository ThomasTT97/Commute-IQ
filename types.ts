
import { BelgianLocation } from './locations'; 

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
  morningWindow: [string, string];
  eveningWindow: [string, string];
  roadDistance?: number;
  language: Language;
  theme: 'dark' | 'light';
  disableAI: boolean;
}

export interface ScoreDeduction {
  label: string;
  val: number;
}

export interface LocationSuggestion extends BelgianLocation {
  distanceFromHome?: number;
  distanceFromTrainingCenter?: number;
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
  score: number;
  condition: 'Sunny' | 'Rainy' | 'Cloudy' | 'Windy' | 'Stormy';
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  isDark: boolean;
  slipperyChance: number; 
  wetSurfaceChance: number; 
  headwindImpact: number;
  iceRisk: boolean; 
  overnightFreeze?: boolean;
  activeFreezing?: boolean;
  minPastTemp?: number; 
  surfaceReason?: string;
  lastPrecipitationTime?: string;
  precipDuringSession: number;
  scoreBreakdown?: ScoreDeduction[];
  sunrise?: string;
  sunset?: string;
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
