
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

const calculateBearing = (start: Coordinates, end: Coordinates): number => {
  const startLat = (start.lat * Math.PI) / 180;
  const startLng = (start.lng * Math.PI) / 180;
  const endLat = (end.lat * Math.PI) / 180;
  const endLng = (end.lng * Math.PI) / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

/**
 * Calculates the average headwind impact for a series of wind measurements relative to a heading.
 * Returns -100 (full tailwind) to 100 (full headwind).
 */
const calculateAverageWindImpact = (heading: number, directions: number[]): number => {
  if (!directions.length) return 0;
  const radHeading = (heading * Math.PI) / 180;
  let totalImpact = 0;
  directions.forEach(dir => {
    const radDir = (dir * Math.PI) / 180;
    totalImpact += Math.cos(radHeading - radDir);
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
    if (Array.isArray(raw[key])) {
      sliced[key] = raw[key].slice(startIndex, endIndex + 1); 
    }
  });
  return sliced;
};

/**
 * Grabs a 12-hour window of history before the commute start time.
 * Essential for detecting overnight freezing and residual ice.
 */
const getHistoricalContext = (raw: any, startTimeStr: string, dateOffset: number) => {
  if (!raw || !raw.time) return {};
  const startHour = parseInt(startTimeStr.split(':')[0]);
  const baseIdx = dateOffset * 24;
  const commuteAbsStart = baseIdx + startHour;
  
  const historyStart = Math.max(0, commuteAbsStart - 12);
  const historyEnd = commuteAbsStart - 1;

  const sliced: any = {};
  Object.keys(raw).forEach(key => { 
    if (Array.isArray(raw[key])) {
      sliced[key] = raw[key].slice(historyStart, historyEnd + 1); 
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
      description: "Sharp, high-value pro cycling tactical tips. 2-3 short bullets focused on real safety and riding style." 
    }
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
    const morningRaw = sliceWeatherData(homeRaw.hourly, settings.morningWindow, offset);
    const eveningRaw = sliceWeatherData(workRaw.hourly, settings.eveningWindow, offset);
    
    // THERMAL HISTORY: Provide the context of what happened overnight
    const morningHistory = getHistoricalContext(homeRaw.hourly, settings.morningWindow[0], offset);
    const eveningHistory = getHistoricalContext(workRaw.hourly, settings.eveningWindow[0], offset);

    const morningImpact = calculateAverageWindImpact(morningHeading, morningRaw.wind_direction_10m || []);
    const eveningImpact = calculateAverageWindImpact(eveningHeading, eveningRaw.wind_direction_10m || []);

    return {
      offset,
      date: new Date(Date.now() + offset * 86400000).toISOString().split('T')[0],
      commuteData: {
        morning: morningRaw,
        evening: eveningRaw,
      },
      preCommuteHistory: {
        morning_12h_history: morningHistory, // Contains temperatures from the night before
        evening_12h_history: eveningHistory
      },
      calculatedMorningImpact: Math.round(morningImpact),
      calculatedEveningImpact: Math.round(eveningImpact),
      headings: { morning: Math.round(morningHeading), evening: Math.round(eveningHeading) }
    };
  });

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Advanced Cycling Decision Support. 
      Target Offsets: ${offsets.join(', ')}.
      Data Context: ${JSON.stringify(batchContext)}
      
      TASK: Analyze both the commute window and the 'preCommuteHistory' to determine safety.
      
      CRITICAL ICE RISK LOGIC (THERMAL MEMORY):
      1. Examine 'preCommuteHistory' for the morning commute.
      2. If temperatures dropped below 0°C at ANY point during the night (midnight-06:00):
         - Set 'iceRisk' to TRUE even if current temperature is 1°C or 2°C.
         - The road surface takes hours to warm up; residual frost and black ice are high risks.
      3. If there was precipitation (>0mm) followed by a freeze, 'iceRisk' is extreme (Black Ice).
      4. Only set 'iceRisk' to FALSE if temperatures have been consistently above 3°C for at least 4 hours.
      
      WIND LOGIC:
      - Use pre-calculated 'calculatedMorningImpact' and 'calculatedEveningImpact' for 'headwindImpact'.
      - (+) is HEADWIND, (-) is TAILWIND.
      
      SAFETY SCORE:
      - MANDATORY: If 'iceRisk' is TRUE, the score MUST NOT exceed 30%.
      - Heavy rain caps score at 60%.
      
      TACTICAL TIPS:
      - In 'surfaceReason', reference the thermal history if relevant (e.g., "Overnight freeze means shaded corners are still icy").
      - Always use 'bar' for tire pressure.
      - Max 30 words.`,
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
      contents: `Find precise coordinates for: "${query}". 
      Respond ONLY: ADDR: [Address] | LAT: [Latitude] | LNG: [Longitude]`,
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

export const getCommuteRoadDistance = async (origin: string, destination: string): Promise<number | null> => {
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Cycling route distance in KM between ${origin} and ${destination}. 
      Only return: DIST: [number] KM`,
      config: {
        tools: [{ googleMaps: {} }]
      }
    });

    const text = response.text || "";
    const match = text.match(/DIST:\s*(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  });
};
