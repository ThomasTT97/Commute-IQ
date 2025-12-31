
import { GoogleGenAI, Type } from "@google/genai";
import { CommuteSettings, WeatherCondition, Language, Coordinates, ScoreDeduction } from "../types";
import { BELGIAN_CITIES } from "../constants";

export let lastApiErrorMessage: string | null = null;
export let lastApiErrorType: 'telemetry' | 'gemini' | 'maps' | null = null;

const MODEL_CHAIN = [
  "gemini-3-flash-preview",       
  "gemini-flash-lite-latest"
];

export const fetchRawWeatherData = async (coords: Coordinates): Promise<any> => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m&daily=sunrise,sunset&timezone=auto&past_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather telemetry failed");
  return res.json();
};

export const sliceWeatherData = (hourly: any, window: [string, string], offset: number): any => {
  const startHour = parseInt(window[0].split(':')[0]);
  const endHour = parseInt(window[1].split(':')[0]);
  const dayStartIdx = offset * 24;
  
  const startIndex = dayStartIdx + startHour;
  const endIndex = dayStartIdx + endHour;
  
  const slice: any = {};
  Object.keys(hourly).forEach(key => {
    if (Array.isArray(hourly[key])) {
      slice[key] = hourly[key].slice(startIndex, endIndex + 1);
    }
  });
  return slice;
};

export const getStandardizedAdvice = (w: WeatherCondition): string => {
  if (w.iceRisk) return "High ice risk detected. Surfaces may be treacherous. Consider public transport or extreme caution.";
  if (w.precipitation > 2) return "Heavy rain active. Expect low visibility and significantly reduced traction.";
  if (w.precipitation > 0) return "Light rain present. Road surfaces are wet and slippery.";
  if (w.windSpeed > 40) return "Dangerous wind speeds. High risk of debris and lateral instability.";
  if (w.headwindImpact > 30) return "Significant headwind detected. Expect increased physical exertion.";
  if (w.temp < 0) return "Freezing temperatures. Ensure adequate thermal protection.";
  return "Standard atmospheric conditions. Maintain normal safety protocols.";
};

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
  const dLon = (c2.lng - c1.lng) * Math.PI / 180;
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

export const getScoreBreakdown = (w: Partial<WeatherCondition>): ScoreDeduction[] => {
  const items: ScoreDeduction[] = [];
  
  if (w.iceRisk) {
    items.push({ label: "Critical Ice Risk", val: -70 });
  }
  
  if ((w.precipitation || 0) > 0) {
    const precipDeduction = 20 + Math.min(20, (w.precipitation || 0) * 4);
    items.push({ label: "Active Precipitation", val: -Math.round(precipDeduction) });
  } else if ((w.wetSurfaceChance || 0) > 50) {
    items.push({ label: "Wet Roads", val: -10 });
  }
  
  if ((w.windSpeed || 0) > 15) {
    const windDeduction = ((w.windSpeed || 0) - 15) * 1.5;
    items.push({ label: "Wind Intensity", val: -Math.round(windDeduction) });
  }
  
  if ((w.headwindImpact || 0) > 20) {
    const headwindDeduction = (w.headwindImpact || 0) / 4;
    items.push({ label: "Headwind Drag", val: -Math.round(headwindDeduction) });
  } else if ((w.headwindImpact || 0) < -20) {
    items.push({ label: "Tailwind Boost", val: 5 });
  }
  
  if ((w.temp || 0) < 5) {
    const coldDeduction = (5 - (w.temp || 0)) * 2;
    items.push({ label: "Cold Exposure", val: -Math.round(coldDeduction) });
  } else if ((w.temp || 0) > 28) {
    const heatDeduction = ((w.temp || 0) - 28) * 2;
    items.push({ label: "Heat Stress", val: -Math.round(heatDeduction) });
  }
  
  if (w.isDark) {
    items.push({ label: "Darkness / Visibility", val: -5 });
  }
  
  return items;
};

export const aggregateRawWeather = (
  rawSlice: any, 
  heading: number, 
  isMorning: boolean,
  settings: CommuteSettings,
  sunTimes?: { sunrise: string, sunset: string },
  minPastTemp: number = 99,
  customWindow?: [string, string],
  fullRawHourlyPrecip?: number[],
  sessionStartAbsoluteIdx?: number
): WeatherCondition => {
  const temps = (rawSlice.temperature_2m || []) as number[];
  const precips = (rawSlice.precipitation || []) as number[];
  const winds = (rawSlice.wind_speed_10m || []) as number[];
  const dirs = (rawSlice.wind_direction_10m || []) as number[];
  const codes = (rawSlice.weather_code || []) as number[];
  const humidities = (rawSlice.relative_humidity_2m || []) as number[];

  const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 15;
  const minTemp = temps.length ? Math.min(...temps) : 15;
  const maxTemp = temps.length ? Math.max(...temps) : 15;
  const totalPrecip = precips.reduce((a, b) => a + b, 0);
  const maxWind = winds.length ? Math.max(...winds) : 10;
  const avgDir = dirs.length ? dirs.reduce((a, b) => a + b, 0) / dirs.length : 0;
  const avgHum = humidities.length ? humidities.reduce((a, b) => a + b, 0) / humidities.length : 50;
  const maxCode = codes.length ? Math.max(...codes) : 0;

  const condition = resolveCondition(maxCode, maxWind, totalPrecip);
  const headwindImpact = Math.round(calculateAverageWindImpact(heading, dirs));
  
  const timeWindow = customWindow || (isMorning ? settings.morningWindow : settings.eveningWindow);
  
  let isDark = false;
  if (sunTimes) {
    const sessionStart = getMinutes(timeWindow[0]);
    const sessionEnd = getMinutes(timeWindow[1]);
    const sunrise = getMinutes(sunTimes.sunrise);
    const sunset = getMinutes(sunTimes.sunset);
    isDark = sessionStart < sunrise || sessionEnd > sunset;
  } else {
    const startHour = parseInt(timeWindow[0].split(':')[0]);
    isDark = startHour < 6 || startHour >= 21; 
  }

  let lastPrecipTime = "none";
  if (fullRawHourlyPrecip && sessionStartAbsoluteIdx !== undefined) {
    for (let i = 1; i <= 12; i++) {
      const idx = sessionStartAbsoluteIdx - i;
      if (idx >= 0 && fullRawHourlyPrecip[idx] > 0) {
        const hour = idx % 24;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        lastPrecipTime = `rain at ${h12}${ampm}`;
        break;
      }
    }
  }

  const hasMoisture = totalPrecip > 0 || avgHum > 80 || lastPrecipTime !== "none";
  const activeFreezing = minTemp <= 0.5;
  const overnightFreeze = minPastTemp <= 0;
  const iceRisk = hasMoisture && (activeFreezing || (overnightFreeze && minTemp <= 4));

  const baseWeather: any = {
    temp: parseFloat(avgTemp.toFixed(1)),
    minTemp: parseFloat(minTemp.toFixed(1)),
    maxTemp: parseFloat(maxTemp.toFixed(1)),
    condition,
    precipitation: parseFloat(totalPrecip.toFixed(1)),
    windSpeed: parseFloat(maxWind.toFixed(1)),
    windDirection: Math.round(avgDir),
    humidity: Math.round(avgHum),
    isDark,
    slipperyChance: totalPrecip > 0 ? 60 : (avgTemp < 3 ? 40 : 10),
    wetSurfaceChance: (totalPrecip > 0 || lastPrecipTime !== "none") ? 90 : 10,
    headwindImpact,
    iceRisk, 
    activeFreezing,
    overnightFreeze,
    minPastTemp: parseFloat(minPastTemp.toFixed(1)), 
    lastPrecipitationTime: lastPrecipTime,
    precipDuringSession: parseFloat(totalPrecip.toFixed(1))
  };

  const breakdown = getScoreBreakdown(baseWeather);
  baseWeather.scoreBreakdown = breakdown;
  const totalDeductions = breakdown.reduce((acc: number, curr: ScoreDeduction) => acc + curr.val, 0);
  baseWeather.score = Math.max(0, Math.min(100, 100 + totalDeductions));
  
  return baseWeather as WeatherCondition;
};

/**
 * Stage 1: Fast Telemetry Fetching
 */
export const getTelemetryBatch = async (
  settings: CommuteSettings, 
  offsets: number[]
): Promise<Record<number, any>> => {
  const home = settings.homeCoords || { lat: 0, lng: 0 };
  const work = settings.workCoords || { lat: 0, lng: 0 };
  const morningHeading = calculateBearing(home, work);
  const eveningHeading = calculateBearing(work, home);

  const [homeRaw, workRaw] = await Promise.all([
    fetchRawWeatherData(home),
    fetchRawWeatherData(work)
  ]);

  const batch: Record<number, any> = {};

  offsets.forEach(offset => {
    const mSlice = sliceWeatherData(homeRaw.hourly, settings.morningWindow, offset);
    const eSlice = sliceWeatherData(workRaw.hourly, settings.eveningWindow, offset);
    
    const sunTimes = {
      sunrise: homeRaw.daily?.sunrise?.[offset] || "07:00",
      sunset: homeRaw.daily?.sunset?.[offset] || "20:00"
    };

    const getAbsoluteIdx = (window: [string, string], offset: number) => offset * 24 + parseInt(window[0].split(':')[0]);

    const getMinPastTemp = (raw: any, offset: number, window: [string, string]) => {
      const idx = getAbsoluteIdx(window, offset);
      const pastTemps = (raw.hourly.temperature_2m || []).slice(Math.max(0, idx - 6), idx);
      return pastTemps.length ? Math.min(...pastTemps) : 10;
    };

    const morning = aggregateRawWeather(
      mSlice, 
      morningHeading, 
      true, 
      settings, 
      sunTimes, 
      getMinPastTemp(homeRaw, offset, settings.morningWindow),
      undefined,
      homeRaw.hourly.precipitation,
      getAbsoluteIdx(settings.morningWindow, offset)
    );
    const evening = aggregateRawWeather(
      eSlice, 
      eveningHeading, 
      false, 
      settings, 
      sunTimes, 
      getMinPastTemp(workRaw, offset, settings.eveningWindow),
      undefined,
      workRaw.hourly.precipitation,
      getAbsoluteIdx(settings.eveningWindow, offset)
    );

    // Apply generic advice immediately so UI isn't empty
    morning.surfaceReason = getStandardizedAdvice(morning);
    evening.surfaceReason = getStandardizedAdvice(evening);
    
    batch[offset] = { 
      offset, 
      score: Math.min(morning.score, evening.score), 
      summary: { 
        isWet: (morning.precipitation > 0 || morning.wetSurfaceChance > 50) || (evening.precipitation > 0 || evening.wetSurfaceChance > 50),
        isIcy: morning.iceRisk || evening.iceRisk
      }, 
      weather: { 
        morning: { ...morning }, 
        evening: { ...evening } 
      },
      lastUpdated: Date.now(),
      isEnhanced: false
    };
  });

  return batch;
};

/**
 * Stage 2: Slower AI Interpretation
 */
export const getAIInsights = async (
  settings: CommuteSettings,
  telemetryBatch: Record<number, any>
): Promise<Record<number, { morning: string; evening: string }>> => {
  const dataToProcess = Object.values(telemetryBatch).map(({offset, weather}) => ({
    offset, 
    morning: weather.morning, 
    evening: weather.evening
  }));

  try {
    const { data: parsedAIResults } = await callWithRetry(async (aiInstance, modelName) => {
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: `You are a Cycling Transit Intelligence Expert. Generate EXACTLY 1 concise sentence of advice about RIDING STYLE adjustments needed. Language: ${settings.language}. Data: ${JSON.stringify(dataToProcess)}. Return JSON Array: [{ "offset": number, "weather": { "morning": { "surfaceReason": string }, "evening": { "surfaceReason": string } } }]`,
        config: { temperature: 0.4, responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "[]");
    });

    const result: Record<number, { morning: string; evening: string }> = {};
    parsedAIResults.forEach((aiRes: any) => {
      result[aiRes.offset] = {
        morning: aiRes.weather.morning.surfaceReason,
        evening: aiRes.weather.evening.surfaceReason
      };
    });
    return result;
  } catch (error) {
    console.error("AI Insight generation failed", error);
    throw error;
  }
};

// Kept for backward compatibility if any components use it directly, 
// but App.tsx should now call getTelemetryBatch and then getAIInsights separately.
export const getPulseBatch = async (
  settings: CommuteSettings, 
  offsets: number[], 
  skipAI: boolean = false
): Promise<Record<number, any>> => {
  const telemetry = await getTelemetryBatch(settings, offsets);
  if (settings.disableAI || skipAI) return telemetry;

  try {
    const insights = await getAIInsights(settings, telemetry);
    Object.keys(insights).forEach(o => {
      const offset = Number(o);
      if (telemetry[offset]) {
        telemetry[offset].weather.morning.surfaceReason = insights[offset].morning;
        telemetry[offset].weather.evening.surfaceReason = insights[offset].evening;
        telemetry[offset].isEnhanced = true;
      }
    });
  } catch (e) {}
  return telemetry;
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
      config: { 
        temperature: 0, 
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
        tools: [{ googleMaps: {} }] 
      }
    });
    return extractJson(response.text);
  }, "gemini-2.5-flash");
  
  return data.distance || null;
};
