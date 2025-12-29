
import { GoogleGenAI, Type } from "@google/genai";
import { CommuteSettings, WeatherCondition, Language, Coordinates } from "../types";
import { BELGIAN_CITIES } from "../constants";

// Track the last error for UI reporting
export let lastApiErrorMessage: string | null = null;
export let lastApiErrorType: 'telemetry' | 'gemini' | 'maps' | null = null;

/**
 * Optimized Model Chain for Intelligence:
 * Prioritizing "Flash Lite" models for high-speed, low-latency interpretation of the pre-calculated data.
 */
const MODEL_CHAIN = [
  "gemini-2.0-flash-lite-preview-02-04", // Latest specific Flash Lite
  "gemini-flash-lite-latest",             // Stable alias for Flash Lite
  "gemini-2.0-flash-exp"                  // Fallback experimental
];

const callWithRetry = async <T>(
  fn: (aiInstance: GoogleGenAI, modelName: string) => Promise<T>, 
  maxRetriesPerModel = 1
): Promise<{ data: T; model: string }> => {
  let lastFnError: any;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  for (const modelName of MODEL_CHAIN) {
    for (let i = 0; i <= maxRetriesPerModel; i++) {
      try {
        const result = await fn(ai, modelName);
        return { data: result, model: modelName };
      } catch (error: any) {
        lastFnError = error;
        const status = error?.status || error?.statusCode;
        if ((status >= 500 && status <= 599 || status === 429) && i < maxRetriesPerModel) {
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
          continue;
        }
        break;
      }
    }
  }
  throw lastFnError;
};

const calculateBearing = (start: Coordinates, end: Coordinates): number => {
  const startLat = (start.lat * Math.PI) / 180;
  const startLng = (start.lng * Math.PI) / 180;
  const endLat = (end.lat * Math.PI) / 180;
  const endLng = (end.lng * Math.PI) / 180;
  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const calculateAverageWindImpact = (heading: number, directions: number[]): number => {
  if (!directions.length) return 0;
  const radHeading = (heading * Math.PI) / 180;
  let totalImpact = 0;
  directions.forEach(dir => {
    totalImpact += Math.cos(radHeading - (dir * Math.PI) / 180);
  });
  return (totalImpact / directions.length) * 100;
};

// Helper to parse time string "HH:MM" or ISO "YYYY-MM-DDTHH:MM" to minutes from midnight
const getMinutes = (timeStr: string): number => {
  const t = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Helper to determine condition string from WMO code and wind
const resolveCondition = (code: number, windSpeed: number, precip: number): WeatherCondition['condition'] => {
  if (code >= 95) return 'Stormy';
  if (code >= 51 || precip > 0.5) return 'Rainy';
  if (windSpeed > 35) return 'Windy';
  if (code <= 1) return 'Sunny';
  return 'Cloudy'; // Covers 2, 3, 45, 48
};

// Deterministic Scoring Algorithm
// Prioritizes safety indicators, specifically Ice Risk.
const calculateSegmentScore = (w: WeatherCondition): number => {
  let score = 100;
  
  // 1. Ice Risk (Highest critical weight)
  // If ice is present, the ride is inherently dangerous. Max score capped significantly.
  if (w.iceRisk) {
    score -= 70; 
  }

  // 2. Precipitation / Wetness
  if (w.precipitation > 0) {
    score -= 20; // Base wet penalty
    score -= Math.min(20, w.precipitation * 4); // Intensity penalty
  } else if (w.wetSurfaceChance > 50) {
    score -= 10;
  }

  // 3. Wind
  if (w.windSpeed > 15) {
    score -= (w.windSpeed - 15) * 1.5;
  }
  // Headwind Impact (-100 to 100)
  if (w.headwindImpact > 20) {
    score -= (w.headwindImpact / 4); 
  } else if (w.headwindImpact < -20) {
    score += 5; // Tailwind bonus
  }

  // 4. Temperature
  if (w.temp < 5) {
    score -= (5 - w.temp) * 2;
  } else if (w.temp > 28) {
    score -= (w.temp - 28) * 2;
  }

  // 5. Darkness
  if (w.isDark) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
};

// Deterministically aggregate raw hourly data into a single WeatherCondition object
const aggregateRawWeather = (
  rawSlice: any, 
  heading: number, 
  isMorning: boolean,
  settings: CommuteSettings,
  sunTimes?: { sunrise: string, sunset: string },
  minPastTemp: number = 99 // Min temperature in the 6 hours preceding the commute
): WeatherCondition => {
  const temps = (rawSlice.temperature_2m || []) as number[];
  const precips = (rawSlice.precipitation || []) as number[];
  const winds = (rawSlice.wind_speed_10m || []) as number[];
  const dirs = (rawSlice.wind_direction_10m || []) as number[];
  const codes = (rawSlice.weather_code || []) as number[];
  const humidities = (rawSlice.relative_humidity_2m || []) as number[];

  if (temps.length === 0) {
    // Return a safe default if slice is empty (shouldn't happen with correct logic)
    return {
      temp: 15, condition: 'Cloudy', precipitation: 0, windSpeed: 10, windDirection: 0,
      humidity: 50, isDark: false, slipperyChance: 0, wetSurfaceChance: 0, headwindImpact: 0,
      iceRisk: false, surfaceReason: "Data unavailable"
    };
  }

  // Calculate averages/max/sums/min
  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
  const minTemp = Math.min(...temps); // Instantaneous min temp during commute
  const totalPrecip = precips.reduce((a, b) => a + b, 0);
  const maxWind = Math.max(...winds);
  const avgDir = dirs.reduce((a, b) => a + b, 0) / dirs.length;
  const avgHum = humidities.reduce((a, b) => a + b, 0) / humidities.length;
  const maxCode = Math.max(...codes);

  // Determine derived attributes
  const condition = resolveCondition(maxCode, maxWind, totalPrecip);
  const headwindImpact = Math.round(calculateAverageWindImpact(heading, dirs));
  
  // Time window logic for darkness
  const timeWindow = isMorning ? settings.morningWindow : settings.eveningWindow;
  
  let isDark = false;
  if (sunTimes) {
    const commuteStart = getMinutes(timeWindow[0]);
    const commuteEnd = getMinutes(timeWindow[1]);
    const sunrise = getMinutes(sunTimes.sunrise);
    const sunset = getMinutes(sunTimes.sunset);
    
    // Dark if starting before sunrise OR ending after sunset
    isDark = commuteStart < sunrise || commuteEnd > sunset;
  } else {
    // Fallback if sun times missing
    const startHour = parseInt(timeWindow[0].split(':')[0]);
    isDark = startHour < 6 || startHour >= 21; 
  }

  // Improved Ice Risk Logic (Thermal Inertia Model)
  // We check if the air was freezing in the previous 6 hours. 
  // If so, the road surface is likely still cold (hysteresis) even if air temp rose slightly.
  
  const hasMoisture = totalPrecip > 0 || avgHum > 80; // High humidity or rain required for ice
  
  // 1. Active Freezing: Air is currently freezing
  const freezingNow = minTemp <= 0;
  
  // 2. Latent Surface Ice: Ground was freezing recently (past 6h) AND air is still cold (<= 4°C)
  // This accounts for frozen ground not melting immediately when air temp rises to 1-4°C
  const surfaceLikelyFrozen = (minPastTemp <= 0) && (minTemp <= 4);

  const iceRisk = hasMoisture && (freezingNow || surfaceLikelyFrozen);

  return {
    temp: parseFloat(avgTemp.toFixed(1)),
    condition,
    precipitation: parseFloat(totalPrecip.toFixed(1)),
    windSpeed: parseFloat(maxWind.toFixed(1)),
    windDirection: Math.round(avgDir),
    humidity: Math.round(avgHum),
    isDark,
    slipperyChance: totalPrecip > 0 ? 60 : (avgTemp < 3 ? 40 : 10),
    wetSurfaceChance: totalPrecip > 0 ? 90 : 10,
    headwindImpact,
    iceRisk, 
    surfaceReason: undefined // Leave empty, to be filled by AI or default
  };
};

const fetchRawWeatherData = async (coords: Coordinates) => {
  // Added &daily=sunrise,sunset
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&timezone=auto&forecast_days=10`;
  const res = await fetch(url);
  if (!res.ok) {
    lastApiErrorMessage = "Weather telemetry offline.";
    lastApiErrorType = 'telemetry';
    throw new Error(lastApiErrorMessage);
  }
  return res.json();
};

const sliceWeatherData = (raw: any, window: [string, string], dateOffset: number) => {
  if (!raw || !raw.time) return {};
  const startHour = parseInt(window[0].split(':')[0]);
  const endHour = parseInt(window[1].split(':')[0]);
  const baseIdx = dateOffset * 24;
  const startIndex = Math.max(0, baseIdx + startHour);
  const endIndex = Math.min(raw.time.length - 1, baseIdx + endHour);
  const sliced: any = {};
  Object.keys(raw).forEach(key => { 
    if (Array.isArray(raw[key])) { sliced[key] = raw[key].slice(startIndex, endIndex + 1); }
  });
  return sliced;
};

// Fallback data only used if Telemetry (Open-Meteo) fails completely
const generateDummyData = (offset: number, settings: CommuteSettings): any => {
  const scenarios = [
    { name: "Perfect", temp: 19, cond: "Sunny", wind: 8, impact: -40, rain: 0, ice: false, score: 98, reason: "Simulation: Telemetry Offline." },
    { name: "Morning Damp", temp: 11, cond: "Cloudy", wind: 15, impact: 20, rain: 0.1, ice: false, score: 72, reason: "Simulation: Telemetry Offline." },
  ];
  const s = scenarios[offset % scenarios.length];
  const weatherBase = {
    temp: s.temp, condition: s.cond as 'Sunny', windSpeed: s.wind, windDirection: 45,
    humidity: 50, precipitation: s.rain, isDark: false, slipperyChance: 10,
    wetSurfaceChance: 10, headwindImpact: s.impact, iceRisk: s.ice, surfaceReason: s.reason
  };
  return {
    offset, isDummy: true, isSynthesized: true,
    summary: { isWet: s.rain > 0, isIcy: s.ice },
    score: Math.round(s.score),
    weather: { morning: weatherBase, evening: weatherBase }
  };
};

export const getPulseBatch = async (settings: CommuteSettings, offsets: number[]): Promise<Record<number, any>> => {
  const home = settings.homeCoords || { lat: 0, lng: 0 };
  const work = settings.workCoords || { lat: 0, lng: 0 };
  const morningHeading = calculateBearing(home, work);
  const eveningHeading = calculateBearing(work, home);

  let homeRaw: any, workRaw: any;
  let telemetryOffline = false;

  // 1. Fetch Real Telemetry
  try {
    [homeRaw, workRaw] = await Promise.all([
      fetchRawWeatherData(home),
      fetchRawWeatherData(work)
    ]);
  } catch (e) {
    telemetryOffline = true;
    console.error("Telemetry failed:", e);
  }

  // If telemetry is dead, use dummy data immediately
  if (telemetryOffline) {
    const fallback: Record<number, any> = {};
    offsets.forEach(o => { fallback[o] = generateDummyData(o, settings); });
    return fallback;
  }

  // 2. Deterministically Calculate Weather Data (Local Processing)
  const batchContext = offsets.map(offset => {
    const mSlice = sliceWeatherData(homeRaw.hourly, settings.morningWindow, offset);
    const eSlice = sliceWeatherData(workRaw.hourly, settings.eveningWindow, offset);
    
    // Extract sun times (use home location as reference for sun, close enough for commute)
    const sunTimes = {
      sunrise: homeRaw.daily?.sunrise?.[offset] || "07:00",
      sunset: homeRaw.daily?.sunset?.[offset] || "20:00"
    };

    // Calculate thermal history (Lookback 6 hours) for surface inertia
    const mStartHour = parseInt(settings.morningWindow[0].split(':')[0]);
    const mIdx = offset * 24 + mStartHour;
    const mPastTemps = (homeRaw.hourly.temperature_2m || []).slice(Math.max(0, mIdx - 6), mIdx);
    const mMinPastTemp = mPastTemps.length ? Math.min(...mPastTemps) : 10;

    const eStartHour = parseInt(settings.eveningWindow[0].split(':')[0]);
    const eIdx = offset * 24 + eStartHour;
    const ePastTemps = (workRaw.hourly.temperature_2m || []).slice(Math.max(0, eIdx - 6), eIdx);
    const eMinPastTemp = ePastTemps.length ? Math.min(...ePastTemps) : 10;

    const morning = aggregateRawWeather(mSlice, morningHeading, true, settings, sunTimes, mMinPastTemp);
    const evening = aggregateRawWeather(eSlice, eveningHeading, false, settings, sunTimes, eMinPastTemp);
    
    // Calculate deterministic scores
    const mScore = calculateSegmentScore(morning);
    const eScore = calculateSegmentScore(evening);
    
    // The daily score is the minimum of the two legs (weakest link principle)
    const dailyScore = Math.min(mScore, eScore);
    
    // Determine summary flags
    const isWet = (morning.precipitation > 0 || morning.wetSurfaceChance > 50) || 
                  (evening.precipitation > 0 || evening.wetSurfaceChance > 50);
    const isIcy = morning.iceRisk || evening.iceRisk;

    return {
      offset,
      score: dailyScore,
      summary: { isWet, isIcy },
      morning,
      evening,
    };
  });

  const result: Record<number, any> = {};

  // 3. Enhance with AI (Advice Only) using Flash Lite
  try {
    // We send the fully calculated data (including scores) to the AI.
    // The AI's job is reduced to just generating the text advice.
    const { data: parsedAIResults } = await callWithRetry(async (aiInstance, modelName) => {
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: `You are a Belgian Cycling Expert.
        
        Task: Generate short, natural advice strings (max 25 words) for the 'morning' and 'evening' commutes.
        
        CRITICAL: When warning about slippery surfaces, EXPLAIN WHY:
        - If 'iceRisk' is true AND 'temp' > 0: You MUST warn of "Latent Ice" or "Black Ice" (e.g., "Ground frozen from overnight despite warmer air").
        - If 'iceRisk' is true AND 'temp' <= 0: Warn of "Freezing temperatures".
        - If 'wetSurfaceChance' > 50 AND 'precipitation' == 0: Warn of "Residual moisture" or "Damp roads".
        
        Language: ${settings.language}
        
        Input Data (Scores and Conditions are ALREADY calculated): 
        ${JSON.stringify(batchContext.map(({offset, morning, evening}) => ({offset, morning, evening})))}
        
        Return JSON schema: Array of { 
          offset: number, 
          weather: { 
            morning: { surfaceReason: string }, 
            evening: { surfaceReason: string } 
          } 
        }`,
        config: {
          temperature: 0.4,
          responseMimeType: "application/json",
        }
      });
      return JSON.parse(response.text || "[]");
    });

    // Merge AI text results with our robust calculated data
    batchContext.forEach(ctx => {
      const aiRes = parsedAIResults.find((r: any) => r.offset === ctx.offset);
      result[ctx.offset] = {
        offset: ctx.offset,
        score: ctx.score,
        summary: ctx.summary,
        isSynthesized: false,
        weather: {
          morning: { ...ctx.morning, surfaceReason: aiRes?.weather?.morning?.surfaceReason || "Safe ride." },
          evening: { ...ctx.evening, surfaceReason: aiRes?.weather?.evening?.surfaceReason || "Safe ride." }
        }
      };
    });

  } catch (error: any) {
    console.error("AI Analysis failed, using raw data fallback:", error);
    lastApiErrorMessage = "Commute Intelligence offline. Scores are accurate.";
    lastApiErrorType = 'gemini';

    // Fallback: Use the calculated real weather and scores, just add default advice
    batchContext.forEach(ctx => {
      result[ctx.offset] = {
        offset: ctx.offset,
        score: ctx.score,
        summary: ctx.summary,
        isSynthesized: false, 
        weather: {
          morning: { ...ctx.morning, surfaceReason: "AI Unavailable. Metrics are accurate." },
          evening: { ...ctx.evening, surfaceReason: "AI Unavailable. Metrics are accurate." }
        }
      };
    });
  }

  return result;
};

export const resolveAddress = async (query: string, userLoc?: { lat: number, lng: number }): Promise<{ address: string; coords: Coordinates; mapsUri?: string }> => {
  const normalizedQuery = query.trim();
  for (const [name, coords] of Object.entries(BELGIAN_CITIES)) {
    if (name.toLowerCase() === normalizedQuery.toLowerCase()) {
      return { address: name, coords };
    }
  }
  
  try {
    const { data } = await callWithRetry(async (aiInstance, modelName) => {
      const response = await aiInstance.models.generateContent({
        model: modelName, 
        contents: `Extract full address and coordinates for: "${query}". Return JSON: { "address": string, "lat": number, "lng": number }`,
        config: { 
          temperature: 0,
          responseMimeType: "application/json",
          tools: [{ googleMaps: {} }],
        },
      });
      const parsed = JSON.parse(response.text || "{}");
      const mapsUri = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.find(c => c.maps)?.maps?.uri;
      return { ...parsed, mapsUri };
    });
    return { address: data.address || query, coords: { lat: data.lat, lng: data.lng }, mapsUri: data.mapsUri };
  } catch (e) {
    lastApiErrorMessage = "Address resolution offline.";
    lastApiErrorType = 'maps';
    return { address: query, coords: { lat: 50.8503, lng: 4.3517 } }; 
  }
};

export const getCommuteRoadDistance = async (origin: string, destination: string): Promise<number | null> => {
  try {
    const { data } = await callWithRetry(async (aiInstance, modelName) => {
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: `Cycling distance KM between ${origin} and ${destination}. Only JSON: { "distance": number }`,
        config: { temperature: 0, responseMimeType: "application/json", tools: [{ googleMaps: {} }] }
      });
      return JSON.parse(response.text || "{}");
    });
    return data.distance || null;
  } catch (e) {
    lastApiErrorMessage = "Distance calculation offline.";
    lastApiErrorType = 'maps';
    return null;
  }
};
