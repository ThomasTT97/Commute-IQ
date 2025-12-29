
import { GoogleGenAI, Type } from "@google/genai";
import { CommuteSettings, WeatherCondition, Language, Coordinates } from "../types";
import { BELGIAN_CITIES } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const callWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 2, initialDelay = 500): Promise<T> => {
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
    if (Array.isArray(raw[key])) {
      sliced[key] = raw[key].slice(startIndex, endIndex + 1); 
    }
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
    surfaceReason: { 
      type: Type.STRING,
      description: "Sharp, high-value pro cycling tactical tips. 2-3 short bullets or sentences focused on real safety and riding style." 
    }
  },
  required: ["temp", "condition", "windSpeed", "windDirection", "isDark", "slipperyChance", "wetSurfaceChance", "headwindImpact", "iceRisk", "surfaceReason"]
};

export const getPulseBatch = async (settings: CommuteSettings, offsets: number[]): Promise<Record<number, any>> => {
  const home = settings.homeCoords || { lat: 0, lng: 0 };
  const work = settings.workCoords || { lat: 0, lng: 0 };

  const [homeRaw, workRaw] = await Promise.all([
    fetchRawWeatherData(home),
    fetchRawWeatherData(work)
  ]);

  const batchContext = offsets.map(offset => {
    const morningData = sliceWeatherData(homeRaw.hourly, settings.morningWindow, offset);
    const eveningData = sliceWeatherData(workRaw.hourly, settings.eveningWindow, offset);
    
    return {
      offset,
      date: new Date(Date.now() + offset * 86400000).toISOString().split('T')[0],
      morning: morningData,
      evening: eveningData
    };
  });

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Detailed Weather Analysis for Cycle Commutes. 
      Target Offsets: ${offsets.join(', ')}.
      Data Context (Hourly): ${JSON.stringify(batchContext)}
      
      TASK: Analyze the hourly telemetry for each commute. 
      1. Map average temperature and wind conditions.
      2. Detect Precipitation and Ice Risk (CRITICAL).
      3. Calculate a Safety-First "Pulse" Score (0-100).
         - SAFETY IS THE HEAVIEST FACTOR (especially ice/frost).
         - Weighting: Ice/Frost (50%), Surface Wetness (30%), Wind/Effort (15%), Visibility (5%).
         - MANDATORY RULE: If 'iceRisk' is true, the total score MUST NOT exceed 30.
         - Heavy rain (precip > 2mm/hr) should cap the score at 60.
      4. In 'surfaceReason', provide 2-3 extremely sharp, technical riding style tips based on the data.
         - Focus on pro-cycling techniques (modulating brakes, tire pressure, body positioning).
         - Max 30 words total.
      5. Ensure the output strictly follows the schema.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              offset: { type: Type.NUMBER },
              weather: {
                type: Type.OBJECT,
                properties: {
                  morning: weatherConditionSchema,
                  evening: weatherConditionSchema
                },
                required: ["morning", "evening"]
              },
              score: { type: Type.NUMBER }
            },
            required: ["offset", "weather", "score"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty AI response");
    
    const parsed = JSON.parse(text);
    const result: Record<number, any> = {};
    parsed.forEach((item: any) => { 
      result[item.offset] = item; 
    });
    return result;
  });
};

export const resolveAddress = async (query: string, userLoc?: { lat: number, lng: number }): Promise<{ address: string; coords: Coordinates; mapsUri?: string }> => {
  const normalizedQuery = query.trim();
  if (BELGIAN_CITIES[normalizedQuery]) {
    return { address: normalizedQuery, coords: BELGIAN_CITIES[normalizedQuery] };
  }
  
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: `Find the precise coordinates and formatted full address for: "${query}". 
      Respond ONLY with the data in this format: 
      ADDR: [Full Formatted Address] | LAT: [Latitude] | LNG: [Longitude]`,
      config: { 
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: userLoc ? { latitude: userLoc.lat, longitude: userLoc.lng } : undefined
          }
        }
      },
    });

    const text = response.text || "";
    const mapsUri = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.find(c => c.maps)?.maps?.uri;

    const addrMatch = text.match(/ADDR:\s*(.*?)\s*\|/);
    const latMatch = text.match(/LAT:\s*(-?\d+(\.\d+)?)/);
    const lngMatch = text.match(/LNG:\s*(-?\d+(\.\d+)?)/);

    if (!latMatch || !lngMatch) {
       const fallback = await ai.models.generateContent({
         model: "gemini-3-flash-preview",
         contents: `Extract coordinates for: ${query}`,
         config: {
           responseMimeType: "application/json",
           responseSchema: {
             type: Type.OBJECT,
             properties: { address: { type: Type.STRING }, lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } },
             required: ["address", "lat", "lng"]
           }
         }
       });
       const data = JSON.parse(fallback.text || "{}");
       return { address: data.address || query, coords: { lat: data.lat, lng: data.lng }, mapsUri };
    }

    return { 
      address: addrMatch ? addrMatch[1] : query, 
      coords: { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) },
      mapsUri
    };
  });
};

/**
 * Calculates the real road infrastructure distance using Google Maps grounding.
 */
export const getCommuteRoadDistance = async (origin: string, destination: string): Promise<number | null> => {
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `What is the precise cycling route distance in kilometers between ${origin} and ${destination} following road infrastructure? 
      Only return a number in this format: DIST: [number] KM`,
      config: {
        tools: [{ googleMaps: {} }]
      }
    });

    const text = response.text || "";
    const match = text.match(/DIST:\s*(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  });
};
