# Commute IQ | Advanced Cycling Intelligence 🚲

**Commute IQ** is a high-fidelity decision support system designed for the modern urban cyclist. It moves beyond standard weather forecasting by transforming raw atmospheric telemetry into a proprietary "Safety Pulse"—a weighted risk assessment that optimizes transit windows for safety, efficiency, and gear selection.

---

## 🎯 Executive Summary

The platform serves as an operational dashboard for the daily commuter. By integrating real-time weather data with Large Language Model (LLM) reasoning, Commute IQ identifies non-obvious hazards—such as micro-frost risks, headwind-induced exhaustion, and low-visibility windows—allowing riders to make data-driven decisions before they leave the door.

---

## 🧠 The "Pulse" Methodology

Unlike generic weather apps, Commute IQ calculates a **Safety Score (0-100%)** using a specialized weighting algorithm processed by **Google Gemini 3 Flash**:

*   **Ice & Thermal Dynamics (50%)**: Aggressive down-weighting for freezing point intersections and micro-frost alerts.
*   **Surface Integrity (30%)**: Calculation of "slippery chance" based on precipitation intensity and duration.
*   **Kinetic Effort (15%)**: Wind vector analysis to estimate physical exertion and battery drain (for e-bikes).
*   **Visibility & Lumens (5%)**: Solar cycles are computed to provide mandatory lighting requirements.

> **Safety Protocol**: If the AI detects a critical Ice Risk, the platform enforces a maximum safety ceiling of 30%, regardless of other favorable conditions.

---

## 🛠 Functional Pillars

### 1. Environmental Intelligence
*   **Micro-Forecasts**: Hourly precision mapping for the specific windows of your morning and evening commute.
*   **Tactical Surface Analysis**: Real-time feedback on road conditions (Wet, Dry, or Icy) with technical riding advice.
*   **Vector-Based Wind Analysis**: Directional wind data optimized for your specific route heading to detect tailwinds vs. headwinds.

### 2. Tactical Gear Strategy
*   **Multi-Layer Logic**: Clothing recommendations derived from wind chill, humidity, and precipitation thresholds.
*   **Safety Gear Compliance**: Automatic detection of lighting requirements based on transit-hour darkness.

### 3. Localization & Personalization
*   **Multi-Language Architecture**: Native support for **English, French, and Dutch (NL)**.
*   **Dual-Theme Interface**: A high-contrast **Daylight** mode for outdoor visibility and a premium **Obsidian** mode for low-light planning.
*   **European Hub Optimization**: Pre-cached resolution for Belgian cities and municipalities to ensure zero-latency address validation.

---

## 🏗 Technical Architecture

*   **Logic Layer**: [React 19](https://react.dev/) with TypeScript for type-safe state management.
*   **Intelligence Engine**: [Google Gemini API](https://ai.google.dev/) using the `@google/genai` SDK for grounded reasoning.
*   **Telemetry Provider**: [Open-Meteo](https://open-meteo.com/) for high-resolution, open-source weather data.
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) for a responsive, high-performance UI.
*   **Iconography**: [Lucide React](https://lucide.dev/) for precise, minimalist visual cues.

---

## ⚙️ Operational Setup

### Prerequisites
*   A browser environment supporting ES6 Modules.
*   A valid Google Gemini `API_KEY` configured in the execution environment.

### Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/commute-iq.git

# Install dependencies
npm install

# Launch development environment
npm run dev
```

---

## 📐 Philosophy

Commute IQ is built on the principles of **Lean Digital** development:
*   **Zero-Waste Performance**: Minimalist bundle size with no redundant dependencies.
*   **Privacy First**: Location data and settings are persisted locally in-browser; no external tracking or user profiling.
*   **Resiliency**: Robust error handling for third-party API disruptions with graceful fallback states.

---
*Developed for the discerning commuter. Driven by Intelligence.*