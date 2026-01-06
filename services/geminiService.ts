
import { GoogleGenAI, Type } from "@google/genai";
import { CommuteSettings, WeatherCondition, Language, Coordinates, ScoreDeduction, Equipment } from "../types";
import { BELGIAN_CITIES } from "../constants";
import { BelgianLocation, BELGIAN_LOCATIONS } from "../locations";

export let lastApiErrorMessage: string | null = null;
export let lastApiErrorType: 'telemetry' | 'gemini' | 'maps' | null = null;
export let isAIFallingBack = false;

// New globals to track active LLM model information for UI feedback
export let currentLLMModel: string | null = null;
export let currentLLMModelPriorityLabel: string | null = null;
export let remainingLLMAlternativesCount: number | null = null;
export let isUsingFallbackModel = false; // Tracks if we have deviated from the primary model

// Robust Model Chain: 
// 1. Gemini 3.0 Flash Preview: Latest reasoning engine.
// 2. Gemini 2.5 Flash: Stable, high-performance workhorse.
// 3. Gemini Flash Latest: Reliable alias fallback.
// 4. Gemini Flash Lite: Cost-efficient, high-throughput fallback.
export const MODEL_CHAIN = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",          
  "gemini-flash-latest",                
  "gemini-flash-lite-latest" 
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
  
  // API returns 1 past day (24 hours).
  // Index 0-23 = Yesterday, 24-47 = Today (Offset 0), 48-71 = Tomorrow (Offset 1)
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
  let pressure = 0;

  if (type === 'Road Bike' || type === 'Speedpedelec') {
    pressure = 2.0 + (riderWeight * 0.05) - ((tireWidth - 25) * 0.1);
    pressure = Math.max(3.5, Math.min(8.5, pressure));
  } else if (type === 'Gravel Bike') {
    pressure = 1.0 + (riderWeight * 0.03) - ((tireWidth - 35) * 0.05);
    pressure = Math.max(1.8, Math.min(4.5, pressure));
  } else {
    pressure = 0.5 + (riderWeight * 0.02);
    pressure = Math.max(1.4, Math.min(3.0, pressure));
  }

  if (w.iceRisk) {
    pressure -= 0.5;
  } else if ((w.precipitation > 0) || (w.wetSurfaceChance > 50)) {
    pressure -= 0.3;
  }

  return `${pressure.toFixed(1)} Bar`;
};

export const getStandardizedAdvice = (w: WeatherCondition, equipment?: Equipment): { summary: string; style: string; setup: string; clothing: string; performance: string } => {
  let summary = "Standard atmospheric conditions. Maintain normal safety protocols.";
  let style = "Ride predictably and maintain visibility.";
  let setup = "Standard tire pressure and check lights.";
  let clothing = "Short bibs and short sleeves. Standard kit.";
  let performance = "Optimal physiological conditions for threshold training and endurance improvement.";

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
  // 1. Remove markdown code blocks
  let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
  
  // 2. Locate first { and last } to isolate JSON object if there's extra text
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  } else {
     // Try array if object failed
     const firstBracket = cleanText.indexOf('[');
     const lastBracket = cleanText.lastIndexOf(']');
     if (firstBracket >= 0 && lastBracket > firstBracket) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
     }
  }

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    return {};
  }
};

const cleanErrorMessage = (error: any): string => {
  try {
    let msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    
    // Parse nested JSON errors
    if (typeof msg === 'string' && (msg.startsWith('{') || msg.startsWith('['))) {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error?.message) msg = parsed.error.message;
        else if (parsed.message) msg = parsed.message;
      } catch { /* ignore */ }
    }

    // Clean common SDK prefixes
    msg = msg
      .replace(/^Error: /, '')
      .replace(/^\[GoogleGenAI Error\]: /, '')
      .replace(/GoogleGenerativeAI/gi, 'AI Service');

    // Detect common status codes and map to user-friendly strings
    if (msg.includes('429') || msg.includes('Quota exceeded')) return "Service Busy (Quota Exceeded)";
    if (msg.includes('503') || msg.includes('Overloaded')) return "Service Overloaded";
    if (msg.includes('400') || msg.includes('API key')) return "Invalid Configuration/Key";
    if (msg.includes('fetch failed')) return "Network Connection Lost";

    // Truncate
    if (msg.length > 60) return msg.substring(0, 57) + "...";
    return msg;
  } catch (e) {
    return "Connection disrupted";
  }
};

const callWithRetry = async <T>(
  fn: (aiInstance: GoogleGenAI, modelName: string) => Promise<T>, 
  specificModel?: string,
  maxRetriesPerModel = 1
): Promise<{ data: T; model: string }> => {
  const apiKey = process.env.API_KEY;
  lastApiErrorMessage = null;
  
  if (!apiKey || apiKey.length < 5) {
    isAIFallingBack = true;
    currentLLMModel = null;
    currentLLMModelPriorityLabel = "N/A (API Key Missing)";
    remainingLLMAlternativesCount = MODEL_CHAIN.length;
    lastApiErrorMessage = "API Key is missing.";
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = specificModel ? [specificModel] : MODEL_CHAIN;
  const collectedErrors: string[] = [];

  for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
    const modelName = modelsToTry[modelIndex];
    for (let i = 0; i <= maxRetriesPerModel; i++) {
      try {
        const result = await fn(ai, modelName);
        
        // Success Logic
        isAIFallingBack = false;
        currentLLMModel = modelName;
        isUsingFallbackModel = modelIndex > 0;
        currentLLMModelPriorityLabel = modelIndex === 0 ? "Primary" : `Fallback Tier ${modelIndex}`;
        remainingLLMAlternativesCount = modelsToTry.length - (modelIndex + 1);
        lastApiErrorMessage = null;
        
        return { data: result, model: modelName };
      } catch (error: any) {
        const status = error?.status || error?.statusCode;
        const cleanMsg = cleanErrorMessage(error);
        
        collectedErrors.push(cleanMsg);
        console.warn(`LLM Attempt failed for ${modelName} (retry ${i}):`, cleanMsg);
        
        // Fail fast on 400/404
        if (status === 400 || status === 404) break;

        // Exponential backoff
        if (((status >= 500 && status <= 599) || status === 429) && i < maxRetriesPerModel) {
          const delay = 1000 * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        break; 
      }
    }
  }
  
  // Total Failure Logic
  isAIFallingBack = true;
  isUsingFallbackModel = false;
  currentLLMModel = null;
  currentLLMModelPriorityLabel = `All failed`;
  remainingLLMAlternativesCount = 0;
  lastApiErrorMessage = collectedErrors.length > 0 ? collectedErrors[collectedErrors.length - 1] : "Service unavailable";
  throw new Error(`AI Service Unavailable: ${lastApiErrorMessage}`);
};

export const checkLLMConnectivity = async (): Promise<boolean> => {
  try {
    await callWithRetry(async (aiInstance, modelName) => {
       await aiInstance.models.generateContent({
        model: modelName,
        contents: "Hello",
        config: { maxOutputTokens: 5 }
      });
      return true;
    }, undefined, 0); 
    return true;
  } catch (e) {
    return false;
  }
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
  isTraining: boolean = false,
  fullRawHourlyHumidity?: number[],
  fullRawHourlyTemp?: number[]
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

  // Dry Time Estimation Logic Restored
  let estimatedDryTime: number | undefined;
  if ((totalPrecip > 0 || lastPrecipTime !== "None") && fullRawHourlyPrecip && sessionStartAbsoluteIdx !== undefined) {
    let stopIdx = -1;
    // Find when it stops raining (Scan up to 48 hours forward from the session start or current precip point)
    for (let i = 0; i < 48; i++) {
      const idx = sessionStartAbsoluteIdx + i;
      if (idx >= fullRawHourlyPrecip.length) break;
      
      // Look for a window of no rain
      const rainAhead = fullRawHourlyPrecip.slice(idx, idx + 3);
      if (rainAhead.length >= 1 && rainAhead.every(v => v === 0)) {
        stopIdx = idx;
        break;
      }
    }

    if (stopIdx !== -1) {
      // Base evaporation buffer
      let evaporationHours = 2;
      const humAtStop = (fullRawHourlyHumidity?.[stopIdx] ?? avgHum);
      const tempAtStop = (fullRawHourlyTemp?.[stopIdx] ?? avgTemp);
      
      if (humAtStop > 85) evaporationHours += 6;
      else if (humAtStop > 70) evaporationHours += 3;
      if (tempAtStop < 5) evaporationHours += 4;
      else if (tempAtStop < 12) evaporationHours += 2;

      // Absolute timestamp calculation
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      estimatedDryTime = startDate.getTime() + (stopIdx + evaporationHours) * 60 * 60 * 1000;
    }
  }

  const sessionStartAbsoluteMs = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0,0,0,0);
    return d.getTime() + (sessionStartAbsoluteIdx || 0) * 60 * 60 * 1000;
  })();

  const isCurrentlyInDryingPhase = estimatedDryTime ? estimatedDryTime > sessionStartAbsoluteMs : false;
  const isWet = totalPrecip > 0 || isCurrentlyInDryingPhase;

  const activeFreezing = minTemp <= 0.5; 
  const nearFreezing = minTemp <= 3.5; 
  const overnightFreeze = minPastTemp <= 0;
  const humidityThreshold = overnightFreeze ? 60 : 75;
  const hasMoisture = isWet || avgHum > humidityThreshold;
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
    slipperyChance: isWet ? 60 : (avgTemp < 3 ? 40 : 10),
    wetSurfaceChance: isWet ? 90 : 10,
    headwindImpact,
    iceRisk, 
    activeFreezing,
    overnightFreeze,
    minPastTemp: parseFloat(minPastTemp.toFixed(1)), 
    lastPrecipitationTime: lastPrecipTime,
    estimatedDryTime,
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

    const getAbsoluteIdx = (window: [string, string], offset: number) => {
      return (offset + 1) * 24 + parseInt(window[0].split(':')[0]);
    };

    const getMinPastTemp = (raw: any, offset: number, window: [string, string]) => {
      const idx = getAbsoluteIdx(window, offset);
      const pastTemps = (raw.hourly.temperature_2m || []).slice(Math.max(0, idx - 6), idx);
      return pastTemps.length ? Math.min(...pastTemps) : 10;
    };

    const morning = aggregateRawWeather(mSlice, morningHeading, true, settings, sunTimes, getMinPastTemp(homeRaw, offset, settings.morningWindow), undefined, homeRaw.hourly.precipitation, getAbsoluteIdx(settings.morningWindow, offset), false, homeRaw.hourly.relative_humidity_2m, homeRaw.hourly.temperature_2m);
    const evening = aggregateRawWeather(eSlice, eveningHeading, false, settings, sunTimes, getMinPastTemp(workRaw, offset, settings.eveningWindow), undefined, workRaw.hourly.precipitation, getAbsoluteIdx(settings.eveningWindow, offset), false, workRaw.hourly.relative_humidity_2m, workRaw.hourly.temperature_2m);

    batch[offset] = { 
      offset, 
      score: Math.min(morning.score, evening.score), 
      summary: { 
        isWet: (morning.wetSurfaceChance > 50) || (evening.wetSurfaceChance > 50),
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

  // Commute Styles to add variance
  const COMMUTE_FOCUS_THEMES = [
    "Safety & Handling",
    "Comfort & Warmth",
    "Speed & Efficiency",
    "Visibility & Awareness",
    "Technical Road Surface Analysis"
  ];
  const theme = COMMUTE_FOCUS_THEMES[Math.floor(Math.random() * COMMUTE_FOCUS_THEMES.length)];

  try {
    const { data: parsedAIResults } = await callWithRetry(async (aiInstance, modelName) => {
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: `Cycling Expert: Provide detailed, highly technical, but EXTREMELY CONCISE (max 10 words per field) tactical advice.
        Focus Theme for this batch: ${theme}.
        Lang: ${settings.language}.
        Available Bikes: ${equipmentContext}.
        
        Instructions:
        - Avoid repetitive phrasing.
        - Use varied vocabulary and specific cycling terminology.
        - Ensure advice feels distinct from previous days.
        - Context: For 'clothing' field, mention specific layers/accessories.
        - Context: For 'setup' field, recommend tire pressure in Bar.

        Data: ${JSON.stringify(dataToProcess)}. 
        Return JSON array of objects: { "o": number, "mw": { "s": string, "st": string, "se": string, "c": string, "p": string }, "ew": { "s": string, "st": string, "se": string, "c": string, "p": string } } where s=summary, st=style, se=setup, c=clothing, p=performance.`,
        config: { temperature: 0.9, responseMimeType: "application/json" }
      });
      return extractJson(response.text);
    });

    const result: Record<number, { morning: any; evening: any }> = {};
    if (Array.isArray(parsedAIResults)) {
      parsedAIResults.forEach((aiRes: any) => {
        result[aiRes.o] = {
          morning: { summary: aiRes.mw.s, style: aiRes.mw.st, setup: aiRes.mw.se, clothing: aiRes.mw.c, performance: aiRes.mw.p },
          evening: { summary: aiRes.ew.s, style: aiRes.ew.st, setup: aiRes.ew.se, clothing: aiRes.ew.c, performance: aiRes.ew.p }
        };
      });
    }
    return result;
  } catch (error) {
    isAIFallingBack = true;
    console.error("AI Insight generation failed", error);
    throw error;
  }
};

export const getTrainingSessionAIAdvice = async (
  settings: CommuteSettings,
  weather: WeatherCondition,
  distance: number
): Promise<{ summary: string; style: string; setup: string; clothing: string; performance: string }> => {
  const equipmentContext = settings.equipment?.map(e => `${e.name} (${e.type}, ${e.tireWidth}mm)`).join(", ") || "No specific bike profile";
  const defaults = getStandardizedAdvice(weather);

  // Training Personas to add variance
  const PERSONAS = [
    "World Tour Directer Sportif (Tactical Focus)",
    "Exercise Physiologist (Body/Fuel Focus)",
    "Veteran Flandrien (Grit/Toughness Focus)",
    "Pro Team Mechanic (Equipment/Tire Focus)",
    "Meteorologist (Wind/Weather Focus)"
  ];
  const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];

  try {
    const { data } = await callWithRetry(async (aiInstance, modelName) => {
      const prompt = `Role: ${persona}. 
      Task: Analyze forecast for a ${distance}km training ride.
      Weather Data: ${JSON.stringify(weather)}.
      Rider Equipment: ${equipmentContext}.
      Language: ${settings.language}.

      Requirements:
      - strictly JSON output.
      - "summary": Analysis of road surface and atmospheric risks.
      - "performance": Physiological strategy (heart rate, fueling, intensity).
      - "style": Technical handling advice (braking, cornering).
      - "setup": Specific tire pressure (Bar) and equipment choice.
      - "clothing": Exact kit list (layers, gloves, overshoes).
      - Style: Use professional cycling jargon. Vary sentence structure. Avoid generic advice.

      Output JSON Structure:
      { 
        "summary": "string (max 20 words)", 
        "performance": "string (max 20 words)",
        "style": "string (max 15 words)", 
        "setup": "string (max 15 words)", 
        "clothing": "string (max 15 words)" 
      }`;
      
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { temperature: 0.9, responseMimeType: "application/json" }
      });
      return extractJson(response.text);
    });
    
    // Merge valid AI data with defaults to ensure no empty fields
    return {
        summary: data.summary || defaults.summary,
        style: data.style || defaults.style,
        setup: data.setup || defaults.setup,
        clothing: data.clothing || defaults.clothing,
        performance: data.performance || defaults.performance
    };
  } catch (e) {
    console.warn("AI Training Advice failed, falling back to algorithm:", e);
    // CRITICAL FIX: Return standard algorithmic advice instead of throwing
    // This ensures fields are always populated even if API is down
    return defaults;
  }
};

export const resolveAddress = async (query: string): Promise<{ address: string; coords: Coordinates; mapsUri?: string }> => {
  const normalizedQuery = query.trim().toLowerCase();
  
  if (BELGIAN_CITIES[normalizedQuery]) {
      return { address: normalizedQuery, coords: BELGIAN_CITIES[normalizedQuery] };
  }
  
  const cityKey = Object.keys(BELGIAN_CITIES).find(k => k.toLowerCase() === normalizedQuery);
  if (cityKey) {
      return { address: cityKey, coords: BELGIAN_CITIES[cityKey] };
  }

  const locationMatch = BELGIAN_LOCATIONS.find(l => l.name.toLowerCase() === normalizedQuery);
  if (locationMatch) {
      return { address: locationMatch.name, coords: { lat: locationMatch.lat, lng: locationMatch.lng } };
  }

  try {
    const { data } = await callWithRetry(async (aiInstance, modelName) => {
        const response = await aiInstance.models.generateContent({
        model: modelName, 
        contents: `Find the precise geographic coordinates and full standardized address for: "${query}". 
        If it's a specific street address, return that. If it's a city, return the city.
        Include Country.
        Return JSON: { "address": string, "lat": number, "lng": number }`,
        config: { 
            temperature: 0, 
            tools: [{ googleMaps: {} }] 
        },
        });
        
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const mapsUri = groundingChunks.find((chunk: any) => chunk.maps?.uri)?.maps?.uri;
        const parsed = extractJson(response.text);
        return { ...parsed, mapsUri };
    }, "gemini-2.5-flash", 2); 
    
    return { 
        address: data.address || query, 
        coords: { lat: data.lat, lng: data.lng },
        mapsUri: data.mapsUri
    };
  } catch (e) {
      console.warn("Address resolution failed:", e);
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
  }, "gemini-2.5-flash", 2); 
  
  return data.distance || null;
};

export const getGlobalLocationSuggestions = async (query: string): Promise<BelgianLocation[]> => {
  if (query.length < 3) return [];

  const normalizedQuery = query.toLowerCase();
  const localMatches = BELGIAN_LOCATIONS.filter(l => l.name.toLowerCase().includes(normalizedQuery)).slice(0, 5);
  
  if (localMatches.length > 0) {
      return localMatches;
  }

  try {
    const { data } = await callWithRetry(async (aiInstance, modelName) => {
      const response = await aiInstance.models.generateContent({
        model: modelName,
        contents: `Find up to 5 real specific locations (cities, landmarks, or streets) matching "${query}" using Google Maps. Return a raw JSON array (no markdown code blocks) of objects with properties: name (string, format "Name, Country" or "Street, City, Country"), lat (number), lng (number).`,
        config: { 
          temperature: 0, 
          tools: [{ googleMaps: {} }] 
        }
      });
      return extractJson(response.text);
    }, "gemini-2.5-flash", 2); 
    return data;
  } catch (e) {
    return [];
  }
};
