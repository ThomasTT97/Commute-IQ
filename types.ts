
import { BelgianLocation } from './locations'; 

export type Language = 'en' | 'fr' | 'nl';

export interface Coordinates {
  lat: number;
  lng: number;
}

export type EquipmentType = 'Road Bike' | 'Gravel Bike' | 'Mountainbike' | 'Speedpedelec';

export type TireSetup = 'Tubeless' | 'Tubular' | 'Clincher (Butyl)' | 'Clincher (TPU)' | 'Clincher (Latex)';

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  tireWidth: number; // mm
  riderWeight: number; // kg
  tireSetup?: TireSetup; // Optional for backward compatibility
  isSelected: boolean;
}

export type FitnessGoal = 'commute' | 'active' | 'fitness';

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
  equipment: Equipment[];
  averageSpeed: number;
  fitnessGoal: FitnessGoal;
  workDays: number[]; // 0=Sun, 1=Mon...
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
  ridingStyleAdvice?: string;
  bikeSetupAdvice?: string;
  clothingAdvice?: string;
  performanceAdvice?: string;
  lastPrecipitationTime?: string;
  estimatedDryTime?: number; // Unix timestamp in ms
  precipDuringSession: number;
  scoreBreakdown?: ScoreDeduction[];
  sunrise?: string;
  sunset?: string;
  optimalPressure?: string;
}

export interface ConnectionStatusState {
  'Open-Meteo': 'checking' | 'ok' | 'fail' | 'fallback';
  'Gemini LLM': 'checking' | 'ok' | 'fail' | 'fallback';
  'Google Maps': 'checking' | 'ok' | 'fail' | 'fallback';
  llmDetails: { model: string | null; priority: string | null; alternatives: number | null };
  lastWeatherUpdate?: number;
  errorMessage?: string;
}