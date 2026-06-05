# Aurafield v12 — The Living Procedural Universe

A high-performance, audio-reactive 3D engine built on WebGL, showcasing advanced procedural asset generation, real-time audio signal tracking, and automated deployment architectures. Aurafield renders dynamic macro-environments and particle systems that morph dynamically to audio signals.

 **[Experience the Live Simulation Here](https://thevindu-ctrl.github.io/Aurafieldv15/)**

---

## Tech Stack & Core Engine Infrastructure

This platform transitions traditional heavy 3D rendering pipelines into fluid, browser-native experiences by leveraging modern frontend graphics systems:

* **Graphics Engine:** Three.js via `@react-three/fiber` (R3F) for reactive component-driven 3D scene graphs.
* **Component Toolkit:** `@react-three/drei` for optimized asset loading configurations, camera controllers, and billboarded UI rendering.
* **Build System:** Vite — configured for high-speed module replacement and production asset minification.
* **Automation:** GitHub Actions (`deploy.yml`) custom runner pipeline translating local code changes into live cloud deployments seamlessly.

---

## Core Engineering Features

### 1. Procedural Engine Core
Instead of relying purely on static environments, the engine uses custom mathematical noise configurations and particle arrays to generate celestial structures, planet surfaces (like the Volcanic and Bloom variants), and living AI particle swarms in real time.

### 2. Audio Signal Processing & Tracking
Features integrated audio analytics calculating frequency distributions and asset scaling:
* **BPM & Mood Analysis:** Translates amplitude spikes into real-time visual modifications.
* **Frequency Mapping:** Isolates bass, mid-tones, and high frequencies to govern particle speed, global illumination brightness, and shader distortion vectors dynamically.

### 3. CI/CD Architecture
Automated via a custom GitHub Actions pipeline. Due to heavy high-fidelity texture maps and `.hdr` environment maps (~176 MB total footprint), the pipeline optimizes and packages asset bundles into a static production build deployed directly to GitHub Pages runners.

---

## Navigation & System Controls

| Input / Control | Action Performed |
| :--- | :--- |
| **W / S / A / D** | Forward / Backward / Left / Right Translation |
| **Mouse / Trackpad Movement** | Look Orientation / Camera Aim Control |
| **Audio Source Input** | Drives global physics constants, lighting shifts, and particle velocities |

### Mobile & Touchscreen Accessibility Note
> ⚠️ **Desktop Optimization Recommended:** Because the movement vectors are currently bound to physical hardware keyboard hooks (`WASD`), exploration is optimized for desktop browsers. 
> 
> * **iOS / Android Experience:** Touch interfaces currently support camera rotation and viewing orientation via swipe controls.
> * **Next-Gen Patch Plan:** Implementation of virtual dual-stick on-screen overlay controllers (`nipplejs` integration) to bring full translation capabilities to mobile touch surfaces is currently slated for the next development sprint.(Aurafieldv15)

---

## Local Development Setup

To run this engine locally on your machine for testing or expansion:

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Thevindu-ctrl/Aurafieldv15.git](https://github.com/Thevindu-ctrl/Aurafieldv15.git)
   cd Aurafieldv15