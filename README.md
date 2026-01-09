# Commute IQ | Cycling Intelligence Dashboard

**Commute IQ** is a high-performance tactical companion for urban cyclists and athletes. It bridges the gap between raw meteorological telemetry and actionable transit intelligence, using advanced physics models and Google Gemini reasoning to optimize the daily commute and performance training.

---

## 🚀 Operational Core

### 1. Commute Mode (The Pulse)
The primary dashboard for the daily grinder. It synthesizes complex data into a single **Safety Score (0-100%)**.
*   **Dual-Leg Analysis**: Separate telemetry for "Morning Ride" and "Evening Return" to account for changing atmospheric conditions.
*   **Tactical Vitals**: Real-time monitoring of wind vectors (headwind vs. tailwind), surface saturation, and lighting requirements.
*   **Intelligence Box**: An AI-driven reasoning panel that provides specific advice on riding style, clothing layers, and bike setup based on current telemetry.

### 2. Training Mode (The Golden Window)
Designed for performance-oriented sessions where conditions dictate quality.
*   **Optimal Window Search**: Scans the 24-hour horizon to identify the "Golden Window"—the specific hour where wind, temperature, and daylight align for the highest safety and efficiency score.
*   **Dynamic Loop Planning**: Analyzes wind direction to suggest tactical route headings (e.g., heading out into a headwind to ensure a tailwind return).
*   **Alternative Discovery**: A progressive grid-search engine that scans 15-20 regional cycling hubs to find better weather within a 250km radius if your local conditions are suboptimal.

### 3. The Garage (Mechanical Calibration)
A digital equipment manager that fine-tunes your hardware.
*   **Machine Profiles**: Configure multiple bikes (Road, Gravel, MTB, E-Bike) with specific tire widths and setups (Tubeless, Clincher, etc.).
*   **Pressure Optimization**: A proprietary algorithm calculates the optimal Bar/PSI based on system weight, tire volume, and current surface wetness.

---

## 🧠 The Intelligence Engine ("IQ")

Commute IQ doesn't just display weather; it interprets it through two core background models:

### Traction Recovery Model (Surface Diagnostics)
Instead of a simple "Rain" icon, the system tracks the termination of precipitation events.
*   **Evaporation Simulation**: Accounts for relative humidity, wind speed, and solar radiation to estimate when the road will transition from *Saturated* (>80%) to *Damp* (30-80%) to *Dry* (<30%).
*   **Traction Countdown**: Provides a real-time "Time to Dry" timer based on atmospheric decay rates.

### Thermal Inertia Model (Ice Risk)
Standard weather apps fail to predict black ice. Our model looks at ground history:
*   **Residual Cold Detection**: Monitors surface temperature over a rolling 6-hour window.
*   **Frost Logic**: Triggers alerts when high humidity (>78%) meets near-freezing air temperatures, even if no rain has fallen, accounting for hoar frost crystallization.

---

## 🛠 Technical Architecture

*   **Frontend**: [React 19](https://react.dev/) with TypeScript for a type-safe, ultra-responsive UI.
*   **Intelligence Core**: [Google Gemini 3.0 Flash](https://ai.google.dev/) reasoning engine for tactical interpretation of telemetry.
*   **Atmospheric Data**: [Open-Meteo API](https://open-meteo.com/) (Primary) with [Met.no](https://www.met.no/) (Fallback) for high-resolution, hourly meteorological data.
*   **Geo-Intelligence**: [Nominatim OpenStreetMap](https://nominatim.org/) for European-wide reverse geocoding and municipality resolution.
*   **PWA Stack**: Service Worker-driven offline resiliency, optimized for standalone iOS 18+ and Android experiences.
*   **Visual System**: Tailwind CSS for high-contrast, data-heavy layouts; Lucide React for consistent iconography.

---

## ⚙️ Development & Deployment

1.  **API Keys**: Requires `process.env.API_KEY` for Google Gemini access.
2.  **Telemetry**: Pre-configured to access public weather nodes; no secondary keys required for base data.
3.  **Local Dev**:
    ```bash
    npm install
    npm run dev
    ```

*Built for precision. Driven by Intelligence.*