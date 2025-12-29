
import { GoogleGenAI, Type } from "@google/genai";
import { CommuteSettings, WeatherCondition, Language, Coordinates } from "../types";
import { BELGIAN_CITIES } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const callWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 2, initialDelay = 400): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.statusCode;
      if (status === 429 || (status >= 500 && status <= 599)) {
        await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
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

const fetchRawWeatherData = async (coords: Coordinates) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto&forecast_days=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather source unreachable");
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

const getHistoricalContext = (raw: any, startTimeStr: string, dateOffset: number) => {
  if (!raw || !raw.time) return {};
  const startHour = parseInt(startTimeStr.split(':')[0]);
  const commuteAbsStart = (dateOffset * 24) + startHour;
  const historyStart = Math.max(0, commuteAbsStart - 12);
  const historyEnd = commuteAbsStart - 1;
  const sliced: any = {};
  Object.keys(raw).forEach(key => { 
    if (Array.isArray(raw[key])) { sliced[key] = raw[key].slice(historyStart, historyEnd + 1); }
  });
  return sliced;
};

const weatherConditionSchema = {
  type: Type.OBJECT,
  properties: {
    temp: { type: Type.NUMBER },
    condition: { type: Type.STRING },
    windSpeed: { type: Type.NUMBER },
    windDirection: { type: Type.NUMBER },
    humidity: { type: Type.NUMBER },
    precipitation: { type: Type.NUMBER },
    isDark: { type: Type.BOOLEAN },
    slipperyChance: { type: Type.NUMBER },
    wetSurfaceChance: { type: Type.NUMBER },
    headwindImpact: { type: Type.NUMBER },
    iceRisk: { type: Type.BOOLEAN },
    surfaceReason: { type: Type.STRING }
  },
  required: ["temp", "condition", "windSpeed", "windDirection", "isDark", "slipperyChance", "wetSurfaceChance", "headwindImpact", "iceRisk", "surfaceReason"]
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
    const mRaw = sliceWeatherData(homeRaw.hourly, settings.morningWindow, offset);
    const eRaw = sliceWeatherData(workRaw.hourly, settings.eveningWindow, offset);
    return {
      offset,
      m: mRaw,
      e: eRaw,
      mHist: getHistoricalContext(homeRaw.hourly, settings.morningWindow[0], offset),
      eHist: getHistoricalContext(workRaw.hourly, settings.eveningWindow[0], offset),
      mImp: Math.round(calculateAverageWindImpact(morningHeading, mRaw.wind_direction_10m || [])),
      eImp: Math.round(calculateAverageWindImpact(eveningHeading, eRaw.wind_direction_10m || []))
    };
  });

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Cycle analysis for offsets: ${offsets.join(',')}. Context: ${JSON.stringify(batchContext)}. Language: ${settings.language}.
      
      SURFACE MOISTURE LOGIC (LENIENT):
      - 'isWet' is TRUE ONLY if the surface is predominately wet. 
      - If there is only minor residual rain or isolated wet spots but the road is mostly dry/safe, flag it as DRY.
      - 'wetSurfaceChance' > 50% = WET. 
      - 30-50% = DRY with a note about "some damp spots".
      - Below 30% = DRY.
      
      Residual rain in history only flags 'Wet' if it was heavy (>1mm) and recent/high-humidity. Small puddles do not trigger 'Wet' status.
      Reasoning max 20 words.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              offset: { type: Type.NUMBER },
              summary: {
                type: Type.OBJECT,
                properties: { isWet: { type: Type.BOOLEAN }, isIcy: { type: Type.BOOLEAN } },
                required: ["isWet", "isIcy"]
              },
              weather: {
                type: Type.OBJECT,
                properties: { morning: weatherConditionSchema, evening: weatherConditionSchema },
                required: ["morning", "evening"]
              },
              score: { type: Type.NUMBER }
            },
            required: ["offset", "summary", "weather", "score"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    const result: Record<number, any> = {};
    parsed.forEach((item: any) => { result[item.offset] = item; });
    return result;
  });
};

export const resolveAddress = async (query: string, userLoc?: { lat: number, lng: number }): Promise<{ address: string; coords: Coordinates; mapsUri?: string }> => {
  const normalizedQuery = query.trim();
  if (BELGIAN_CITIES[normalizedQuery]) return { address: normalizedQuery, coords: BELGIAN_CITIES[normalizedQuery] };
  
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: `Extract coordinates for: "${query}". Respond JSON: { "address": string, "lat": number, "lng": number }`,
      config: { 
        responseMimeType: "application/json",
        tools: [{ googleMaps: {} }],
        toolConfig: { retrievalConfig: { latLng: userLoc ? { latitude: userLoc.lat, longitude: userLoc.lng } : undefined } }
      },
    });
    const data = JSON.parse(response.text || "{}");
    const mapsUri = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.find(c => c.maps)?.maps?.uri;
    return { address: data.address || query, coords: { lat: data.lat, lng: data.lng }, mapsUri };
  });
};

export const getCommuteRoadDistance = async (origin: string, destination: string): Promise<number | null> => {
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Cycling route distance in KM between ${origin} and ${destination}. Only return JSON: { "distance": number }`,
      config: { responseMimeType: "application/json", tools: [{ googleMaps: {} }] }
    });
    return JSON.parse(response.text || "{}").distance || null;
  });
};
