
import { GoogleGenAI, Type } from "@google/genai";
import { CommuteSettings, WeatherCondition, Language, Coordinates, ScoreDeduction, Equipment } from "../types";
import { BELGIAN_CITIES } from "../constants";
import { BelgianLocation, BELGIAN_LOCATIONS } from "../locations";

export let lastApiErrorMessage: string | null = null;
export let lastApiErrorType: 'telemetry' | 'gemini' | 'maps' | null = null;
export let isAIFallingBack = false;

// New globals to track active LLM model information
export let currentLLMModel: string | null = null;
export let currentLLMModelPriorityLabel: string | null = null;
export let remainingLLMAlternativesCount: number | null = null;


const MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash"
];

export const fetchRawWeatherData = async (coords: Coordinates): Promise<any> => {
  // Request 14 days of forecast + 1 past day for trend analysis
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m&daily=sunrise,sunset&timezone=auto&past_days=1&forecast_days=14`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather telemetry failed");
  return res.json();
};

export const sliceWeatherData = (hourly: any, window: [string, string], offset: number): any => {
  const startHour = parseInt(window[0].split(':')[0]);
  const endHour = parseInt(window[1].split(':')[0]);
  
  // CRITICAL FIX: The API returns 1 past day (24 hours).
  // Index 0 to 23 = Yesterday
  // Index 24 to 47 = Today (Offset 0)
  // Index 48 to 71 = Tomorrow (Offset 1)
  const dayStartIdx = (offset + 1) * 24; 
  
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

const calculateOptimalPressure = (equipment: Equipment, w: WeatherCondition): string => {
  const { riderWeight, tireWidth, type } = equipment;
  // Simplified calculation based on weight, width and type
  // Output in Bar
  let pressure = 0;

  if (type === 'Road Bike' || type === 'Speedpedelec') {
    // Heuristic: Base 2.0 + (Weight * 0.05) - (Width - 25) * 0.1
    pressure = 2.0 + (riderWeight * 0.05) - ((tireWidth - 25) * 0.1);
    // Clamp reasonable bounds for road
    pressure = Math.max(3.5, Math.min(8.5, pressure));
  } else if (type === 'Gravel Bike') {
    // Heuristic: Base 1.0 + (Weight * 0.03) - (Width - 35) * 0.05
    pressure = 1.0 + (riderWeight * 0.03) - ((tireWidth - 35) * 0.05);
    // Clamp reasonable bounds for gravel
    pressure = Math.max(1.8, Math.min(4.5, pressure));
  } else {
    // Mountainbike
    // Heuristic: Base 0.5 + (Weight * 0.02)
    pressure = 0.5 + (riderWeight * 0.02);
    // Clamp reasonable bounds for MTB
    pressure = Math.max(1.4, Math.min(3.0, pressure));
  }

  // Weather adjustments
  if (w.iceRisk) {
    pressure -= 0.5; // Significant drop for contact patch
  } else if ((w.precipitation > 0) || (w.wetSurfaceChance > 50)) {
    pressure -= 0.3; // Drop for traction
  }

  return `${pressure.toFixed(1)} Bar`;
};

export const getStandardizedAdvice = (w: WeatherCondition, equipment?: Equipment): { summary: string; style: string; setup: string; clothing: string; performance: string } => {
  let summary = "Standard atmospheric conditions. Maintain normal safety protocols.";
  let style = "Ride predictably and maintain visibility.";
  let setup = "Standard tire pressure and check lights.";
  let clothing = "Short bibs and short sleeves. Standard kit.";
  let performance = "Optimal physiological conditions for threshold training and endurance improvement.";

  // Clothing Logic based on Temperature
  if (w.temp < 5) {
    clothing = "Thermal long bibs, winter jacket, heavy gloves, and neoprene overshoes required.";
  } else if (w.temp < 10) {
    clothing = "Long bibs (or leg warmers), long sleeve jersey, base layer, and full-finger gloves.";
  } else if (w.temp < 15) {
    clothing = "Short bibs with knee warmers, arm warmers, and a wind gilet. Light gloves recommended.";
  } else if (w.temp < 20) {
    clothing = "Short bibs, short sleeves. Carry a gilet or arm warmers for descent/stops.";
  }

  if (w.iceRisk) {
    summary = "High ice risk detected. Treacherous surfaces expected.";
    style = "Avoid leaning into turns. Brake only when upright and very gently.";
    setup = "Lowest safe tire pressure for maximum contact patch. Consider studded tires.";
    clothing = "Full thermal layers. Focus on core warmth. Overshoes essential.";
    performance = "Low potential for performance metrics. Focus on muscular maintenance.";
  } else if (w.precipitation > 2) {
    summary = "Heavy rain active. Expect low visibility and low traction.";
    style = "Increase braking distance. Avoid painted lines and metal covers.";
    setup = "Check brake pad wear. Use high-vis lights.";
    clothing = `${clothing} Add hardshell rain jacket and waterproof overshoes.`;
    performance = "Good for building mental resilience. Hydration needs remain high.";
  } else if (w.windSpeed > 40) {
    summary = "Dangerous wind speeds. High risk of lateral instability.";
    style = "Firm grip, loose elbows. Anticipate gusts between buildings.";
    setup = "Avoid deep-section rims. Remove large panniers.";
    clothing = "Tight-fitting gear to prevent flapping. Gilet highly recommended.";
    performance = "Extreme aerobic demand. Monitor heart rate recovery carefully.";
  } else if (w.temp < 0) {
    summary = "Freezing temperatures. Frost risk present.";
    style = "Stay alert for micro-patches of frost in shaded areas.";
    setup = "Ensure chain is well-lubricated against road salt.";
    performance = "Cold-air inhalation risk. Caloric burn rate will increase.";
  } else if (w.temp > 30) {
    performance = "Heat stress risk. Focus on hydration and shorter, high-quality efforts.";
    clothing = "Ultra-lightweight kit. Unzip jersey for airflow. No base layer.";
  }

  if (equipment) {
    const pressure = calculateOptimalPressure(equipment, w);
    setup = `Set ${equipment.name} tires to ${pressure}. ${setup}`;
  }

  return { summary, style, setup, clothing, performance };
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
  lastApiErrorMessage = null;
  
  if (!apiKey || apiKey.length < 5) {
    isAIFallingBack = true;
    currentLLMModel = null;
    currentLLMModelPriorityLabel = "N/A (API Key Missing)";
    remainingLLMAlternativesCount = MODEL_CHAIN.length;
    lastApiErrorMessage = "API Key is missing or invalid.";
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = specificModel ? [specificModel] : MODEL_CHAIN;

  for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
    const modelName = modelsToTry[modelIndex];
    for (let i = 0; i <= maxRetriesPerModel; i++) {
      try {
        const result = await fn(ai, modelName);
        isAIFallingBack = false;
        currentLLMModel = modelName;
        currentLLMModelPriorityLabel = modelIndex === 0 ? "Primary" : `Fallback ${modelIndex}`;
        remainingLLMAlternativesCount = modelsToTry.length - (modelIndex + 1);
        lastApiErrorMessage = null;
        return { data: result, model: modelName };
      } catch (error: any) {
        lastFnError = error;
        const status = error?.status || error?.statusCode;
        console.warn(`Attempt failed for ${modelName} (retry ${i}):`, error);
        
        if (((status >= 500 && status <= 599) || status === 429) && i < maxRetriesPerModel) {
          // Retry for server errors or rate limits
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }
        // If not a retryable error or max retries reached for this model, try next model
        break; 
      }
    }
  }
  // If all models in the chain failed
  isAIFallingBack = true;
  currentLLMModel = modelsToTry[modelsToTry.length - 1]; // Last attempted
  currentLLMModelPriorityLabel = `All failed (initial: ${modelsToTry[0]})`;
  remainingLLMAlternativesCount = 0;
  lastApiErrorMessage = lastFnError?.message || "Unknown API Error";
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

export const getScoreBreakdown = (w: Partial<WeatherCondition>, isTraining: boolean = false): ScoreDeduction[] => {
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
  
  if (!isTraining) {
    if ((w.headwindImpact || 0) > 20) {
      const headwindDeduction = (w.headwindImpact || 0) / 4;
      items.push({ label: "Headwind Drag", val: -Math.round(headwindDeduction) });
    } else if ((w.headwindImpact || 0) < -20) {
      items.push({ label: "Tailwind Boost", val: 5 });
    }
  }
  
  const temp = w.temp || 0;

  if (isTraining) {
    if (temp < 10) {
      const coldDeduction = (10 - temp) * 2;
      items.push({ label: "Cold Exposure", val: -Math.round(coldDeduction) });
    } else if (temp > 15) {
      if (temp > 28) {
         const heatDeduction = (temp - 28) * 2;
         items.push({ label: "Heat Stress", val: -Math.round(heatDeduction) });
      } else {
         const surplus = (temp - 15);
         items.push({ label: "Weather Surplus", val: Math.round(surplus) });
      }
    }
  } else {
    if (temp < 5) {
      const coldDeduction = (5 - temp) * 2;
      items.push({ label: "Cold Exposure", val: -Math.round(coldDeduction) });
    } else if (temp > 28) {
      const heatDeduction = (temp - 28) * 2;
      items.push({ label: "Heat Stress", val: -Math.round(heatDeduction) });
    }
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
  sessionStartAbsoluteIdx?: number,
  isTraining: boolean = false
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

  let lastPrecipTime = "None";
  if (fullRawHourlyPrecip && sessionStartAbsoluteIdx !== undefined) {
    for (let i = 1; i <= 12; i++) {
      const idx = sessionStartAbsoluteIdx - i;
      if (idx >= 0 && fullRawHourlyPrecip[idx] > 0) {
        const hour = idx % 24;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        lastPrecipTime = `${h12}${ampm}`;
        break;
      }
    }
  }

  // Refined Ice Risk Logic
  const activeFreezing = minTemp <= 0.5; // Keeping buffer for sensor accuracy
  // If ground was freezing recently (overnight), it will stay frozen if air is <= 3.5C
  const nearFreezing = minTemp <= 3.5; 
  const overnightFreeze = minPastTemp <= 0;
  
  // Adjusted Humidity Threshold:
  // If the ground has been frozen (overnightFreeze), moisture condenses/freezes at lower humidity levels (frost).
  // Standard threshold is 75%, but we lower it to 60% if thermal inertia is in play.
  const humidityThreshold = overnightFreeze ? 60 : 75;

  const hasMoisture = totalPrecip > 0 || avgHum > humidityThreshold || lastPrecipTime !== "None";
  
  // Ice risk exists if:
  // 1. It is currently freezing and moisture is present.
  // 2. It was freezing recently (thermal inertia) AND it's still cold enough AND moisture is present.
  const iceRisk = hasMoisture && (activeFreezing || (overnightFreeze && nearFreezing));

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
    wetSurfaceChance: (totalPrecip > 0 || lastPrecipTime !== "None") ? 90 : 10,
    headwindImpact,
    iceRisk, 
    activeFreezing,
    overnightFreeze,
    minPastTemp: parseFloat(minPastTemp.toFixed(1)), 
    lastPrecipitationTime: lastPrecipTime,
    precipDuringSession: parseFloat(totalPrecip.toFixed(1)),
    sunrise: sunTimes?.sunrise,
    sunset: sunTimes?.sunset
  };

  const breakdown = getScoreBreakdown(baseWeather, isTraining);
  baseWeather.scoreBreakdown = breakdown;
  const totalDeductions = breakdown.reduce((acc: number, curr: ScoreDeduction) => acc + curr.val, 0);
  baseWeather.score = Math.max(0, Math.min(100, 100 + totalDeductions));

  const selectedEquipment = settings.equipment?.find(e => e.isSelected);
  const basicAdvice = getStandardizedAdvice(baseWeather as WeatherCondition, selectedEquipment);
  baseWeather.surfaceReason = basicAdvice.summary;
  baseWeather.ridingStyleAdvice = basicAdvice.style;
  baseWeather.bikeSetupAdvice = basicAdvice.setup;
  baseWeather.clothingAdvice = basicAdvice.clothing;
  baseWeather.performanceAdvice = basicAdvice.performance;
  if (selectedEquipment) {
    baseWeather.optimalPressure = calculateOptimalPressure(selectedEquipment, baseWeather);
  }
  
  return baseWeather as WeatherCondition;
};

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
    if (offset >= (homeRaw.daily?.sunrise?.length || 0)) return;

    const mSlice = sliceWeatherData(homeRaw.hourly, settings.morningWindow, offset);
    const eSlice = sliceWeatherData(workRaw.hourly, settings.eveningWindow, offset);
    
    const sunTimes = {
      sunrise: homeRaw.daily?.sunrise?.[offset] || "07:00",
      sunset: homeRaw.daily?.sunset?.[offset] || "20:00"
    };

    // FIX: getAbsoluteIdx must also account for the 24h past buffer.
    const getAbsoluteIdx = (window: [string, string], offset: number) => {
      // (offset + 1) to skip yesterday (0-23)
      return (offset + 1) * 24 + parseInt(window[0].split(':')[0]);
    };

    const getMinPastTemp = (raw: any, offset: number, window: [string, string]) => {
      const idx = getAbsoluteIdx(window, offset);
      // Grab 6 hours BEFORE the window start
      const pastTemps = (raw.hourly.temperature_2m || []).slice(Math.max(0, idx - 6), idx);
      return pastTemps.length ? Math.min(...pastTemps) : 10;
    };

    const morning = aggregateRawWeather(mSlice, morningHeading, true, settings, sunTimes, getMinPastTemp(homeRaw, offset, settings.morningWindow), undefined, homeRaw.hourly.precipitation, getAbsoluteIdx(settings.morningWindow, offset), false);
    const evening = aggregateRawWeather(eSlice, eveningHeading, false, settings, sunTimes, getMinPastTemp(workRaw, offset, settings.eveningWindow), undefined, workRaw.hourly.precipitation, getAbsoluteIdx(settings.eveningWindow, offset), false);

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

export const getAIInsights = async (
  settings: CommuteSettings,
  telemetryBatch: Record<number, any>
): Promise<Record<number, { morning: any; evening: any }>> => {
  const dataToProcess = Object.values(telemetryBatch).map(({offset, weather}) => ({
    o: offset, 
    m: { temp: weather.morning.temp, cond: weather.morning.condition, prec: weather.morning.precipitation, ice: weather.morning.iceRisk, wind: weather.morning.windSpeed }, 
    e: { temp: weather.evening.temp, cond: weather.evening.condition, prec: weather.evening.precipitation, ice: weather.evening.iceRisk, wind: weather.evening.windSpeed }
  }));

  const equipmentContext = settings.equipment?.map(e => `${e.name} (${e.type}, ${e.tireWidth}mm)`).join(", ") || "No specific bike profile";

  try {
    const { data: parsedAIResults } = await callWithRetry(async (aiInstance, modelName) => {
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: `Cycling Expert: Provide detailed, highly technical, but EXTREMELY CONCISE (max 10 words per field) tactical advice.
        Lang: ${settings.language}.
        Available Bikes: ${equipmentContext}.
        Context: For 'clothing' field, specifically mention: short vs long bibs/sleeves, gloves, and overshoes necessity.
        Context: For 'setup' field, recommend the best bike from the list (if applicable) and tire pressure adjustments.
        Data: ${JSON.stringify(dataToProcess)}. 
        Return JSON array of objects: { "o": number, "mw": { "s": string, "st": string, "se": string, "c": string, "p": string }, "ew": { "s": string, "st": string, "se": string, "c": string, "p": string } } where s=summary, st=style, se=setup, c=clothing, p=performance.`,
        config: { temperature: 0.8, responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "[]");
    });

    const result: Record<number, { morning: any; evening: any }> = {};
    parsedAIResults.forEach((aiRes: any) => {
      result[aiRes.o] = {
        morning: { summary: aiRes.mw.s, style: aiRes.mw.st, setup: aiRes.mw.se, clothing: aiRes.mw.c, performance: aiRes.mw.p },
        evening: { summary: aiRes.ew.s, style: aiRes.ew.st, setup: aiRes.ew.se, clothing: aiRes.ew.c, performance: aiRes.ew.p }
      };
    });
    return result;
  } catch (error) {
    isAIFallingBack = true;
    console.error("AI Insight generation failed", error);
    throw error;
  }
};

/**
 * Specifically for Training View to avoid repetitive text.
 * Prompt refined for extreme conciseness to avoid scrolling.
 */
export const getTrainingSessionAIAdvice = async (
  settings: CommuteSettings,
  weather: WeatherCondition,
  distance: number
): Promise<{ summary: string; style: string; setup: string; clothing: string; performance: string }> => {
  
  const equipmentContext = settings.equipment?.map(e => `${e.name} (${e.type}, ${e.tireWidth}mm)`).join(", ") || "No specific bike profile";

  try {
    const { data } = await callWithRetry(async (aiInstance, modelName) => {
      const prompt = `Cycling Coach: Provide highly technical, ultra-concise advice for a ${distance}km training session: ${JSON.stringify(weather)}. 
      Lang: ${settings.language}. 
      Available Bikes: ${equipmentContext}.
      Mandatory for 'clothing': Specify short/long bibs, sleeve length, gloves, overshoes.
      Mandatory for 'setup': Recommend best bike from list and tire pressure.
      Each field MUST be max 15 words. Avoid fluff.
      Return JSON: { "summary": "...", "style": "...", "setup": "...", "clothing": "...", "performance": "..." }.`;
      
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { temperature: 0.9, responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    });
    return data;
  } catch (e) {
    console.warn("AI Training Advice failed:", e);
    throw e; // Throw so the UI knows AI failed and doesn't claim "Training Intelligence" with hardcoded data
  }
};

export const resolveAddress = async (query: string): Promise<{ address: string; coords: Coordinates; mapsUri?: string }> => {
  const normalizedQuery = query.trim().toLowerCase();
  
  // 1. LOCAL CHECK: Exact match in BELGIAN_CITIES (Map)
  if (BELGIAN_CITIES[normalizedQuery]) {
      return { address: normalizedQuery, coords: BELGIAN_CITIES[normalizedQuery] };
  }
  
  // 2. LOCAL CHECK: Case-insensitive match in BELGIAN_CITIES keys
  const cityKey = Object.keys(BELGIAN_CITIES).find(k => k.toLowerCase() === normalizedQuery);
  if (cityKey) {
      return { address: cityKey, coords: BELGIAN_CITIES[cityKey] };
  }

  // 3. LOCAL CHECK: Search in BELGIAN_LOCATIONS (Array)
  const locationMatch = BELGIAN_LOCATIONS.find(l => l.name.toLowerCase() === normalizedQuery);
  if (locationMatch) {
      return { address: locationMatch.name, coords: { lat: locationMatch.lat, lng: locationMatch.lng } };
  }

  // 4. API FALLBACK
  try {
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
  } catch (e) {
      console.warn("Address resolution failed:", e);
      // Fallback to Brussels if everything fails to prevent app crash, 
      // but strictly speaking should throw or handle in UI.
      return { address: query, coords: { lat: 50.8503, lng: 4.3517 } };
  }
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

export const getGlobalLocationSuggestions = async (query: string): Promise<BelgianLocation[]> => {
  if (query.length < 3) return [];

  // 1. LOCAL CHECK: Prioritize local DB to save LLM quota
  const normalizedQuery = query.toLowerCase();
  const localMatches = BELGIAN_LOCATIONS.filter(l => l.name.toLowerCase().includes(normalizedQuery)).slice(0, 5);
  
  // If we found good local matches, return them immediately without calling LLM.
  // This drastically limits LLM usage for standard Belgian cities.
  if (localMatches.length > 0) {
      return localMatches;
  }

  try {
    // 2. API FALLBACK: Only if no local matches found
    const { data } = await callWithRetry(async (aiInstance, modelName) => {
      const response = await aiInstance.models.generateContent({
        model: modelName,
        // Prompt asks for a JSON list derived from Google Maps data.
        contents: `Find up to 5 real geographic locations matching "${query}" using Google Maps. Return a raw JSON array (no markdown code blocks) of objects with properties: name (string), lat (number), lng (number).`,
        config: { 
          temperature: 0, 
          tools: [{ googleMaps: {} }] 
        }
      });
      
      const cleanText = response.text?.replace(/```json/g, "").replace(/```/g, "").trim() || "[]";
      return JSON.parse(cleanText);
    });
    return data;
  } catch (e) {
    return [];
  }
};