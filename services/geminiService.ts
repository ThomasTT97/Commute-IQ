import { GoogleGenAI, Type } from "@google/genai";
import { CommuteSettings, WeatherCondition, Language, Coordinates } from "../types";
import { BELGIAN_CITIES } from "../constants";

// Track the last error for UI reporting
export let lastApiErrorMessage: string | null = null;
export let lastApiErrorType: 'telemetry' | 'gemini' | 'maps' | null = null;

/**
 * Optimized Model Chain for Intelligence:
 * Using Gemini 3 series for superior reasoning and speed.
 */
const MODEL_CHAIN = [
  "gemini-3-flash-preview",       
  "gemini-flash-lite-latest"
];

const callWithRetry = async <T>(
  fn: (aiInstance: GoogleGenAI, modelName: string) => Promise<T>, 
  maxRetriesPerModel = 1
): Promise<{ data: T; model: string }> => {
  let lastFnError: any;
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.length < 5) {
    throw new Error("API Key is missing. Check your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  for (const modelName of MODEL_CHAIN) {
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

const calculateSegmentScore = (w: WeatherCondition): number => {
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

const aggregateRawWeather = (
  rawSlice: any, 
  heading: number, 
  isMorning: boolean,
  settings: CommuteSettings,
  sunTimes?: { sunrise: string, sunset: string },
  minPastTemp: number = 99
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
      iceRisk: false, surfaceReason: "Data unavailable"
    };
  }

  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
  const minTemp = Math.min(...temps);
  const totalPrecip = precips.reduce((a, b) => a + b, 0);
  const maxWind = Math.max(...winds);
  const avgDir = dirs.reduce((a, b) => a + b, 0) / dirs.length;
  const avgHum = humidities.reduce((a, b) => a + b, 0) / humidities.length;
  const maxCode = Math.max(...codes);

  const condition = resolveCondition(maxCode, maxWind, totalPrecip);
  const headwindImpact = Math.round(calculateAverageWindImpact(heading, dirs));
  const timeWindow = isMorning ? settings.morningWindow : settings.eveningWindow;
  
  let isDark = false;
  if (sunTimes) {
    const commuteStart = getMinutes(timeWindow[0]);
    const commuteEnd = getMinutes(timeWindow[1]);
    const sunrise = getMinutes(sunTimes.sunrise);
    const sunset = getMinutes(sunTimes.sunset);
    isDark = commuteStart < sunrise || commuteEnd > sunset;
  } else {
    const startHour = parseInt(timeWindow[0].split(':')[0]);
    isDark = startHour < 6 || startHour >= 21; 
  }

  const hasMoisture = totalPrecip > 0 || avgHum > 80;
  const freezingNow = minTemp <= 0;
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
    surfaceReason: undefined
  };
};

const fetchRawWeatherData = async (coords: Coordinates) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&timezone=auto&forecast_days=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather telemetry offline.");
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

export const getPulseBatch = async (settings: CommuteSettings, offsets: number[]): Promise<Record<number, any>> => {
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
    const mScore = calculateSegmentScore(morning);
    const eScore = calculateSegmentScore(evening);
    const dailyScore = Math.min(mScore, eScore);
    const isWet = (morning.precipitation > 0 || morning.wetSurfaceChance > 50) || 
                  (evening.precipitation > 0 || evening.wetSurfaceChance > 50);
    const isIcy = morning.iceRisk || evening.iceRisk;

    return { offset, score: dailyScore, summary: { isWet, isIcy }, morning, evening };
  });

  const result: Record<number, any> = {};

  try {
    const { data: parsedAIResults } = await callWithRetry(async (aiInstance, modelName) => {
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: `You are a Cycling Transit Intelligence Expert.
        For each commute, generate EXACTLY 1 concise sentence of advice about RIDING STYLE adjustments needed for the weather conditions.
        Focus on specific tactics like cornering speed, braking distance, or effort management against wind.
        
        Language: ${settings.language}
        Data: ${JSON.stringify(batchContext.map(({offset, morning, evening}) => ({offset, morning, evening})))}
        Return JSON Array: [{ "offset": number, "weather": { "morning": { "surfaceReason": string }, "evening": { "surfaceReason": string } } }]`,
        config: { temperature: 0.4, responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "[]");
    });

    batchContext.forEach(ctx => {
      const aiRes = parsedAIResults.find((r: any) => r.offset === ctx.offset);
      result[ctx.offset] = {
        ...ctx,
        isSynthesized: false,
        weather: {
          morning: { ...ctx.morning, surfaceReason: aiRes?.weather?.morning?.surfaceReason || "Maintain steady cadence and standard cornering speed." },
          evening: { ...ctx.evening, surfaceReason: aiRes?.weather?.evening?.surfaceReason || "Maintain steady cadence and standard cornering speed." }
        }
      };
    });
  } catch (error: any) {
    batchContext.forEach(ctx => {
      result[ctx.offset] = {
        ...ctx,
        isSynthesized: false, 
        weather: {
          morning: { ...ctx.morning, surfaceReason: "Adjust braking distance and cornering speed to local road conditions." },
          evening: { ...ctx.evening, surfaceReason: "Adjust braking distance and cornering speed to local road conditions." }
        }
      };
    });
  }
  return result;
};

export const resolveAddress = async (query: string): Promise<{ address: string; coords: Coordinates; mapsUri?: string }> => {
  const normalizedQuery = query.trim();
  for (const [name, coords] of Object.entries(BELGIAN_CITIES)) {
    if (name.toLowerCase() === normalizedQuery.toLowerCase()) return { address: name, coords };
  }
  const { data } = await callWithRetry(async (aiInstance, modelName) => {
    const response = await aiInstance.models.generateContent({
      model: modelName, 
      contents: `Full address and coords for: "${query}". Return JSON: { "address": string, "lat": number, "lng": number }`,
      config: { temperature: 0, responseMimeType: "application/json", tools: [{ googleMaps: {} }] },
    });
    return JSON.parse(response.text || "{}");
  });
  return { address: data.address || query, coords: { lat: data.lat, lng: data.lng } };
};

export const getCommuteRoadDistance = async (origin: string, destination: string): Promise<number | null> => {
  const { data } = await callWithRetry(async (aiInstance, modelName) => {
    const response = await aiInstance.models.generateContent({
      model: modelName,
      contents: `Cycling distance KM between ${origin} and ${destination}. Only JSON: { "distance": number }`,
      config: { temperature: 0, responseMimeType: "application/json", tools: [{ googleMaps: {} }] }
    });
    return JSON.parse(response.text || "{}");
  });
  return data.distance || null;
};
