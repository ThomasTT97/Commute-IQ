import { GoogleGenAI, Type } from "@google/genai";
import { CommuteSettings, WeatherCondition, Language, Coordinates, ScoreDeduction, Equipment, TireSetup } from "../types";
import { BELGIAN_CITIES, ROAD_DETOUR_FACTOR } from "../constants";
import { BelgianLocation, REGIONAL_LOCATIONS } from "../locations";

export let lastApiErrorMessage: string | null = null;
export let lastApiErrorType: 'telemetry' | 'gemini' | 'maps' | null = null;
export let isAIFallingBack = false;

export let currentLLMModel: string | null = null;
export let currentLLMModelPriorityLabel: string | null = null;
export let remainingLLMAlternativesCount: number | null = null;
export let alternativeLLMModels: string[] = [];
export let isUsingFallbackModel = false;

export let activeWeatherProvider: 'Open-Meteo' | 'WeatherAPI' | 'Unknown' = 'Unknown';

const USAGE_CACHE_KEY = 'commute_iq_usage_log';

// Standardized model names as per latest GenAI SDK guidelines.
export const MODEL_CHAIN = [
  "gemini-3-flash-preview",
  "gemini-flash-latest",          
  "gemini-flash-lite-latest" 
];

/**
 * Standardizes the calculation of estimated road distance from a straight-line (Haversine) distance.
 * Based on average urban detour factors for cyclists.
 */
export const estimateRoadDistance = (straightDistance: number): number => {
  return straightDistance * ROAD_DETOUR_FACTOR;
};

export const getDirectLocationSuggestions = async (query: string): Promise<BelgianLocation[]> => {
  if (!query || query.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'nl,fr,en', 'User-Agent': 'Commute-IQ-App' }
    });
    if (!res.ok) throw new Error("Maps API unreachable");
    const data = await res.json();
    
    const mapped = data.map((item: any) => {
      const addr = item.address;
      const houseNum = addr.house_number || "";
      const street = addr.road || addr.pedestrian || addr.cycleway || addr.path || "";
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || "";
      const zip = addr.postcode || "";
      const country = addr.country || "";
      let cleanName = "";
      const isRegional = !street;
      if (isRegional) {
        const main = city || item.name || item.display_name.split(',')[0];
        cleanName = country ? `${main}, ${country}` : main;
      } else {
        const addressPart = houseNum ? `${street} ${houseNum}` : street;
        const localityPart = zip ? `${zip} ${city}` : city;
        const parts = [addressPart, localityPart, country].filter(p => p && p.length > 0);
        cleanName = parts.join(', ');
      }
      return { name: cleanName, lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
    });

    const uniqueLocations: BelgianLocation[] = [];
    const seenNames = new Set<string>();
    
    for (const loc of mapped) {
      if (!seenNames.has(loc.name)) {
        seenNames.add(loc.name);
        uniqueLocations.push(loc);
      }
    }
    
    return uniqueLocations;
  } catch (e) {
    return REGIONAL_LOCATIONS.filter(l => l.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  }
};

export const reverseGeocodeDirect = async (coords: Coordinates): Promise<string> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'nl,fr,en', 'User-Agent': 'Commute-IQ-App' } });
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    const addr = data.address;
    const houseNum = addr.house_number || "";
    const street = addr.road || addr.pedestrian || addr.cycleway || "";
    const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || "Unknown City";
    const zip = addr.postcode || "";
    const country = addr.country || "";
    if (!street) return country ? `${city}, ${country}` : city;
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
    const oneDayAgo = now - 86400000;
    const validLog = log.filter(t => t > oneDayAgo);
    const rpm = validLog.filter(t => t > (now - 60000)).length;
    return { rpm, rpd: validLog.length, log: validLog };
  } catch (e) { return { rpm: 0, rpd: 0, log: [] }; }
};

const recordLlmRequest = () => {
  const { log } = getLlmUsageStats();
  log.push(Date.now());
  localStorage.setItem(USAGE_CACHE_KEY, JSON.stringify(log));
};

export const fetchWeatherAPIFallback = async (coords: Coordinates): Promise<any> => {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${coords.lat}&lon=${coords.lng}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Commute-IQ-Cycling-App github.com/user/commute-iq' }
  });
  if (!res.ok) throw new Error("Fallback Weather API failed");
  const data = await res.json();
  
  const hourly: any = {
    time: [],
    temperature_2m: [],
    precipitation: [],
    weather_code: [],
    wind_speed_10m: [],
    wind_direction_10m: [],
    relative_humidity_2m: [],
    apparent_temperature: []
  };

  data.properties.timeseries.forEach((ts: any) => {
    const details = ts.data.instant.details;
    const next1 = ts.data.next_1_hours?.details || ts.data.next_6_hours?.details || {};
    hourly.time.push(ts.time);
    hourly.temperature_2m.push(details.air_temperature);
    hourly.apparent_temperature.push(details.air_temperature);
    hourly.precipitation.push(next1.precipitation_amount || 0);
    hourly.wind_speed_10m.push((details.wind_speed || 0) * 3.6);
    hourly.wind_direction_10m.push(details.wind_from_direction);
    hourly.relative_humidity_2m.push(details.relative_humidity);
    hourly.weather_code.push(0);
  });

  return { hourly, daily: { sunrise: ["07:00"], sunset: ["20:00"] }, fallbackUsed: true };
};

export const fetchRawWeatherData = async (coords: Coordinates): Promise<any> => {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') throw new Error("Invalid coordinates");
  
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&hourly=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m&daily=sunrise,sunset&timezone=auto&past_days=1&forecast_days=14`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Primary weather telemetry failed");
    activeWeatherProvider = 'Open-Meteo';
    return res.json();
  } catch (e) {
    console.warn("Primary weather provider failed, trying fallback Met.no");
    try {
      const fallbackData = await fetchWeatherAPIFallback(coords);
      activeWeatherProvider = 'WeatherAPI';
      return fallbackData;
    } catch (fallbackError) {
      activeWeatherProvider = 'Unknown';
      throw new Error("All weather telemetry providers failed");
    }
  }
};

export const sliceWeatherData = (hourly: any, window: [string, string], offset: number): any => {
  const startHour = parseInt(window[0].split(':')[0]);
  const endHour = parseInt(window[1].split(':')[0]);
  const startIndex = (offset + 1) * 24 + startHour;
  const endIndex = (offset + 1) * 24 + endHour;
  const slice: any = {};
  Object.keys(hourly).forEach(key => { 
    if (Array.isArray(hourly[key])) {
      slice[key] = hourly[key].slice(startIndex, endIndex + 1); 
    }
  });
  return slice;
};

const calculateOptimalPressure = (equipment: Equipment, w: WeatherCondition): string => {
  const { riderWeight, tireWidth, tireSetup, surfacePreference } = equipment;
  let pressure = (riderWeight * 0.045) + 3.8 - ((tireWidth - 25) * 0.14);
  if (tireSetup === 'Tubeless') pressure -= 0.6;
  if (tireSetup === 'Clincher (TPU)' || tireSetup === 'Clincher (Latex)') pressure -= 0.2;
  if (tireSetup === 'Tubular') pressure += 0.2;
  pressure -= (surfacePreference / 100) * 1.4;
  pressure = Math.max(1.5, Math.min(8.5, pressure));
  if (w.isSnowy || w.iceRisk) pressure -= 0.6;
  else if ((w.precipitation > 0) || (w.wetSurfaceChance > 10)) pressure -= 0.3;
  return `${Math.max(1.2, pressure).toFixed(1)} Bar`;
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
  if (firstBrace >= 0 && lastBrace > firstBrace) cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  try { return JSON.parse(cleanText); } catch (e) { return {}; }
};

// Refactored to strictly use named parameter for GoogleGenAI and direct process.env mapping.
const callWithRetry = async <T>(fn: (aiInstance: GoogleGenAI, modelName: string) => Promise<T>): Promise<{ data: T; model: string }> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");
  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const res = await fn(ai, MODEL_CHAIN[i]);
      currentLLMModel = MODEL_CHAIN[i];
      isUsingFallbackModel = i > 0;
      remainingLLMAlternativesCount = MODEL_CHAIN.length - 1 - i;
      alternativeLLMModels = MODEL_CHAIN.slice(i + 1);
      recordLlmRequest();
      return { data: res, model: MODEL_CHAIN[i] };
    } catch (e) { if (i === MODEL_CHAIN.length - 1) throw e; }
  }
  throw new Error("AI Chain Exhausted");
};

export const checkLLMConnectivity = async (): Promise<boolean> => {
  try { 
    // Optimization: Setting thinkingBudget to 0 for rapid connectivity checks.
    await callWithRetry(async (ai, model) => ai.models.generateContent({ 
      model, 
      contents: "Hi", 
      config: { 
        maxOutputTokens: 10, 
        thinkingConfig: { thinkingBudget: 0 } 
      } 
    })); 
    return true; 
  } catch (e) { 
    return false; 
  }
};

export const calculateDistance = (c1?: Coordinates, c2?: Coordinates): number => {
  if (!c1 || !c2) return 0;
  const R = 6371.0088; // Mean radius of Earth in km
  const lat1 = c1.lat * Math.PI / 180;
  const lat2 = c2.lat * Math.PI / 180;
  const dLat = (c2.lat - c1.lat) * Math.PI / 180;
  const dLon = (c2.lng - c1.lng) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
  directions.forEach(dir => { totalImpact += Math.cos(radHeading - (dir * Math.PI) / 180); });
  return (totalImpact / directions.length) * 100;
};

const getMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const t = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
  const parts = t.split(':');
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]) || 0;
  return h * 60 + m;
};

export const getScoreBreakdown = (w: Partial<WeatherCondition>, isTraining: boolean = false, startHour?: number): ScoreDeduction[] => {
  const items: ScoreDeduction[] = [];
  if (w.isSnowy) items.push({ label: "Active Snowfall", val: -60 });
  if (w.iceRisk) items.push({ label: "Critical Ice Risk", val: -70 });
  
  if (!w.isSnowy) {
    if ((w.precipitation || 0) > 0) {
      const precipDeduction = 20 + Math.min(20, (w.precipitation || 0) * 5);
      items.push({ label: "Active Precipitation", val: -Math.round(precipDeduction) });
    } else if ((w.wetSurfaceChance || 0) > 80) {
      items.push({ label: "Wet Roads", val: -10 });
    } else if ((w.wetSurfaceChance || 0) >= 10) {
      items.push({ label: "Damp Surface", val: -5 });
    }
  }

  // Toned down wind speed impact: factor reduced from 1.65 to 1.0, threshold increased to 15
  if ((w.windSpeed || 0) > 15) {
    const windDeduction = ((w.windSpeed || 0) - 15) * 1.0;
    items.push({ label: "Wind Intensity", val: -Math.round(windDeduction) });
  }

  if (!isTraining) {
    if ((w.headwindImpact || 0) > 20) {
      // Capped headwind deduction to max 10% as requested
      const rawDeduction = (w.headwindImpact || 0) / 8;
      const headwindDeduction = Math.min(10, rawDeduction);
      items.push({ label: "Headwind Drag", val: -Math.round(headwindDeduction) });
    } else if ((w.headwindImpact || 0) < -30) {
      items.push({ label: "Tailwind Boost", val: 5 });
    }
  }

  const temp = w.temp || 0;
  if (isTraining) {
    if (temp < 10) items.push({ label: "Cold Exposure", val: -Math.round((10 - temp) * 2.5) });
    else if (temp > 15) {
      if (temp > 28) items.push({ label: "Heat Stress", val: -Math.round((temp - 28) * 2.5) });
      else items.push({ label: "Weather Surplus", val: Math.round(temp - 15) });
    }
    if (startHour !== undefined) {
      if (startHour >= 23 || startHour < 5) {
        items.push({ label: "Sleep hours", val: -20 });
      }
    }
  } else {
    if (temp < 5) items.push({ label: "Cold Exposure", val: -Math.round((5 - temp) * 2.5) });
    else if (temp > 28) items.push({ label: "Heat Stress", val: -Math.round((temp - 28) * 2.5) });
  }
  if (w.isDark) items.push({ label: "Darkness / Visibility", val: -10 });
  return items;
};

export const aggregateRawWeather = (
  rawSlice: any, heading: number, isMorning: boolean, settings: CommuteSettings,
  sunTimes?: { sunrise: string, sunset: string }, minPastTemp: number = 99,
  customWindow?: [string, string], fullRawHourlyPrecip?: number[],
  sessionStartAbsoluteIdx?: number, isTraining: boolean = false,
  fullRawHourlyHumidity?: number[], fullRawHourlyTemp?: number[],
  fullRawHourlyCodes?: number[], fullRawHourlyWinds?: number[]
): WeatherCondition => {
  const temps = (rawSlice.temperature_2m || []) as number[];
  const apparentTemps = (rawSlice.apparent_temperature || []) as number[];
  const precips = (rawSlice.precipitation || []) as number[];
  const winds = (rawSlice.wind_speed_10m || []) as number[];
  const dirs = (rawSlice.wind_direction_10m || []) as number[];
  const codes = (rawSlice.weather_code || []) as number[];
  const humidities = (rawSlice.relative_humidity_2m || []) as number[];

  const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 15;
  const apparentTemp = apparentTemps.length ? apparentTemps.reduce((a, b) => a + b, 0) / apparentTemps.length : avgTemp;
  const minTemp = temps.length ? Math.min(...temps) : 15;
  const maxTemp = temps.length ? Math.max(...temps) : 15;
  const totalPrecip = precips.length ? precips.reduce((a, b) => a + b, 0) : 0;
  const maxWind = winds.length ? Math.max(...winds) : 10;
  const avgDir = dirs.length ? dirs.reduce((a, b) => a + b, 0) / dirs.length : 0;
  const avgHum = humidities.length ? humidities.reduce((a, b) => a + b, 0) / humidities.length : 50;
  const maxCode = codes.length ? Math.max(...codes) : 0;

  const startTemp = temps.length ? temps[0] : avgTemp;
  const startWindSpeed = winds.length ? winds[0] : maxWind;
  const startWindDirection = dirs.length ? dirs[0] : avgDir;

  const isSnowy = [71, 73, 75, 77, 85, 86].includes(maxCode);
  const headwindImpact = Math.round(calculateAverageWindImpact(heading, dirs));
  const timeWindow = customWindow || (isMorning ? settings.morningWindow : settings.eveningWindow);
  
  let isDark = false;
  if (sunTimes) {
    const startMin = getMinutes(timeWindow[0]);
    const endMin = getMinutes(timeWindow[1]);
    const sunriseMin = getMinutes(sunTimes.sunrise);
    const sunsetMin = getMinutes(sunTimes.sunset);
    if (endMin < startMin) isDark = true;
    else isDark = startMin < sunriseMin || endMin > sunsetMin;
  } else {
    const startH = parseInt(timeWindow[0].split(':')[0]);
    isDark = startH < 6 || startH >= 21; 
  }

  // --- SURFACE WETNESS: WATER BUDGET MODEL ---
  let waterFilmDepth = 0; // in mm
  const DRAINAGE_CAP = 0.5; // mm. Maximum standing water on cambered road before runoff.
  const LOOKBACK_HOURS = 24; // Physics simulation window
  const DRY_THRESHOLD = 0.02; // Threshold at which road transition from DAMP/WET to DRY
  let lastPrecipTime = "None";
  let estimatedDryTime: number | undefined;
  
  // Calculate 24h Precipitation Volume
  let precip24h = 0;

  // Backward Simulation: Establish current state
  if (fullRawHourlyPrecip && sessionStartAbsoluteIdx !== undefined) {
    for (let i = LOOKBACK_HOURS; i >= 0; i--) {
      const idx = sessionStartAbsoluteIdx - i;
      if (idx < 0) continue;

      const hRain = fullRawHourlyPrecip[idx] ?? 0;
      const hTemp = fullRawHourlyTemp?.[idx] ?? avgTemp;
      const hHum = fullRawHourlyHumidity?.[idx] ?? avgHum;
      const hCode = fullRawHourlyCodes?.[idx] ?? 0;
      const hWind = fullRawHourlyWinds?.[idx] ?? maxWind; 

      const hour = idx % 24;
      const isDaytime = hour >= 7 && hour <= 19;

      if (i > 0) precip24h += hRain;

      // 1. ADD WATER (Precipitation)
      if (hRain > 0) {
        waterFilmDepth += hRain;
        if (waterFilmDepth > DRAINAGE_CAP) waterFilmDepth = DRAINAGE_CAP;
        
        const dayDiff = Math.floor(sessionStartAbsoluteIdx / 24) - Math.floor(idx / 24);
        const dayLabel = dayDiff === 0 ? "Today" : "Yest";
        const timeLabel = `${dayLabel} ${hour % 12 || 12}${hour >= 12 ? 'PM' : 'AM'}`;
        if (i > 0) lastPrecipTime = timeLabel;
      }

      // 2. ADD WATER (Condensation / Dew)
      const dewPoint = hTemp - ((100 - hHum) / 5);
      if (!isDaytime && hTemp <= dewPoint + 1.0 && hHum > 90) {
         waterFilmDepth += 0.05; 
         if (waterFilmDepth > DRAINAGE_CAP) waterFilmDepth = DRAINAGE_CAP;
      }

      // 3. REMOVE WATER (Evaporation)
      let evapBase = 0.1;
      let solarFactor = !isDaytime ? 0.1 : (hCode <= 2 ? 2.5 : 1.0);
      const humidityFactor = Math.max(0, (95 - hHum) / 45);
      const windFactor = 1 + (hWind / 10);
      const tempFactor = Math.pow(1.05, (hTemp - 15));
      const totalEvap = evapBase * solarFactor * humidityFactor * windFactor * tempFactor;
      waterFilmDepth = Math.max(0, waterFilmDepth - totalEvap);
    }
  }

  // Forward Simulation: Calculate Estimated Dry Time
  if (waterFilmDepth > DRY_THRESHOLD && sessionStartAbsoluteIdx !== undefined) {
    let futureDepth = waterFilmDepth;
    let hoursForward = 0;
    
    // Aligned to loop until futureDepth reaches the same DRY_THRESHOLD used by the UI label
    while (futureDepth > DRY_THRESHOLD && hoursForward < 24) {
       hoursForward++;
       const idx = sessionStartAbsoluteIdx + hoursForward;
       const hTemp = fullRawHourlyTemp?.[idx] ?? avgTemp;
       const hHum = fullRawHourlyHumidity?.[idx] ?? avgHum;
       const hCode = fullRawHourlyCodes?.[idx] ?? maxCode;
       const hWind = fullRawHourlyWinds?.[idx] ?? maxWind;
       const hour = idx % 24;
       const isDaytime = hour >= 7 && hour <= 19;

       let evapBase = 0.1;
       let solarFactor = (!isDaytime) ? 0.1 : (hCode <= 2 ? 2.5 : 1.0);
       const humidityFactor = Math.max(0, (95 - hHum) / 45);
       const windFactor = 1 + (hWind / 10);
       const tempFactor = Math.pow(1.05, (hTemp - 15));
       const totalEvap = evapBase * solarFactor * humidityFactor * windFactor * tempFactor;

       futureDepth = Math.max(0, futureDepth - totalEvap);
    }
    
    const oneHourMs = 3600 * 1000;
    // CRITICAL: Aligned temporal origin.
    // Instead of recalculating new Date() per call, we anchor relative to the day index.
    // Index 24 is always "Today 00:00" in our OpenMeteo past_days=1 setup.
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayMs = today.getTime();
    
    // Convert current absolute index + hoursForward into a timestamp relative to Today 00:00
    // sessionStartAbsoluteIdx is hours since Yesterday 00:00.
    const hoursSinceTodayStart = sessionStartAbsoluteIdx - 24;
    estimatedDryTime = todayMs + (hoursSinceTodayStart + hoursForward) * oneHourMs;
  }

  let wetSurfaceChance = 0;
  if (waterFilmDepth > 0.1) wetSurfaceChance = 95; 
  else if (waterFilmDepth > DRY_THRESHOLD) wetSurfaceChance = 45; 
  else wetSurfaceChance = 5; 

  if (totalPrecip > 0.05) wetSurfaceChance = 100;

  const overnightFreeze = minPastTemp <= 0.5;

  // GROUND TEMPERATURE ESTIMATION MODEL
  let groundTemp = avgTemp;
  let coolingOffset = 1.8;
  if (avgHum >= 90) coolingOffset = 0.4;
  else if (avgHum >= 75) coolingOffset = 1.0;
  else if (avgHum <= 45) coolingOffset = 2.5;

  if (overnightFreeze) groundTemp = (avgTemp * 0.3) + (minPastTemp * 0.7);
  else groundTemp = avgTemp - coolingOffset;
  
  if (isDark) {
    if (avgHum >= 85) groundTemp -= 0.2;
    else groundTemp -= 1.0; 
  }
  
  const finalGroundTemp = parseFloat(groundTemp.toFixed(1));

  let iceRisk = false;
  if (isSnowy) {
    iceRisk = true;
  } else {
    const isGroundFrozen = finalGroundTemp <= 0.8; 
    if (isGroundFrozen) {
      const hasMoisture = (wetSurfaceChance >= 10) || (avgHum > 78);
      if (hasMoisture) iceRisk = true;
    }
  }

  const startHour = parseInt(timeWindow[0].split(':')[0]);
  const baseWeather: any = {
    temp: parseFloat(avgTemp.toFixed(1)), 
    startTemp: parseFloat(startTemp.toFixed(1)),
    feelsLike: parseFloat(apparentTemp.toFixed(1)),
    minTemp: parseFloat(minTemp.toFixed(1)), 
    maxTemp: parseFloat(maxTemp.toFixed(1)),
    estimatedGroundTemp: finalGroundTemp,
    condition: isSnowy ? 'Snowy' : (totalPrecip > 0.5 ? 'Rainy' : (maxWind > 35 ? 'Windy' : (maxCode <= 1 ? 'Sunny' : 'Cloudy'))),
    isSnowy, 
    precipitation: parseFloat(totalPrecip.toFixed(1)),
    windSpeed: parseFloat(maxWind.toFixed(1)), 
    startWindSpeed: parseFloat(startWindSpeed.toFixed(1)),
    windDirection: Math.round(avgDir), 
    startWindDirection: Math.round(startWindDirection),
    humidity: Math.round(avgHum),
    isDark, wetSurfaceChance, headwindImpact, iceRisk, 
    overnightFreeze, minPastTemp: minPastTemp === 99 ? avgTemp : parseFloat(minPastTemp.toFixed(1)), 
    lastPrecipitationTime: lastPrecipTime, estimatedDryTime,
    precipDuringSession: parseFloat(totalPrecip.toFixed(1)), 
    precip24h: parseFloat(precip24h.toFixed(1)),
    sunrise: sunTimes?.sunrise, sunset: sunTimes?.sunset
  };

  const breakdown = getScoreBreakdown(baseWeather, isTraining, startHour);
  baseWeather.scoreBreakdown = breakdown;
  baseWeather.score = Math.max(0, Math.min(100, 100 + breakdown.reduce((acc, curr) => acc + curr.val, 0)));

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
  const [homeRaw, workRaw] = await Promise.all([fetchRawWeatherData(settings.homeCoords), fetchRawWeatherData(settings.workCoords)]);
  const batch: Record<number, any> = {};
  const avgTemp = 15;

  for (const offset of offsets) {
    const dayStartIdx = (offset + 1) * 24;
    const sunTimesM = { sunrise: homeRaw.daily?.sunrise?.[offset + 1] || "07:00", sunset: homeRaw.daily?.sunset?.[offset + 1] || "20:00" };
    const mIdx = dayStartIdx + parseInt(settings.morningWindow[0].split(':')[0]);
    const mWeather = aggregateRawWeather(sliceWeatherData(homeRaw.hourly, settings.morningWindow, offset), calculateBearing(settings.homeCoords, settings.workCoords), true, settings, sunTimesM, Math.min(...(homeRaw.hourly.temperature_2m.slice(Math.max(0, mIdx - 6), mIdx) || [avgTemp])), undefined, homeRaw.hourly.precipitation, mIdx, false, homeRaw.hourly.relative_humidity_2m, homeRaw.hourly.temperature_2m, homeRaw.hourly.weather_code, homeRaw.hourly.wind_speed_10m);
    
    const sunTimesE = { sunrise: workRaw.daily?.sunrise?.[offset + 1] || "07:00", sunset: workRaw.daily?.sunset?.[offset + 1] || "20:00" };
    const eIdx = dayStartIdx + parseInt(settings.eveningWindow[0].split(':')[0]);
    const eWeather = aggregateRawWeather(sliceWeatherData(workRaw.hourly, settings.eveningWindow, offset), calculateBearing(settings.workCoords, settings.homeCoords), false, settings, sunTimesE, Math.min(...(workRaw.hourly.temperature_2m.slice(Math.max(0, eIdx - 6), eIdx) || [avgTemp])), undefined, workRaw.hourly.precipitation, eIdx, false, workRaw.hourly.relative_humidity_2m, workRaw.hourly.temperature_2m, workRaw.hourly.weather_code, workRaw.hourly.wind_speed_10m);

    batch[offset] = {
      weather: { morning: mWeather, evening: eWeather }, lastUpdated: Date.now(),
      score: Math.min(mWeather.score, eWeather.score),
      summary: { isWet: mWeather.wetSurfaceChance >= 10 || eWeather.wetSurfaceChance >= 10, isSnowy: mWeather.isSnowy || eWeather.isSnowy, isIcy: mWeather.iceRisk || eWeather.iceRisk }
    };
  }
  return batch;
};

export const getAIInsights = async (settings: CommuteSettings, telemetry: Record<number, any>): Promise<Record<number, any>> => {
  const { data } = await callWithRetry(async (ai, model) => {
    const response = await ai.models.generateContent({ 
      model, 
      contents: `Tactical advice for cycling commute. Data: ${JSON.stringify(telemetry)}. RETURN JSON format with numeric keys as strings representing offsets. Each object should have 'morning' and 'evening' sub-objects with these fields: 'summary', 'style', 'setup', 'clothing', 'performance'.`, 
      config: { responseMimeType: "application/json" } 
    });
    return extractJson(response.text);
  });
  return data;
};

export const getCommuteDayAIAdvice = async (settings: CommuteSettings, weather: any): Promise<any> => {
  const { data } = await callWithRetry(async (ai, model) => {
    const response = await ai.models.generateContent({ 
      model, 
      contents: `Expert cycling tactical advice for commute. 
      Morning Weather: ${JSON.stringify(weather.morning)}
      Evening Weather: ${JSON.stringify(weather.evening)}
      Goal: ${settings.fitnessGoal}
      RETURN JSON with keys '0' for morning and '1' for evening. Each should contain 'summary', 'style', 'setup', 'clothing', 'performance'. Keep it concise.`, 
      config: { responseMimeType: "application/json" } 
    });
    return extractJson(response.text);
  });
  return data;
};

export const getTrainingSessionAIAdvice = async (settings: CommuteSettings, condition: WeatherCondition, distance: number): Promise<any> => {
  const { data } = await callWithRetry(async (ai, model) => {
    const response = await ai.models.generateContent({ 
      model, 
      contents: `Expert elite tactical cycling intelligence for a ${distance}km training session. 
      Weather Telemetry: ${JSON.stringify(condition)}
      Equipment Config: ${JSON.stringify(settings.equipment.find(e => e.isSelected))}
      
      CRITICAL INSTRUCTION: You MUST return a high-quality JSON object with exactly these five fields. Do not omit any.
      - 'summary': A technical, professional summary of the training conditions (1-2 sentences).
      - 'performance': Specific, high-level physiological and intensity advice for the specified distance (threshold focus, muscular endurance, or recovery).
      - 'style': Explicit technical bike handling, aerodynamic positioning, and cornering strategy for these specific winds/surfaces.
      - 'setup': Critical mechanical specificities (exact tire pressure adjustments, visibility hardware needs, tool requirements).
      - 'clothing': Comprehensive thermal regulation and layering strategy specifically for this humidity, wind chill, and precip profile.
      
      Tone: Elite, data-driven, and technical. Return raw JSON ONLY.`, 
      config: { responseMimeType: "application/json" } 
    });
    return extractJson(response.text);
  });
  return data;
};

export const getNearbyCyclingHubs = async (coords: Coordinates): Promise<BelgianLocation[]> => {
  const { data } = await callWithRetry(async (ai, model) => {
    const response = await ai.models.generateContent({
      model,
      contents: `You are a cycling geography expert. Identify 15-20 significant towns or cities with active cycling communities within a 250km radius of these coordinates: Lat ${coords.lat}, Lng ${coords.lng}. 
      RETURN JSON ONLY in this format: { "hubs": [{ "name": "City Name, Region", "lat": 1.23, "lng": 4.56 }] }`,
      config: { responseMimeType: "application/json" }
    });
    return extractJson(response.text);
  });
  return data.hubs || [];
};

export const getGlobalLocationSuggestions = async (query: string): Promise<BelgianLocation[]> => getDirectLocationSuggestions(query);

export const resolveAddress = async (address: string): Promise<{ address: string; lat: number; lng: number }> => {
  if (address.includes(',')) {
    const [lat, lng] = address.split(',').map(v => parseFloat(v.trim()));
    if (!isNaN(lat) && !isNaN(lng)) return { address: await reverseGeocodeDirect({ lat, lng }), lat, lng };
  }
  const results = await getDirectLocationSuggestions(address);
  if (results.length > 0) return { address: results[0].name, lat: results[0].lat, lng: results[0].lng };
  throw new Error("Location not found");
};