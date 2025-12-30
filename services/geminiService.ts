import { GoogleGenAI, Type } from "@google/genai";
import { CommuteSettings, WeatherCondition, Language, Coordinates } from "../types";
import { BELGIAN_CITIES } from "../constants";

// Track the last error for UI reporting
export let lastApiErrorMessage: string | null = null;
export let lastApiErrorType: 'telemetry' | 'gemini' | 'maps' | null = null;

const MODEL_CHAIN = [
  "gemini-3-flash-preview",       
  "gemini-flash-lite-latest"
];

// Helper to extract JSON from text output that might be wrapped in markdown
const extractJson = (text?: string): any => {
  if (!text) return {};
  const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    return {};
  }
};

const callWithRetry = async <T>(
  fn: (aiInstance: GoogleGenAI, modelName: string) => Promise<T>, 
  specificModel?: string,
  maxRetriesPerModel = 1
): Promise<{ data: T; model: string }> => {
  let lastFnError: any;
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.length < 5) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = specificModel ? [specificModel] : MODEL_CHAIN;

  for (const modelName of modelsToTry) {
    for (let i = 0; i <= maxRetriesPerModel; i++) {
      try {
        const result = await fn(ai, modelName);
        return { data: result, model: modelName };
      } catch (error: any) {
        lastFnError = error;
        const status = error?.status || error?.statusCode;
        if (((status >= 500 && status <= 599) || status === 429) && i < maxRetriesPerModel) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }
        break;
      }
    }
  }
  throw lastFnError;
};

export const calculateDistance = (c1?: Coordinates, c2?: Coordinates): number => {
  if (!c1 || !c2) return 0;
  const R = 6371; 
  const dLat = (c2.lat - c1.lat) * Math.PI / 180;
  const dLon = (c2.lng - c1.lng) * Math.PI / 180; // FIX: Use c2.lng and c1.lng
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

export const calculateBearing = (start: Coordinates, end: Coordinates): number => {
  const startLat = (start.lat * Math.PI) / 180;
  const startLng = (start.lng * Math.PI) / 180;
  const endLat = (end.lat * Math.PI) / 180;
  const endLng = (end.lng * Math.PI) / 180;
  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

export const calculateAverageWindImpact = (heading: number, directions: number[]): number => {
  if (!directions.length) return 0;
  const radHeading = (heading * Math.PI) / 180;
  let totalImpact = 0;
  directions.forEach(dir => {
    totalImpact += Math.cos(radHeading - (dir * Math.PI) / 180);
  });
  return (totalImpact / directions.length) * 100;
};

const getMinutes = (timeStr: string): number => {
  const t = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const resolveCondition = (code: number, windSpeed: number, precip: number): WeatherCondition['condition'] => {
  if (code >= 95) return 'Stormy';
  if (code >= 51 || precip > 0.5) return 'Rainy';
  if (windSpeed > 35) return 'Windy';
  if (code <= 1) return 'Sunny';
  return 'Cloudy';
};

export const calculateSegmentScore = (w: WeatherCondition): number => {
  let score = 100;
  if (w.iceRisk) score -= 70; 
  if (w.precipitation > 0) {
    score -= 20;
    score -= Math.min(20, w.precipitation * 4);
  } else if (w.wetSurfaceChance > 50) {
    score -= 10;
  }
  if (w.windSpeed > 15) score -= (w.windSpeed - 15) * 1.5;
  if (w.headwindImpact > 20) score -= (w.headwindImpact / 4); 
  else if (w.headwindImpact < -20) score += 5;
  if (w.temp < 5) score -= (5 - w.temp) * 2;
  else if (w.temp > 28) score -= (w.temp - 28) * 2;
  if (w.isDark) score -= 5;
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const aggregateRawWeather = (
  rawSlice: any, 
  heading: number, 
  isMorning: boolean,
  settings: CommuteSettings,
  sunTimes?: { sunrise: string, sunset: string },
  minPastTemp: number = 99,
  customWindow?: [string, string]
): WeatherCondition => {
  const temps = (rawSlice.temperature_2m || []) as number[];
  const precips = (rawSlice.precipitation || []) as number[];
  const winds = (rawSlice.wind_speed_10m || []) as number[];
  const dirs = (rawSlice.wind_direction_10m || []) as number[];
  const codes = (rawSlice.weather_code || []) as number[];
  const humidities = (rawSlice.relative_humidity_2m || []) as number[];

  if (temps.length === 0) {
    return {
      temp: 15, condition: 'Cloudy', precipitation: 0, windSpeed: 10, windDirection: 0,
      humidity: 50, isDark: false, slipperyChance: 0, wetSurfaceChance: 0, headwindImpact: 0,
      iceRisk: false, surfaceReason: undefined
    };
  }

  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const totalPrecip = precips.reduce((a, b) => a + b, 0);
  const maxWind = Math.max(...winds);
  const avgDir = dirs.reduce((a, b) => a + b, 0) / dirs.length;
  const avgDirRounded = Math.round(avgDir);
  const avgHum = humidities.reduce((a, b) => a + b, 0) / humidities.length;
  const maxCode = Math.max(...codes);

  const condition = resolveCondition(maxCode, maxWind, totalPrecip);
  const headwindImpact = Math.round(calculateAverageWindImpact(heading, dirs));
  
  // Use custom window if provided (for training), otherwise fallback to commute windows
  const timeWindow = customWindow || (isMorning ? settings.morningWindow : settings.eveningWindow);
  
  let isDark = false;
  if (sunTimes) {
    const sessionStart = getMinutes(timeWindow[0]);
    const sessionEnd = getMinutes(timeWindow[1]);
    const sunrise = getMinutes(sunTimes.sunrise);
    const sunset = getMinutes(sunTimes.sunset);
    // Dark if any part of the window is outside daylight hours
    isDark = sessionStart < sunrise || sessionEnd > sunset;
  } else {
    const startHour = parseInt(timeWindow[0].split(':')[0]);
    isDark = startHour < 6 || startHour >= 21; 
  }

  const hasMoisture = totalPrecip > 0 || avgHum > 80;
  const activeFreezing = minTemp <= 0;
  const overnightFreeze = minPastTemp <= 0;
  const iceRisk = hasMoisture && (activeFreezing || (overnightFreeze && minTemp <= 4));

  return {
    temp: parseFloat(avgTemp.toFixed(1)),
    minTemp: parseFloat(minTemp.toFixed(1)),
    maxTemp: parseFloat(maxTemp.toFixed(1)),
    condition,
    precipitation: parseFloat(totalPrecip.toFixed(1)),
    windSpeed: parseFloat(maxWind.toFixed(1)),
    windDirection: avgDirRounded,
    humidity: Math.round(avgHum),
    isDark,
    slipperyChance: totalPrecip > 0 ? 60 : (avgTemp < 3 ? 40 : 10),
    wetSurfaceChance: totalPrecip > 0 ? 90 : 10,
    headwindImpact,
    iceRisk, 
    activeFreezing,
    overnightFreeze,
    surfaceReason: undefined
  };
};

export const getStandardizedAdvice = (w: WeatherCondition): string => {
  if (w.iceRisk) return "Ice Style: Stay strictly upright in corners and avoid leaning; use 90% rear braking bias to prevent front-wheel slides.";
  if (w.precipitation > 4) return "Survival Style: Brake early to clear water film from pads; avoid painted road lines and metal utility covers which act as ice.";
  if (w.precipitation > 0) return "Cornering Style: Moderate your speed before entering turns; take a wider line with less lean to maximize the tire contact patch.";
  if (w.windSpeed > 35) return "Gust Style: Maintain a relaxed but firm grip to absorb frame movement; stay tucked and watch for cross-gusts behind buildings.";
  if (w.headwindImpact > 35) return "Aero Style: Tuck your elbows in and lower your torso; shift to a lower gear to maintain 85+ RPM and preserve leg muscle.";
  if (w.temp < 2) return "Tactical Style: Test road surface grip in safe straightaways; stay alert for micro-frost in shaded or bridge sections.";
  if (w.temp > 30) return "Efficiency Style: Moderate your power output to prevent overheating; stick to shaded paths where possible and prioritize hydration.";
  if (w.isDark) return "Visibility Style: Ride wider in the lane to be seen; assume total motorist invisibility and watch for road debris hidden by shadows.";
  return "Optimal Style: Maintain a steady, predictable tempo and keep a high visual horizon for smooth integration into traffic flow.";
};

export const fetchRawWeatherData = async (coords: Coordinates) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&timezone=auto&forecast_days=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather telemetry offline.");
  return res.json();
};

export const sliceWeatherData = (raw: any, window: [string, string], dateOffset: number) => {
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

export const getPulseBatch = async (
  settings: CommuteSettings, 
  offsets: number[], 
  skipAI: boolean = false
): Promise<Record<number, any>> => {
  const home = settings.homeCoords || { lat: 0, lng: 0 };
  const work = settings.workCoords || { lat: 0, lng: 0 };
  const morningHeading = calculateBearing(home, work);
  const eveningHeading = calculateBearing(work, home);

  const [homeRaw, workRaw] = await Promise.all([
    fetchRawWeatherData(home),
    fetchRawWeatherData(work)
  ]);

  const batchContext = offsets.map(offset => {
    const mSlice = sliceWeatherData(homeRaw.hourly, settings.morningWindow, offset);
    const eSlice = sliceWeatherData(workRaw.hourly, settings.eveningWindow, offset);
    
    const sunTimes = {
      sunrise: homeRaw.daily?.sunrise?.[offset] || "07:00",
      sunset: homeRaw.daily?.sunset?.[offset] || "20:00"
    };

    const getMinPastTemp = (raw: any, offset: number, window: [string, string]) => {
      const startHour = parseInt(window[0].split(':')[0]);
      const idx = offset * 24 + startHour;
      const pastTemps = (raw.hourly.temperature_2m || []).slice(Math.max(0, idx - 6), idx);
      return pastTemps.length ? Math.min(...pastTemps) : 10;
    };

    const morning = aggregateRawWeather(mSlice, morningHeading, true, settings, sunTimes, getMinPastTemp(homeRaw, offset, settings.morningWindow));
    const evening = aggregateRawWeather(eSlice, eveningHeading, false, settings, sunTimes, getMinPastTemp(workRaw, offset, settings.eveningWindow));
    
    const mScore = calculateSegmentScore(morning);
    const eScore = calculateSegmentScore(evening);
    
    return { 
      offset, 
      score: Math.min(mScore, eScore), 
      summary: { 
        isWet: (morning.precipitation > 0 || morning.wetSurfaceChance > 50) || (evening.precipitation > 0 || evening.wetSurfaceChance > 50),
        isIcy: morning.iceRisk || evening.iceRisk
      }, 
      weather: { 
        morning: { ...morning }, 
        evening: { ...evening } 
      },
      lastUpdated: Date.now()
    };
  });

  const result: Record<number, any> = {};
  batchContext.forEach(ctx => { result[ctx.offset] = ctx; });

  if (settings.disableAI || skipAI) {
    batchContext.forEach(ctx => {
      ctx.weather.morning.surfaceReason = getStandardizedAdvice(ctx.weather.morning);
      ctx.weather.evening.surfaceReason = getStandardizedAdvice(ctx.weather.evening);
    });
    return result;
  }

  try {
    const { data: parsedAIResults } = await callWithRetry(async (aiInstance, modelName) => {
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: `You are a Cycling Transit Intelligence Expert.
        For each commute, generate EXACTLY 1 concise sentence of advice about RIDING STYLE adjustments needed for the weather conditions.
        Focus on specific tactics like cornering speed, braking distance, or effort management against wind.
        
        Language: ${settings.language}
        Data: ${JSON.stringify(batchContext.map(({offset, weather}) => ({offset, morning: weather.morning, evening: weather.evening})))}
        Return JSON Array: [{ "offset": number, "weather": { "morning": { "surfaceReason": string }, "evening": { "surfaceReason": string } } }]`,
        config: { temperature: 0.4, responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "[]");
    });

    parsedAIResults.forEach((aiRes: any) => {
      if (result[aiRes.offset]) {
        result[aiRes.offset].weather.morning.surfaceReason = aiRes.weather.morning.surfaceReason;
        result[aiRes.offset].weather.evening.surfaceReason = aiRes.weather.evening.surfaceReason;
        result[aiRes.offset].isEnhanced = true;
      }
    });
  } catch (error) {
    batchContext.forEach(ctx => {
      if (!ctx.weather.morning.surfaceReason) {
        ctx.weather.morning.surfaceReason = getStandardizedAdvice(ctx.weather.morning);
        ctx.weather.evening.surfaceReason = getStandardizedAdvice(ctx.weather.evening);
      }
    });
  }

  return result;
};

export const resolveAddress = async (query: string): Promise<{ address: string; coords: Coordinates; mapsUri?: string }> => {
  const normalizedQuery = query.trim();
  // Instruction to skip local city lookup review and use AI directly for resolving non-trivial queries
  for (const [name, coords] of Object.entries(BELGIAN_CITIES)) {
    if (name.toLowerCase() === normalizedQuery.toLowerCase()) return { address: name, coords };
  }
  
  const { data } = await callWithRetry(async (aiInstance, modelName) => {
    const response = await aiInstance.models.generateContent({
      model: modelName, 
      contents: `Full address and coords for: "${query}". Return JSON: { "address": string, "lat": number, "lng": number }`,
      config: { 
        temperature: 0, 
        // responseMimeType is NOT permitted when googleMaps tool is active.
        tools: [{ googleMaps: {} }] 
      },
    });
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const mapsUri = groundingChunks.find((chunk: any) => chunk.maps?.uri)?.maps?.uri;
    const parsed = extractJson(response.text);
    return { ...parsed, mapsUri };
  }, "gemini-2.5-flash");
  
  return { 
    address: data.address || query, 
    coords: { lat: data.lat, lng: data.lng },
    mapsUri: data.mapsUri
  };
};

export const getCommuteRoadDistance = async (origin: string, destination: string): Promise<number | null> => {
  const { data } = await callWithRetry(async (aiInstance, modelName) => {
    const response = await aiInstance.models.generateContent({
      model: modelName,
      contents: `Cycling distance KM between ${origin} and ${destination}. Only JSON: { "distance": number }`,
      config: { 
        temperature: 0, 
        // responseMimeType is NOT permitted when googleMaps tool is active.
        tools: [{ googleMaps: {} }] 
      }
    });
    return extractJson(response.text);
  }, "gemini-2.5-flash");
  
  return data.distance || null;
};