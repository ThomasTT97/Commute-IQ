import { Language, CommuteSettings, Coordinates } from './types';

export const ROAD_DETOUR_FACTOR = 1.28;
export const CACHE_KEY = 'commute_iq_pulse_cache_v2';
export const AVG_TRAINING_SPEED = 28; // km/h
export const APP_VERSION = "3.0.2"; // Thermal Logic V2

export const RELEASE_NOTES = {
  version: APP_VERSION,
  features: [
    {
      title: "Thermal Logic V2",
      description: "Ground temperature estimation now accounts for the 'blanket effect' of humidity. This prevents false ice positives in damp conditions (e.g., 3°C Air / 98% Humidity) where clouds prevent radiative cooling.",
      icon: "Snowflake"
    },
    {
      title: "Physics Model Tuning",
      description: "Adjusted radiative cooling coefficients for clear vs. cloudy nights to better predict black ice formation windows.",
      icon: "Activity"
    }
  ]
};

export const BELGIAN_CITIES: Record<string, Coordinates> = {
  "Antwerpen": { lat: 51.2194, lng: 4.4025 },
  "Gent": { lat: 51.0543, lng: 3.7174 },
  "Brugge": { lat: 51.2093, lng: 3.2247 },
  "Leuven": { lat: 50.8798, lng: 4.7005 },
  "Hasselt": { lat: 50.9307, lng: 5.3325 },
  "Brussel": { lat: 50.8503, lng: 4.3517 },
  "Mechelen": { lat: 51.0259, lng: 4.4773 },
  "Oostende": { lat: 51.2154, lng: 2.9270 },
  "Kortrijk": { lat: 50.8280, lng: 3.2649 },
  "Sint-Niklaas": { lat: 51.1644, lng: 4.1397 },
  "Aalst": { lat: 50.9378, lng: 4.0408 },
  "Genk": { lat: 50.9655, lng: 5.5008 },
  "Roeselare": { lat: 50.9442, lng: 3.1253 },
};

export const DEFAULT_SETTINGS: CommuteSettings = {
  homeLocation: 'Antwerpen',
  homeCoords: { lat: 51.2194, lng: 4.4025 },
  workLocation: 'Brussel',
  workCoords: { lat: 50.8503, lng: 4.3517 },
  morningWindow: ['07:30', '09:00'],
  eveningWindow: ['16:30', '18:30'],
  language: 'en',
  theme: 'dark',
  disableAI: false,
  equipment: [
    {
      id: 'default-road',
      name: 'ROAD MACHINE',
      type: 'Road Bike',
      tireWidth: 28,
      riderWeight: 75,
      tireSetup: 'Tubeless',
      surfacePreference: 0,
      isSelected: true
    }
  ],
  averageSpeed: 25,
  commuteCompensation: 0.31,
  manualCommuteHistory: {},
  fitnessGoal: 'commute',
  workDays: [1, 2, 3, 4, 5]
};

export const TRANSLATIONS: Record<Language, any> = {
  en: {
    morning: "Morning Ride",
    evening: "Evening Return",
    quickStart: "Tactical Quick Start",
    quickStartContent: "1. Configure your machines in the Garage.\n2. Set Home & Work locations.\n3. Monitor the Safety Score for daily go/no-go decisions.\n4. Use Training Mode to find the 'Golden Window' of optimal weather.",
    purposeTitle: "The Mission",
    purposeContent: "Commute IQ translates meteorological telemetry into cycling intelligence. We don't just show rain; we predict surface traction recovery and evaluate thermal inertia for ice risk.",
    commuteScore: "The Safety Score",
    commuteScoreContent: "A 0-100 algorithm factoring in wind vectors, precipitation intensity, darkness, and ice probability. 70+ is optimal; <30 requires extreme caution.",
    trainingMode: "Training Optimization",
    trainingModeContent: "Analyzes the 24-hour horizon to pinpoint the single hour with peak safety and performance metrics.",
    generalSources: "Telemetry Sources",
    generalSourcesContent: "Primary atmospheric data from Open-Meteo and Met.no. Geo-resolution via OpenStreetMap. Reasoning via Google Gemini 3.0 Flash.",
    iceRisk: "Thermal Inertia Model",
    iceRiskContent: "We analyze ground history. If humidity is high and temps were sub-zero in the last 6 hours, we flag ice risk even if current air temp is positive.",
    surfaceCondition: "Surface Diagnostics",
    surfaceConditionContent: "A drying-rate model that estimates road saturation based on humidity, wind, and solar radiation decay.",
    windCondition: "Aero Impact",
    windConditionContent: "Calculates heading-specific vectors. Headwinds decrease efficiency; lateral gusts (>40km/h) compromise stability.",
    windContent: "Calculates heading-specific vectors. Headwinds decrease efficiency; lateral gusts (>40km/h) compromise stability.",
    lightingCondition: "Visibility Protocol",
    lightingContent: "Compares route timing with astronomical sunrise/sunset. Recommends active illumination based on solar position.",
    equipmentLogic: "Mechanical Optimization",
    equipmentContent: "Calibrates tire pressure (Bar) based on system weight, tire volume, and surface dampness."
  },
  fr: {
    morning: "Trajet Matinal",
    evening: "Retour Soirée",
    // Fallback to EN for simplicity in this demo or full FR if required
    quickStart: "Démarrage Rapide",
    quickStartContent: "Configurez vos vélos et lieux pour optimiser vos trajets.",
    purposeTitle: "La Mission",
    purposeContent: "Traduire la météo en intelligence cycliste actionnable.",
    commuteScore: "Score de Sécurité",
    commuteScoreContent: "Un algorithme de 0 à 100 basé sur le vent, la pluie et le verglas.",
    trainingMode: "Mode Entraînement",
    trainingModeContent: "Trouve l'heure idéale pour rouler.",
    generalSources: "Sources de Données",
    generalSourcesContent: "Open-Meteo, Met.no et Google Gemini AI.",
    iceRisk: "Risque de Verglas",
    iceRiskContent: "Analyse de l'inertie thermique au sol.",
    surfaceCondition: "État de Surface",
    surfaceConditionContent: "Estimation du temps de séchage de la route.",
    windCondition: "Impact du Vent",
    windContent: "Calcul de l'impact des vents de face et latéraux.",
    lightingCondition: "Visibilité",
    lightingContent: "Analyse des cycles solaires pour l'éclairage.",
    equipmentLogic: "Optimisation Matériel",
    equipmentContent: "Calcul de la pression des pneus idéale."
  },
  nl: {
    morning: "Ochtendrit",
    evening: "Avondrit",
    quickStart: "Snelle Start",
    quickStartContent: "Stel je fietsen en locaties in om je ritten te optimaliseren.",
    purposeTitle: "De Missie",
    purposeContent: "Meteo-data vertalen naar actiegerichte fiets-intelligentie.",
    commuteScore: "Veiligheidsscore",
    commuteScoreContent: "Een algoritme van 0 tot 100 gebaseerd op wind, regen en ijzel.",
    trainingMode: "Trainingsmodus",
    trainingModeContent: "Vindt het ideale uur om te trainen.",
    generalSources: "Databronnen",
    generalSourcesContent: "Open-Meteo, Met.no en Google Gemini AI.",
    iceRisk: "IJzelrisico",
    iceRiskContent: "Analyse van thermische traagheid van het wegdek.",
    surfaceCondition: "Wegdek Conditie",
    surfaceConditionContent: "Schatting van de droogtijd van de weg.",
    windCondition: "Wind Impact",
    windContent: "Berekening van tegenwind en zijwind impact.",
    lightingCondition: "Zichtbaarheid",
    lightingContent: "Analyse van zonnecycli voor verlichting.",
    equipmentLogic: "Materiaal Optimalisatie",
    equipmentContent: "Berekening van de ideale bandenspanning."
  }
};