# Commute IQ | Cycling Intelligence Dashboard

**Commute IQ** is a professional-grade decision support tool for urban cyclists. It synthesizes real-time atmospheric telemetry into actionable transit intelligence, helping commuters optimize their safety and gear strategy.

---

## 🚀 Core Functionalities

*   **Commute Score (The Pulse)**: A weighted safety assessment (0–100%) calculated via AI reasoning that accounts for precipitation, wind intensity, and thermal risk.
*   **Tactical Vitals Grid**:
    *   **Wind Vectors**: Analysis of headwinds vs. tailwinds based on specific route headings.
    *   **Surface Condition**: High-precision detection of wet vs. dry road surfaces.
    *   **Ice Risk Monitoring**: Critical alerts for micro-frost and sub-zero surface dynamics.
    *   **Lumen Requirements**: Automatic detection of darkness windows to mandate lighting.
*   **7-Day Forecast**: A forward-looking outlook allowing for long-term commute planning.
*   **Localized Context**: Full native support for **English, French, and Dutch**, with pre-cached Belgian municipality resolution.
*   **PWA Optimized**: Full standalone support for iOS and Android, ensuring the dashboard is accessible directly from the home screen.

---

## 🛠 Technical Setup

### Stack Architecture
*   **Framework**: [React 19](https://react.dev/) with TypeScript for a high-performance, type-safe UI.
*   **Intelligence Engine**: [Google Gemini 3 Flash](https://ai.google.dev/) (LLM) for grounding weather data into human-centric safety advice.
*   **Telemetry Data**: [Open-Meteo API](https://open-meteo.com/) for hyper-local, high-resolution weather forecasting.
*   **Visual Design**: [Tailwind CSS](https://tailwindcss.com/) and [Lucide React](https://lucide.dev/) for a responsive, high-contrast interface.
*   **Build System**: [Vite](https://vitejs.dev/) for ultra-fast HMR and optimized production bundles.

### PWA & Performance
*   **Manifest**: Standalone display mode with maskable icons for Android and meta-tag parity for iOS.
*   **Offline Resiliency**: Implemented dummy-data fallback logic to maintain UX during API rate-limiting or network disruptions.
*   **Client-Side Security**: All settings and location data are persisted strictly in `localStorage`.

---

## ⚙️ Development Config

1.  **Environment**: Ensure `process.env.API_KEY` is set with a valid Google Gemini key.
2.  **Dependencies**: Install via `npm install`.
3.  **Local Execution**: Start the dev server with `npm run dev`.

*Built for precision. Driven by Intelligence.*