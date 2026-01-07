
import { GoogleGenAI, Type } from "@google/genai";
import { CommuteSettings, WeatherCondition, Language, Coordinates, ScoreDeduction, Equipment } from "../types";
import { BELGIAN_CITIES } from "../constants";
import { BelgianLocation, BELGIAN_LOCATIONS } from "../locations";

export let lastApiErrorMessage: string | null = null;
export let lastApiErrorType: 'telemetry' | 'gemini' | 'maps' | null = null;
export let isAIFallingBack = false;

export let currentLLMModel: string | null = null;
export let currentLLMModelPriorityLabel: string | null = null;
export let remainingLLMAlternativesCount: number | null = null;
export let isUsingFallbackModel = false;

const USAGE_CACHE_KEY = 'commute_iq_usage_log';

export const MODEL_CHAIN = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",          
  "gemini-flash-latest",                
  "gemini-flash-lite-latest" 
];

/**
 * Direct Maps API (Nominatim) for ultra-fast, non-LLM lookups.
 * Enabled for European-wide search with improved city/country formatting.
 */
export const getDirectLocationSuggestions = async (query: string): Promise<BelgianLocation[]> => {
  if (!query || query.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'nl,fr,en' }
    });
    if (!res.ok) throw new Error("Maps API unreachable");
    const data = await res.json();
    
    return data.map((item: any) => {
      const addr = item.address;
      const type = item.addresstype || item.type;
      
      const houseNum = addr.house_number || "";
      const street = addr.road || addr.pedestrian || addr.cycleway || addr.path || "";
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || "";
      const zip = addr.postcode || "";
      const country = addr.country || "";
      
      let cleanName = "";

      // Logic to handle City-level lookups differently from Address-level lookups
      const isRegional = ['city', 'town', 'village', 'municipality', 'state', 'country', 'administrative'].includes(type) || !street;

      if (isRegional) {
        // Format: City, Country
        const main = city || item.name || item.display_name.split(',')[0];
        cleanName = country ? `${main}, ${country}` : main;
      } else {
        // Format: Street HouseNum, Zip City, Country
        const addressPart = houseNum ? `${street} ${houseNum}` : street;
        const localityPart = zip ? `${zip} ${city}` : city;
        const parts = [addressPart, localityPart, country].filter(p => p && p.length > 0);
        cleanName = parts.join(', ');
      }

      // Fallback to OSM's display name if construction failed
      if (!cleanName || cleanName.length < 5) {
        cleanName = item.display_name.split(',').slice(0, 3).join(', ');
      }

      return {
        name: cleanName,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      };
    });
  } catch (e) {
    return BELGIAN_LOCATIONS.filter(l => 
      l.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
  }
};

export const reverseGeocodeDirect = async (coords: Coordinates): Promise<string> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'nl,fr,en' }
    });
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    const addr = data.address;
    
    const houseNum = addr.house_number || "";
    const street = addr.road || addr.pedestrian || addr.cycleway || "";
    const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || "Unknown City";
    const zip = addr.postcode || "";
    const country = addr.country || "";

    if (!street) {
      return country ? `${city}, ${country}` : city;
    }

    const addressLine = houseNum ? `${street} ${houseNum}` : street;
    const localityLine = zip ? `${zip} ${city}` : city;
    return `${addressLine}, ${localityLine}${country ? `, ${country}` : ''}`;
  } catch (e) {
    return `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`;
  }
};

export const getLlmUsageStats = () => {
  try {
    const raw = localStorage.getItem(USAGE_CACHE_KEY);
    const log: number[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const oneMinAgo = now - 60000;
    const oneDayAgo = now - 86400000;
    const validLog = log.filter(t => t > oneDayAgo);
    const rpm = validLog.filter(t => t > oneMinAgo).length;
    const rpd = validLog.length;
    return { rpm, rpd, log: validLog };
  } catch (e) {
    return { rpm: 0, rpd: 0, log: [] };
  }
};

const recordLlmRequest = () => {
  const { log } = getLlmUsageStats();
  log.push(Date.now());
  localStorage.setItem(USAGE_CACHE_KEY, JSON.stringify(log));
};

export const fetchRawWeatherData = async (coords: Coordinates): Promise<any> => {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
    throw new Error("Invalid coordinates");
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m&daily=sunrise,sunset&timezone=auto&past_days=1&forecast_days=14`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather telemetry failed");
  return res.json();
};

export const sliceWeatherData = (hourly: any, window: [string, string], offset: number): any => {
  const startHour = parseInt(window[0].split(':')[0]);
  const endHour = parseInt(window[1].split(':')[0]);
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
  if (w.isSnowy || w.iceRisk) pressure -= 0.6;
  else if ((w.precipitation > 0) || (w.wetSurfaceChance > 50)) pressure -= 0.3;
  return `${pressure.toFixed(1)} Bar`;
};

export const getStandardizedAdvice = (w: WeatherCondition, equipment?: Equipment): { summary: string; style: string; setup: string; clothing: string; performance: string } => {
  let summary = "Standard atmospheric conditions. Maintain normal safety protocols.";
  let style = "Ride predictably and maintain visibility.";
  let setup = "Standard tire pressure and check lights.";
  let clothing = "Short bibs and short sleeves. Standard kit.";
  let performance = "Optimal physiological conditions for threshold training and endurance improvement.";

  if (w.temp < 5) clothing = "Thermal long bibs, winter jacket, heavy gloves, and neoprene overshoes required.";
  else if (w.temp < 10) clothing = "Long bibs (or leg warmers), long sleeve jersey, base layer, and full-finger gloves.";
  else if (w.temp < 15) clothing = "Short bibs with knee warmers, arm warmers, and a wind gilet. Light gloves recommended.";
  else if (w.temp < 20) clothing = "Short bibs, short sleeves. Carry a gilet or arm warmers for descent/stops.";

  if (w.isSnowy) {
    summary = "Snow active on route. Critical traction loss and visibility reduction.";
    style = "Extreme caution. Maintain upright posture. Brake well in advance.";
    setup = "Maximum tire width, minimum safe pressure. Use winter tires if available.";
    clothing = "Waterproof hardshell, deep thermal layers, and insulated gloves essential.";
    performance = "Low intensity only. Focus on survival and stability, not metrics.";
  } else if (w.iceRisk) {
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
  } else if (w.temp <= 0) {
    summary = "Freezing temperatures. Surface dynamics have reached or dropped below 0°C.";
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
  let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  } else {
     const firstBracket = cleanText.indexOf('[');
     const lastBracket = cleanText.lastIndexOf(']');
     if (firstBracket >= 0 && lastBracket > firstBracket) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
     }
  }
  try { return JSON.parse(cleanText); } catch (e) { return {}; }
};

const cleanErrorMessage = (error: any): string => {
  try {
    let msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    if (typeof msg === 'string' && (msg.startsWith('{') || msg.startsWith('['))) {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error?.message) msg = parsed.error.message;
        else if (parsed.message) msg = parsed.message;
      } catch { }
    }
    msg = msg.replace(/^Error: /, '').replace(/^\[GoogleGenAI Error\]: /, '').replace(/GoogleGenerativeAI/gi, 'AI Service');
    if (msg.includes('429') || msg.includes('Quota exceeded')) return "Service Busy (Quota Exceeded)";
    if (msg.includes('503') || msg.includes('Overloaded')) return "Service Overloaded";
    if (msg.includes('400') || msg.includes('API key')) return "Invalid Configuration/Key";
    if (msg.includes('fetch failed')) return "Network Connection Lost";
    if (msg.length > 60) return msg.substring(0, 57) + "...";
    return msg;
  } catch (e) { return "Connection disrupted"; }
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
        isAIFallingBack = false;
        currentLLMModel = modelName;
        isUsingFallbackModel = modelIndex > 0;
        currentLLMModelPriorityLabel = modelIndex === 0 ? "Primary" : `Fallback Tier ${modelIndex}`;
        remainingLLMAlternativesCount = modelsToTry.length - (modelIndex + 1);
        lastApiErrorMessage = null;
        recordLlmRequest();
        return { data: result, model: modelName };
      } catch (error: any) {
        const status = error?.status || error?.statusCode;
        const cleanMsg = cleanErrorMessage(error);
        collectedErrors.push(cleanMsg);
        if (status === 400 || status === 404) break;
        if (((status >= 500 && status <= 599) || status === 429) && i < maxRetriesPerModel) {
          const delay = 1000 * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        break; 
      }
    }
  }
  
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
         config: { 
           maxOutputTokens: 10,
           thinkingConfig: { thinkingBudget: 5 }
         } 
       });
      return true;
    }, undefined, 0); 
    return true;
  } catch (e) { return false; }
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
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snowy';
  if (code >= 51 || precip > 0.5) return 'Rainy';
  if (windSpeed > 35) return 'Windy';
  if (code <= 1) return 'Sunny';
  return 'Cloudy';
};

export const getScoreBreakdown = (w: Partial<WeatherCondition>, isTraining: boolean = false): ScoreDeduction[] => {
  const items: ScoreDeduction[] = [];
  if (w.isSnowy) items.push({ label: "Active Snowfall", val: -60 });
  if (w.iceRisk) items.push({ label: "Critical Ice Risk", val: -70 });
  if (!w.isSnowy && (w.precipitation || 0) > 0) {
    const precipDeduction = 20 + Math.min(20, (w.precipitation || 0) * 4);
    items.push({ label: "Active Precipitation", val: -Math.round(precipDeduction) });
  } else if (!w.isSnowy && (w.wetSurfaceChance || 0) > 50) {
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
  if (w.isDark) items.push({ label: "Darkness / Visibility", val: -5 });
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

  const isSnowy = [71, 73, 75, 77, 85, 86].includes(maxCode);
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

  let estimatedDryTime: number | undefined;
  if ((totalPrecip > 0 || lastPrecipTime !== "None") && fullRawHourlyPrecip && sessionStartAbsoluteIdx !== undefined) {
    let stopIdx = -1;
    for (let i = 0; i < 48; i++) {
      const idx = sessionStartAbsoluteIdx + i;
      if (idx >= fullRawHourlyPrecip.length) break;
      const rainAhead = fullRawHourlyPrecip.slice(idx, idx + 3);
      if (rainAhead.length >= 1 && rainAhead.every(v => v === 0)) {
        stopIdx = idx;
        break;
      }
    }
    if (stopIdx !== -1) {
      let evaporationHours = 2;
      const humAtStop = (fullRawHourlyHumidity?.[stopIdx] ?? avgHum);
      const tempAtStop = (fullRawHourlyTemp?.[stopIdx] ?? avgTemp);
      if (humAtStop > 85) evaporationHours += 6;
      else if (humAtStop > 70) evaporationHours += 3;
      if (tempAtStop < 5) evaporationHours += 4;
      else if (tempAtStop < 12) evaporationHours += 2;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      estimatedDryTime = startDate.getTime() + (stopIdx + evaporationHours) * 60 * 60 * 1000;
    }
  }

  const absoluteSessionStartDate = new Date();
  absoluteSessionStartDate.setDate(absoluteSessionStartDate.getDate() - 1);
  absoluteSessionStartDate.setHours(0,0,0,0);
  const sessionStartAbsoluteMs = absoluteSessionStartDate.getTime() + (sessionStartAbsoluteIdx || 0) * 60 * 60 * 1000;
  const isWetFromPrecip = totalPrecip > 0 || lastPrecipTime !== "None";
  const isCurrentlyInDryingPhase = estimatedDryTime ? estimatedDryTime > sessionStartAbsoluteMs : false;
  const isWet = isWetFromPrecip && (totalPrecip > 0 || isCurrentlyInDryingPhase);

  const activeFreezing = minTemp <= 0.5; 
  const nearFreezing = minTemp <= 3.5; 
  const overnightFreeze = minPastTemp <= 0;
  const humidityThreshold = overnightFreeze ? 60 : 75;
  const hasMoisture = isWet || avgHum > humidityThreshold || isSnowy;
  const iceRisk = hasMoisture && (activeFreezing || (overnightFreeze && nearFreezing));

  const baseWeather: any = {
    temp: parseFloat(avgTemp.toFixed(1)),
    minTemp: parseFloat(minTemp.toFixed(1)),
    maxTemp: parseFloat(maxTemp.toFixed(1)),
    condition,
    isSnowy,
    precipitation: parseFloat(totalPrecip.toFixed(1)),
    windSpeed: parseFloat(maxWind.toFixed(1)),
    windDirection: Math.round(avgDir),
    humidity: Math.round(avgHum),
    isDark,
    slipperyChance: isSnowy ? 90 : (isWet ? 60 : (avgTemp < 3 ? 40 : 10)),
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
  if (selectedEquipment) baseWeather.optimalPressure = calculateOptimalPressure(selectedEquipment, baseWeather);
  return baseWeather as WeatherCondition;
};

export const getTelemetryBatch = async (settings: CommuteSettings, offsets: number[]): Promise<Record<number, any>> => {
  if (!settings.homeCoords || !settings.workCoords) return {};
  const [homeRaw, workRaw] = await Promise.all([
    fetchRawWeatherData(settings.homeCoords),
    fetchRawWeatherData(settings.workCoords)
  ]);
  const batch: Record<number, any> = {};
  for (const offset of offsets) {
    const dayStartIdx = (offset + 1) * 24;
    const morningSlice = sliceWeatherData(homeRaw.hourly, settings.morningWindow, offset);
    const sunTimesMorning = { sunrise: homeRaw.daily?.sunrise?.[offset + 1] || "07:00", sunset: homeRaw.daily?.sunset?.[offset + 1] || "20:00" };
    const morningStartHour = parseInt(settings.morningWindow[0].split(':')[0]);
    const morningIdx = dayStartIdx + morningStartHour;
    const morningMinPast = homeRaw.hourly.temperature_2m.slice(Math.max(0, morningIdx - 6), morningIdx);
    const morningMinPastVal = morningMinPast.length ? Math.min(...morningMinPast) : 10;
    const morningWeather = aggregateRawWeather(morningSlice, calculateBearing(settings.homeCoords, settings.workCoords), true, settings, sunTimesMorning, morningMinPastVal, undefined, homeRaw.hourly.precipitation, morningIdx, false, homeRaw.hourly.relative_humidity_2m, homeRaw.hourly.temperature_2m);
    
    const eveningSlice = sliceWeatherData(workRaw.hourly, settings.eveningWindow, offset);
    const sunTimesEvening = { sunrise: workRaw.daily?.sunrise?.[offset + 1] || "07:00", sunset: workRaw.daily?.sunset?.[offset + 1] || "20:00" };
    const eveningStartHour = parseInt(settings.eveningWindow[0].split(':')[0]);
    const eveningIdx = dayStartIdx + eveningStartHour;
    const eveningMinPast = workRaw.hourly.temperature_2m.slice(Math.max(0, eveningIdx - 6), eveningIdx);
    const eveningMinPastVal = eveningMinPast.length ? Math.min(...eveningMinPast) : 10;
    const eveningWeather = aggregateRawWeather(eveningSlice, calculateBearing(settings.workCoords, settings.homeCoords), false, settings, sunTimesEvening, eveningMinPastVal, undefined, workRaw.hourly.precipitation, eveningIdx, false, workRaw.hourly.relative_humidity_2m, workRaw.hourly.temperature_2m);

    batch[offset] = {
      weather: { morning: morningWeather, evening: eveningWeather },
      lastUpdated: Date.now(),
      score: Math.min(morningWeather.score, eveningWeather.score),
      summary: { isWet: morningWeather.wetSurfaceChance > 50 || eveningWeather.wetSurfaceChance > 50, isSnowy: morningWeather.isSnowy || eveningWeather.isSnowy, isIcy: morningWeather.iceRisk || eveningWeather.iceRisk }
    };
  }
  return batch;
};

export const getAIInsights = async (settings: CommuteSettings, telemetry: Record<number, any>): Promise<Record<number, any>> => {
  const prompt = `Analyze cycling commute weather and provide tactical advice for each day. JSON keys: date offsets, values: { "morning": { "summary": "...", "style": "...", "setup": "...", "clothing": "...", "performance": "..." }, "evening": { ... } } Goal: ${settings.fitnessGoal} Data: ${JSON.stringify(telemetry)}`;
  const { data } = await callWithRetry(async (ai, model) => {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
    return extractJson(response.text);
  });
  return data;
};

export const getCommuteDayAIAdvice = async (settings: CommuteSettings, weather: any): Promise<any> => {
  const prompt = `Analyze cycling commute day gear and tactics. Return JSON: { "morning": { "summary": "...", "style": "...", "setup": "...", "clothing": "...", "performance": "..." }, "evening": { ... } } Morning: ${JSON.stringify(weather.morning)} Evening: ${JSON.stringify(weather.evening)}`;
  const { data } = await callWithRetry(async (ai, model) => {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
    return extractJson(response.text);
  });
  return data;
};

export const getTrainingSessionAIAdvice = async (settings: CommuteSettings, condition: WeatherCondition, distance: number): Promise<any> => {
  const prompt = `Analyze training session (${distance}km): Weather: ${JSON.stringify(condition)} Return JSON: { "summary": "...", "style": "...", "setup": "...", "clothing": "...", "performance": "..." }`;
  const { data } = await callWithRetry(async (ai, model) => {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
    return extractJson(response.text);
  });
  return data;
};

export const getCommuteRoadDistance = async (home: string, work: string): Promise<number | null> => {
  const prompt = `What is the cycling road distance (one way) between ${home} and ${work} in Belgium? Respond only with numerical value in km.`;
  const { data } = await callWithRetry(async (ai, model) => {
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt, config: { tools: [{ googleSearch: {} }] } });
    const text = response.text || "";
    const match = text.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  });
  return data;
};

export const getGlobalLocationSuggestions = async (query: string): Promise<BelgianLocation[]> => {
  return getDirectLocationSuggestions(query);
};

export const resolveAddress = async (address: string): Promise<{ address: string; lat: number; lng: number }> => {
  if (address.includes(',')) {
    const [lat, lng] = address.split(',').map(v => parseFloat(v.trim()));
    if (!isNaN(lat) && !isNaN(lng)) {
      const resolved = await reverseGeocodeDirect({ lat, lng });
      return { address: resolved, lat, lng };
    }
  }
  const results = await getDirectLocationSuggestions(address);
  if (results.length > 0) return { address: results[0].name, lat: results[0].lat, lng: results[0].lng };
  throw new Error("Location not found");
};
