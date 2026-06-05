/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  AURAFIELD V12 — THE LIVING UNIVERSE (CRASH-PROOFED & RESTORED)      ║
 * ║  Fixed Suspense Font Crash • Restored Ecosystems • Living AI Swarms  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  npm install three @react-three/fiber @react-three/drei              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// § 1  CONSTANTS & GLOBAL STATE
// ─────────────────────────────────────────────────────────────────────────────
const FFT = 2048;
const FONT = "'Orbitron','Share Tech Mono',monospace";

let G = 0.0004; 

const WORLDS = {
  void:  { name: "VOID",  color: "#00ccff", accent: "#9966ff", fog: 0.0005, desc: "The Shattered Hub",             bgHex: 0x000005, hasLiquid: false },
  bloom: { name: "BLOOM", color: "#00ffcc", accent: "#7700ff", fog: 0.0010, desc: "Bioluminescent Paradise",       bgHex: 0x000208, hasLiquid: true,  liqColor: "#0044ff" },
  flame: { name: "FLAME", color: "#ff6600", accent: "#ffaa00", fog: 0.0015, desc: "Volcanic Star Forge",           bgHex: 0x060000, hasLiquid: true,  liqColor: "#ff2200" },
  wilt:  { name: "WILT",  color: "#cc2200", accent: "#ff4400", fog: 0.0020, desc: "Abandoned Megastructures",      bgHex: 0x080000, hasLiquid: false },
  root:  { name: "ROOT",  color: "#00ff88", accent: "#00ccaa", fog: 0.0012, desc: "Cosmic Neural Forest",          bgHex: 0x000800, hasLiquid: true,  liqColor: "#00ff44" },
};

const PORTAL_CONFIGS = [
  { id: "bloom", angle: 0,                 dist: 600, y: 50 },
  { id: "flame", angle: Math.PI * 0.5,     dist: 600, y: 100 },
  { id: "wilt",  angle: Math.PI * 1.0,     dist: 600, y: 0 },
  { id: "root",  angle: Math.PI * 1.5,     dist: 600, y: 50 },
];

const engineState = { 
  worldStartTime: 0, 
  loopCount: 0, 
  distortPhase: 0, 
  orbsCollected: 0, 
  comboMultiplier: 1, 
  pingTime: -100 
};

function getTerrainHeight(x, z) {
  const h1 = Math.sin(x * 0.002) * Math.cos(z * 0.002) * 150;
  const h2 = Math.sin(x * 0.0008 + z * 0.001) * 200;
  const h3 = Math.cos(x * 0.01 - z * 0.005) * 40;
  return h1 + h2 + h3 - 80; 
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2  PHYSICS & AI ENGINES
// ─────────────────────────────────────────────────────────────────────────────
class OrbitalBody {
  constructor(x, y, z, vx, vy, vz, mass, radius) {
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3(vx, vy, vz);
    this.acc = new THREE.Vector3();
    this.mass = mass; 
    this.radius = radius;
  }
  applyGravity(bodies, baseG) {
    this.acc.set(0, 0, 0);
    bodies.forEach(b => {
      if (b === this) return;
      const d = b.pos.clone().sub(this.pos);
      const r = Math.max(d.length(), b.radius + this.radius);
      const f = baseG * this.mass * b.mass / (r * r);
      this.acc.add(d.normalize().multiplyScalar(f / this.mass));
    });
  }
  integrate(dt) {
    this.vel.addScaledVector(this.acc, dt);
    this.vel.clampLength(0, 0.8); 
    this.pos.addScaledVector(this.vel, dt);
  }
}

class BPMDetector {
  constructor() { 
    this.hist = []; 
    this.lastBeat = 0; 
    this.intervals = []; 
    this.bpm = 0; 
    this.display = "--"; 
  }
  update(kick) {
    this.hist.push(kick); 
    if(this.hist.length > 120) this.hist.shift();
    let avg = 0; let v = 0; const len = this.hist.length;
    for(let i = 0; i < len; i++) avg += this.hist[i]; avg /= len;
    for(let i = 0; i < len; i++) v += (this.hist[i] - avg) ** 2; v /= len;
    const thr = avg + 1.35 * Math.sqrt(v);
    const now = performance.now();
    if(kick <= thr || kick <= 0.07 || now - this.lastBeat < 260) return false;
    if(this.lastBeat > 0) {
      const iv = now - this.lastBeat;
      if(iv > 260 && iv < 2200) {
        this.intervals.push(iv);
        if(this.intervals.length > 20) this.intervals.shift();
      }
    }
    this.lastBeat = now;
    if(this.intervals.length >= 6) {
      const s = [...this.intervals].sort((a, b) => a - b);
      const med = s[Math.floor(s.length / 2)];
      let r = 60000 / med;
      while(r < 60) r *= 2;
      while(r > 200) r /= 2;
      this.bpm = this.bpm === 0 ? Math.round(r) : Math.round(this.bpm * 0.84 + r * 0.16);
      this.display = this.bpm;
    }
    return true;
  }
}

class EmotionEngine {
  constructor() {
    this.val = 0.5; this.ar = 0.5; this.dark = 0.3;
    this.mood = "void"; this.genre = "STABLE";
    this.prev = new Uint8Array(FFT / 2);
  }
  update(bass, mid, treble, energy, sub, buf) {
    const exB = Math.pow(bass * 1.6, 2.2);
    const exM = Math.pow(mid * 1.5, 2.0);
    const exT = Math.pow(treble * 1.5, 1.8);
    const exS = Math.pow(sub * 1.7, 2.5);
    let flux = 0; let sum = 0; let centroid = 0; 
    
    if(buf) {
      for(let i = 0; i < buf.length; i++) {
        const d = (buf[i] - this.prev[i]) / 255; 
        if(d > 0) flux += d * d;
        centroid += i * buf[i]; sum += buf[i];
      }
      flux = Math.min(1, Math.sqrt(flux / buf.length) * 7); 
      this.prev.set(buf);
    }
    
    centroid = sum === 0 ? 0 : centroid / sum;
    const dissonance = Math.min(1, (flux * 0.6) + (exS * 0.4) + (Math.abs(exM - exB) * 0.3));
    
    const a = 0.016;
    this.val += (Math.min(1, Math.max(0, exM * 0.6 - exB * 0.25 + exT * 0.3)) - this.val) * a;
    this.ar += (Math.min(1, energy * 0.7 + exT * 0.4 + flux * 0.4) - this.ar) * a;
    this.dark += (Math.min(1, exS * 0.7 + exB * 0.45 - exM * 0.3) - this.dark) * a;
    
    if(this.dark > 0.55 && this.ar > 0.5 && this.val < 0.4) this.mood = "wilt";
    else if(this.val > 0.6 && this.ar > 0.65) this.mood = "bloom";
    else if(this.ar > 0.7 && this.dark > 0.3) this.mood = "flame";
    else if(this.val > 0.5 && this.ar < 0.42) this.mood = "root";
    else this.mood = "void";

    if(centroid < 10 && flux < 0.2) this.genre = "AMBIENT";
    else if(dissonance > 0.7 && this.dark > 0.6) this.genre = "INDUSTRIAL";
    else if(this.ar > 0.7 && centroid > 20) this.genre = "TRANCE";
    else if(dissonance > 0.5) this.genre = "COMPLEX";
    else this.genre = "CONSONANT";

    return { mood: this.mood, hue: this.val * 260 + this.dark * 80, energy, bass, mid, treble, dissonance, flux, genre: this.genre };
  }
}

class AudioWrap {
  constructor() {
    this.ctx = null; this.an = null; this.src = null;
    this.cache = new Map(); this.fb = null; this.tb = null;
  }
  _boot() {
    if(!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.an = this.ctx.createAnalyser();
      this.an.fftSize = FFT; this.an.smoothingTimeConstant = 0.85; 
      this.fb = new Uint8Array(this.an.frequencyBinCount); this.tb = new Uint8Array(FFT);
      this.an.connect(this.ctx.destination);
    }
    if(this.ctx.state === "suspended") this.ctx.resume();
  }
  async mic() {
    this._boot();
    if(this.src) { try { this.src.disconnect(); } catch(_) {} }
    const s = await navigator.mediaDevices.getUserMedia({audio: true});
    this.src = this.ctx.createMediaStreamSource(s); this.src.connect(this.an);
  }
  file(el) {
    this._boot();
    if(this.src) { try { this.src.disconnect(); } catch(_) {} }
    if(!this.cache.has(el)) {
      if(!el.src.startsWith("blob:")) el.crossOrigin = "anonymous";
      this.cache.set(el, this.ctx.createMediaElementSource(el));
    }
    this.src = this.cache.get(el); this.src.connect(this.an); 
    el.play().catch(() => {});
  }
  freq() { if(!this.an) return null; this.an.getByteFrequencyData(this.fb); return this.fb; }
  time() { if(!this.an) return null; this.an.getByteTimeDomainData(this.tb); return this.tb; }
  band(buf, lo, hi) {
    if(!buf) return 0;
    const bHz = (this.ctx.sampleRate / 2) / buf.length;
    let s = 0; let c = 0;
    for(let i = Math.floor(lo / bHz); i <= Math.min(Math.ceil(hi / bHz), buf.length - 1); i++) { s += buf[i]; c++; }
    return c ? s / c / 255 : 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3  GLSL SHADERS
// ─────────────────────────────────────────────────────────────────────────────

const TERRAIN_V = `
uniform float uT; uniform float uBass; uniform float uDistort; uniform vec3 uCamPos; uniform float uPing;
varying vec2 vUv; varying float vHeight; varying float vDist; varying vec3 vWP;
void main() {
  vUv = uv; vec3 p = position;
  float distToCam = length(p.xz - uCamPos.xz);
  float ripple = sin(distToCam * 0.02 - uT * 5.0) * exp(-distToCam * 0.002) * uBass * 25.0;
  float pingWave = exp(-pow(distToCam - uPing, 2.0) * 0.001) * 40.0;
  p.y += ripple + pingWave;
  p.y += sin(p.x * 0.005 + uT) * cos(p.z * 0.005 + uT) * uDistort * 100.0;
  vHeight = p.y;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vWP = (modelMatrix * vec4(p, 1.0)).xyz;
  vDist = length(mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}`;

const TERRAIN_F = `
uniform vec3 uColor1; uniform vec3 uColor2; uniform float uFog; uniform float uPing; uniform vec3 uCamPos;
varying vec2 vUv; varying float vHeight; varying float vDist; varying vec3 vWP;
void main() {
  float hMix = clamp((vHeight + 100.0) / 300.0, 0.0, 1.0);
  vec3 texColor = mix(uColor1, uColor2, hMix);
  float distToCam = length(vWP.xz - uCamPos.xz);
  float pingGlow = exp(-pow(distToCam - uPing, 2.0) * 0.005);
  texColor += vec3(0.0, 1.0, 0.8) * pingGlow * 2.0;
  float grid = max(step(0.98, fract(vUv.x * 400.0)), step(0.98, fract(vUv.y * 400.0)));
  texColor += grid * 0.15;
  float fogFactor = exp2(-uFog * uFog * vDist * vDist * 1.442695);
  gl_FragColor = vec4(mix(texColor, vec3(0.0), clamp(fogFactor, 0.0, 1.0)), 1.0);
}`;

const PORT_V = `
varying vec2 vUv; varying vec3 vWP; 
void main() {
  vUv = uv; vWP = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PORT_F = `
uniform float uT; uniform vec3 uColor; uniform float uHover; uniform float uEnergy; 
varying vec2 vUv;
void main() {
  vec2 c = vUv * 2.0 - 1.0; float r = length(c); if(r > 1.0) discard;
  float ang = atan(c.y, c.x) + uT * (2.0 + uHover * 5.0 + uEnergy * 2.0);
  float spiral = fract(ang / (3.14159 * 2.0) + r * 5.0 - uT * 1.5);
  float ring = abs(sin(r * 20.0 - uT * 5.0)) * exp(-r * 2.0);
  float core = exp(-r * 6.0) * (0.8 + uHover * 0.4);
  vec3 col = uColor * (spiral * 0.5 + ring * 0.8 + core);
  gl_FragColor = vec4(col, (1.0 - r) * (0.8 + uHover));
}`;

const PLANET_V = `
uniform float uT; uniform float uDistort; uniform float uDiss; varying vec2 vUv; varying vec3 vN;
void main() {
  vUv = uv; vN = normalize(normalMatrix * normal); vec3 p = position; 
  float cymatic = sin(p.x * 20.0) * cos(p.y * 20.0) * uDiss * 0.5; 
  p += vN * (uDistort * sin(p.y * 10.0 + uT) * 0.2 + cymatic); 
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const PLANET_F = `
uniform float uT; uniform vec3 uC1; uniform vec3 uC2; uniform float uE;
varying vec2 vUv; varying vec3 vN;
float noise(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float b = noise(vec2(vUv.y * 10.0 + uT * 0.1, vUv.x * 2.0));
  vec3 col = mix(uC1, uC2, b);
  col += uC1 * pow(1.0 - abs(dot(normalize(vec3(0, 0, 1)), vN)), 2.0) * 0.5;
  gl_FragColor = vec4(col * (0.5 + uE * 0.5), 1.0);
}`;

const AURORA_V = `
varying vec2 vUv; 
void main() {
  vUv = uv; 
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const AURORA_F = `
uniform float uT; 
uniform vec3 uColor; 
uniform float uBass; 
uniform float uMid; 
uniform float uTreble;
varying vec2 vUv;

void main() {
  float wB = sin(vUv.x * 5.0 + uT * 1.0) * uBass;
  float wM = cos(vUv.y * 8.0 - uT * 1.5 + wB) * uMid;
  float wT = sin(vUv.x * 15.0 + uT * 3.0) * uTreble;
  float alpha = smoothstep(0.2, 0.8, wM + wT) * sin(vUv.y * 3.14) * 0.6;
  gl_FragColor = vec4(uColor + vec3(wT * 0.5, wM * 0.2, 0.0), alpha);
}`;

const PART_V = `
attribute vec3 aColor; 
attribute float aSize; 
attribute float aPhase; 
attribute float aState;
varying vec3 vCol; 
varying float vGlow; 
varying float vState; 
varying vec2 vUv;
uniform float uT; 
uniform vec3 uCamPos; 
uniform float uProx; 
uniform float uEnergy; 
uniform float uDiss;

void main() {
  vCol = aColor; 
  vState = aState;
  float dist = length(uCamPos - position);
  vGlow = exp(-dist * 0.005) * uProx + uEnergy * 0.3; 
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float size = aSize * (1.0 + sin(uT * 2.0 + aPhase) * 0.5);
  if(vState > 0.5) size *= 3.0;
  gl_PointSize = (size + vGlow * 10.0) * (400.0 / max(0.1, -mv.z)); 
  gl_Position = projectionMatrix * mv;
}`;

const PART_F = `
varying vec3 vCol; 
varying float vGlow; 
varying float vState; 
uniform float uDiss;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0; 
  float r = dot(uv, uv); 
  if(r > 1.0) discard;
  
  float core = exp(-r * 4.0); 
  float halo = exp(-r * 1.5) * 0.2;
  vec3 finalCol = vCol;
  
  if(uDiss > 0.6 && r > 0.5) { 
    finalCol.r *= 1.5; 
    finalCol.b *= 0.5; 
  }
  
  float alpha = (core + halo) * (0.6 + vGlow); 
  if (vState > 0.5) { 
    gl_FragColor = vec4(finalCol * 2.0, alpha * 2.0); 
  } else { 
    gl_FragColor = vec4(finalCol, alpha); 
  }
}`;

// ─────────────────────────────────────────────────────────────────────────────
// § 4  COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function MassiveTerrain({ worldKey, adRef }) {
  const pal = WORLDS[worldKey];
  
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(25000, 25000, 400, 400); 
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, getTerrainHeight(pos.getX(i), pos.getZ(i)));
    }
    g.computeVertexNormals();
    return g;
  }, []);

  const isVoid = worldKey === "void";

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: TERRAIN_V, fragmentShader: TERRAIN_F,
    uniforms: {
      uT: { value: 0 }, uBass: { value: 0 }, uDistort: { value: 0 }, uPing: { value: -100 },
      uCamPos: { value: new THREE.Vector3() },
      uColor1: { value: new THREE.Color(pal.bgHex).lerp(new THREE.Color(pal.color), 0.2) },
      uColor2: { value: new THREE.Color(pal.accent).multiplyScalar(isVoid ? 0.8 : 0.4) },
      uFog: { value: pal.fog * 0.1 } 
    },
    wireframe: isVoid, 
    transparent: isVoid,
    opacity: isVoid ? 0.3 : 1.0
  }), [pal, isVoid]);

  useFrame(({ clock, camera }) => {
    if (mat.uniforms && adRef.current) {
      mat.uniforms.uT.value = clock.getElapsedTime();
      mat.uniforms.uBass.value = adRef.current.bass;
      mat.uniforms.uDistort.value = engineState.distortPhase;
      mat.uniforms.uCamPos.value.copy(camera.position);
      
      if (engineState.pingTime > 0) {
        const timeSincePing = clock.getElapsedTime() - engineState.pingTime;
        mat.uniforms.uPing.value = timeSincePing * 800.0; 
        if (timeSincePing > 10) engineState.pingTime = -100; 
      } else {
        mat.uniforms.uPing.value = -100;
      }
    }
  });

  return <mesh geometry={geo} material={mat} />;
}

function LivingSwarm({ count, adRef, emoRef }) {
  const meshRef = useRef();
  
  const { geo, mat } = useMemo(() => {
    const g = new THREE.ConeGeometry(3, 15, 4);
    g.rotateX(Math.PI / 2); 
    const m = new THREE.MeshStandardMaterial({ 
      color: "#ffffff", emissive: "#00ccff", emissiveIntensity: 1.0, wireframe: true 
    });
    
    const matrix = new Float32Array(count * 16);
    const colors = new Float32Array(count * 3);
    const dummy = new THREE.Object3D();
    
    for (let i = 0; i < count; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 8000, 
        500 + Math.random() * 2000, 
        (Math.random() - 0.5) * 8000
      );
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      const s = 0.5 + Math.random() * 1.5;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      dummy.matrix.toArray(matrix, i * 16);
      
      colors[i*3] = 1; colors[i*3+1] = 1; colors[i*3+2] = 1;
    }
    
    g.setAttribute('instanceMatrix', new THREE.InstancedBufferAttribute(matrix, 16));
    g.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
    return { geo: g, mat: m };
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current || !adRef.current) return;
    
    const t = clock.getElapsedTime();
    const ad = adRef.current;
    const sp = emoRef.current;
    
    const speed = 2.0 + ad.energy * 5.0;
    const hue = ((sp.hue || 200) % 360) / 360;
    
    mat.emissive.setHSL(hue, 1.0, 0.5);
    mat.emissiveIntensity = 0.5 + ad.bass * 2.0;

    for (let i = 0; i < count; i++) {
      meshRef.current.getMatrixAt(i, dummy.matrix);
      dummy.position.setFromMatrixPosition(dummy.matrix);
      dummy.quaternion.setFromRotationMatrix(dummy.matrix);
      
      const swimX = Math.sin(t * 2.0 + i) * 2.0;
      const swimY = Math.cos(t * 1.5 + i) * 1.5;
      
      dummy.translateZ(speed);
      dummy.position.x += swimX;
      dummy.position.y += swimY;

      dummy.rotateY(Math.sin(t * 0.1 + i) * 0.02);
      dummy.rotateX(Math.cos(t * 0.1 + i) * 0.01);

      const br = 6000;
      if (Math.abs(dummy.position.x) > br) dummy.position.x = -Math.sign(dummy.position.x) * br;
      if (dummy.position.y > 4000) dummy.position.y = 500;
      if (dummy.position.y < 200) dummy.position.y = 3000;
      if (Math.abs(dummy.position.z) > br) dummy.position.z = -Math.sign(dummy.position.z) * br;

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geo, mat, count]} frustumCulled={false} />;
}

function Portal({ worldId, position, color, onEnter, adRef }) {
  const ref = useRef(); 
  const outerRef = useRef();
  const hover = useRef(0);
  const triggered = useRef(false);
  const { camera } = useThree();
  
  const mat = useMemo(() => new THREE.ShaderMaterial({ 
    vertexShader: PORT_V, fragmentShader: PORT_F, 
    uniforms: { 
      uT: { value: 0 }, uColor: { value: new THREE.Color(color) }, 
      uHover: { value: 0 }, uEnergy: { value: 0 } 
    }, 
    transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false 
  }), [color]);
  
  useFrame(({ clock }) => { 
    const t = clock.getElapsedTime(); 
    const ad = adRef.current; 
    
    const portalPos = new THREE.Vector3(position[0], position[1], position[2]);
    const distToCam = camera.position.distanceTo(portalPos);
    
    const isHovered = distToCam < 400; 
    
    if (distToCam < 100 && !triggered.current) {
      triggered.current = true;
      onEnter(worldId);
      setTimeout(() => { triggered.current = false; }, 5000);
    }

    hover.current += (isHovered ? 1 : -1) * 0.05; 
    hover.current = Math.max(0, Math.min(1, hover.current)); 
    
    if (mat.uniforms) { 
      mat.uniforms.uT.value = t; 
      mat.uniforms.uHover.value = hover.current; 
      mat.uniforms.uEnergy.value = ad?.energy || 0; 
    } 
    
    if (ref.current) { 
      ref.current.scale.setScalar(1 + hover.current * 0.5 + (ad?.bass || 0) * 0.3); 
      ref.current.rotation.z = t * 0.5; 
    }

    if (outerRef.current) {
      outerRef.current.rotation.x = t * 0.2;
      outerRef.current.rotation.y = t * 0.3;
      const pulse = 1.0 + (ad?.kick || 0) * 0.5;
      outerRef.current.scale.setScalar(pulse);
    }
  });

  const OuterGeometry = () => {
    switch (worldId) {
      case "bloom": return <torusKnotGeometry args={[35, 3, 100, 16]} />;
      case "flame": return <icosahedronGeometry args={[40, 1]} />;
      case "wilt": return <boxGeometry args={[45, 45, 45]} />;
      case "root": return <torusGeometry args={[40, 5, 16, 100]} />;
      default: return <sphereGeometry args={[40, 16, 16]} />;
    }
  };
  
  return (
    <group position={position}>
      <mesh ref={ref}>
        <circleGeometry args={[25, 64]} />
        <primitive object={mat} attach="material" />
      </mesh>

      <mesh ref={outerRef}>
        <OuterGeometry />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.3} blending={THREE.AdditiveBlending} />
      </mesh>
      
      <mesh position={[0, 800, 0]}>
        <cylinderGeometry args={[15, 15, 1600, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <Billboard position={[0, -50, 0]}>
        {/* Fixed: Removed the font string to prevent Suspense crashes */}
        <Text fontSize={12} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.5} outlineColor={color}>
          ENTER {worldId.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
}

function OrbitalPlanets({ adRef, emoRef, worldKey, scale = 1, fwdRef }) {
  const bodies = useRef([]); 
  const pal = WORLDS[worldKey] || WORLDS.void;
  
  const planetDefs = useMemo(() => {
    return [
      { c1: pal.color, c2: pal.accent, mass: 800, r: 350 * scale, sz: 60.0, hasRing: true },
      { c1: pal.accent, c2: pal.color, mass: 400, r: 600 * scale, sz: 35.0, hasRing: false },
      { c1: "#aaaaaa", c2: "#555555", mass: 200, r: 850 * scale, sz: 20.0, hasRing: false },
      { c1: pal.color, c2: "#222222", mass: 600, r: 1100 * scale, sz: 50.0, hasRing: true },
      { c1: "#ffffff", c2: pal.accent, mass: 150, r: 1400 * scale, sz: 12.0, hasRing: false },
    ].slice(0, worldKey === "void" ? 5 : 3);
  }, [worldKey, pal.color, pal.accent, scale]);

  useEffect(() => {
    const central_mass = worldKey === "void" ? 8000 : 3000; 
    bodies.current = planetDefs.map(d => {
      const angle = Math.random() * Math.PI * 2;
      const vcirc = Math.sqrt(G * central_mass / d.r); 
      return new OrbitalBody(
        Math.cos(angle) * d.r, 0, Math.sin(angle) * d.r, 
        -Math.sin(angle) * vcirc, 0, Math.cos(angle) * vcirc, 
        d.mass, d.sz * 0.5
      );
    });
  }, [planetDefs, worldKey]);

  const matRefs = useRef([]);
  const shellRefs = useRef([]); 
  
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime(); 
    const ad = adRef.current;
    
    const timeMult = 1.0 + (ad?.energy || 0) * 1.5;
    const centralBody = new OrbitalBody(0, 0, 0, 0, 0, 0, worldKey === "void" ? 8000 : 3000, 2);
    const allBodies = [centralBody, ...bodies.current];
    
    G = 0.0004 + (ad?.energy || 0) * 0.0004;

    bodies.current.forEach(b => b.applyGravity(allBodies, G)); 
    bodies.current.forEach(b => b.integrate(Math.min(dt * 60, 2) * timeMult));
    
    fwdRef.current?.children.forEach((group, i) => {
      const body = bodies.current[i]; 
      if (!body) return;
      
      group.position.x = body.pos.x; 
      group.position.y = body.pos.y * 0.2 + 300; 
      group.position.z = body.pos.z;
      
      const mesh = group.children[0];
      if(mesh) {
        mesh.rotation.y += 0.002 * timeMult; 
        let size = planetDefs[i].sz;
        if (engineState.loopCount >= 3) size *= 1.0 + Math.sin(t * 2.0) * 0.2; 
        mesh.scale.setScalar(size * (1 + (ad?.bass || 0) * 0.1));
      }

      const shell = shellRefs.current[i];
      if(shell) {
        shell.rotation.x += 0.005;
        shell.rotation.y -= 0.003;
        const shellSize = planetDefs[i].sz * (1.1 + (ad?.treble || 0) * 0.3 + (ad?.mid || 0) * 0.2);
        shell.scale.setScalar(shellSize);
        shell.material.opacity = 0.1 + (ad?.energy || 0) * 0.5;
      }
    });
    
    matRefs.current.forEach((m) => { 
      if (!m?.uniforms) return; 
      m.uniforms.uT.value = t; 
      m.uniforms.uE.value = ad?.energy || 0; 
      m.uniforms.uDistort.value = engineState.distortPhase; 
      m.uniforms.uDiss.value = emoRef.current?.dissonance || 0; 
    });
  });

  const mats = useMemo(() => planetDefs.map((d) => new THREE.ShaderMaterial({
    vertexShader: PLANET_V, fragmentShader: PLANET_F,
    uniforms: { uT: { value: 0 }, uDistort: { value: 0 }, uDiss: { value: 0 }, uC1: { value: new THREE.Color(d.c1) }, uC2: { value: new THREE.Color(d.c2) }, uE: { value: 0 } }
  })), [planetDefs]);

  return (
    <group ref={fwdRef}>
      {planetDefs.map((d, i) => (
        <group key={i}>
          <mesh>
            <sphereGeometry args={[1, 64, 64]} />
            <primitive object={mats[i]} ref={el => matRefs.current[i] = el} attach="material" />
          </mesh>
          <mesh ref={el => shellRefs.current[i] = el}>
            <icosahedronGeometry args={[1, 4]} />
            <meshBasicMaterial color={d.c1} wireframe transparent opacity={0.2} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BlackHoleCenter({ adRef, emoRef }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#000000" }), []);
  
  return (
    <group position={[0, 100, 0]}>
      <mesh material={mat}>
        <sphereGeometry args={[80, 64, 64]} />
      </mesh>
      {[120, 150, 180].map((radius, i) => (
        <AccretionRing key={i} radius={radius} index={i} adRef={adRef} emoRef={emoRef} />
      ))}
    </group>
  );
}

function AccretionRing({ radius, index, adRef, emoRef }) {
  const ref = useRef();
  
  useFrame(({ clock }) => {
    if(!ref.current || !adRef.current) return;
    const t = clock.getElapsedTime();
    const ad = adRef.current;
    
    ref.current.rotation.z += 0.01 + (emoRef.current?.flux || 0) * 0.1 * (index + 1);
    const scale = 1.0 + ad.bass * 0.2 * (3 - index);
    ref.current.scale.setScalar(scale);
    ref.current.material.emissiveIntensity = 1.0 + ad.energy * 3.0;
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2.3, 0.2, 0]}>
      <torusGeometry args={[radius, 2 + index, 4, 120]} />
      <meshStandardMaterial 
        color="#0066FF" 
        roughness={0.05} metalness={0.95} 
        wireframe transparent opacity={0.4} 
        blending={THREE.AdditiveBlending} 
        emissive="#00ccff" emissiveIntensity={2.5} 
      />
    </mesh>
  );
}

function SceneCore({ adRef, emoRef, worldKey }) {
  const { scene } = useThree(); 
  const lR = useRef([]); 
  const pal = WORLDS[worldKey] || WORLDS.void;
  
  useEffect(() => { 
    scene.fog = new THREE.FogExp2(pal.bgHex, pal.fog); 
  }, [worldKey, scene, pal.bgHex, pal.fog]);

  useFrame(({camera}) => {
    const ad = adRef.current; const sp = emoRef.current;
    if (scene.fog && sp) {
      const altFog = Math.max(0.0001, pal.fog - (camera.position.y * 0.000001));
      scene.fog.density = altFog * (sp.dissonance * 0.5 + 1.0);
    }
    const h = ((sp?.hue || 200) % 360) / 360;
    lR.current.forEach((pl, i) => {
      if (!pl) return;
      pl.intensity = (10.0 + (ad?.energy || 0) * 20) * (sp?.brightness || 1.0);
      pl.color.setHSL((h + i * 0.2) % 1.0, 0.95, 0.55);
    });
  });

  return (
    <>
      <ambientLight color="#020006" intensity={3.0} />
      <hemisphereLight skyColor={pal.color} groundColor={pal.bgHex} intensity={1.5} />
      {[[0, 500, 500], [800, 400, -800], [-800, 200, 500]].map(([x, y, z], i) => (
        <pointLight key={i} ref={el => lR.current[i] = el} position={[x, y, z]} intensity={10.0} distance={3000} color="#0088ff" />
      ))}
    </>
  );
}

function SkyAurora({ color, adRef }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: AURORA_V, fragmentShader: AURORA_F,
    uniforms: { uT:{value:0}, uColor:{value:new THREE.Color(color)}, uBass:{value:0}, uMid:{value:0}, uTreble:{value:0} },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }), [color]);
  
  useFrame(({ clock }) => {
    if (mat.uniforms && adRef.current) {
      mat.uniforms.uT.value = clock.getElapsedTime();
      mat.uniforms.uBass.value = adRef.current.bass;
      mat.uniforms.uMid.value = adRef.current.mid;
      mat.uniforms.uTreble.value = adRef.current.treble;
    }
  });

  return (
    <mesh position={[0, 800, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10000, 10000]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

function EnvironmentScatter({ type, count, adRef }) {
  const meshRef = useRef();
  
  const { geo, mat, positions } = useMemo(() => {
    let g; let m;
    
    if (type === "trees") { 
      g = new THREE.ConeGeometry(5, 40, 5); 
      m = new THREE.MeshStandardMaterial({ color: "#004422", emissive: "#001105" }); 
    } else if (type === "crystals") { 
      g = new THREE.OctahedronGeometry(10, 0); 
      m = new THREE.MeshStandardMaterial({ color: "#330000", emissive: "#550000" }); 
    } else if (type === "ruins") { 
      g = new THREE.BoxGeometry(20, 150, 20); 
      m = new THREE.MeshStandardMaterial({ color: "#111", roughness: 0.9, emissive: "#000" }); 
    }

    const pos = []; 
    const dummy = new THREE.Object3D(); 
    const matrix = new Float32Array(count * 16);
    
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 16000;
      const z = (Math.random() - 0.5) * 16000;
      const y = getTerrainHeight(x, z);
      
      dummy.position.set(x, y + (type === "ruins" ? 70 : 20), z);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.2, 
        Math.random() * Math.PI * 2, 
        (Math.random() - 0.5) * 0.2
      );
      
      const s = 0.8 + Math.random() * 3.5; 
      dummy.scale.set(s, s, s);
      dummy.updateMatrix(); 
      dummy.matrix.toArray(matrix, i * 16);
      pos.push(dummy.position.clone());
    }
    
    g.setAttribute('instanceMatrix', new THREE.InstancedBufferAttribute(matrix, 16));
    return { geo: g, mat: m, positions: pos };
  }, [type, count]);

  useFrame(({ camera }) => {
    if (meshRef.current && adRef.current) {
      let nearest = Infinity;
      
      for(let i = 0; i < Math.min(200, count); i++) { 
        const dist = camera.position.distanceToSquared(positions[i]);
        if (dist < nearest) nearest = dist;
      }
      
      const proxGlow = nearest < 40000 ? 1.0 : 0.0; 
      let beatPulse = 0;
      if (type === "ruins" && adRef.current.beat) beatPulse = 5.0;

      mat.emissiveIntensity = 0.1 + adRef.current.energy * 0.8 + proxGlow + beatPulse;
      if (type === "ruins" && (proxGlow > 0 || beatPulse > 0)) {
        mat.emissive.setHex(0x00aaff); 
      } else if (type === "ruins") {
        mat.emissive.setHex(0x000000);
      }
    }
  });
  
  return <instancedMesh ref={meshRef} args={[geo, mat, count]} frustumCulled={false} />;
}

function AtmosphericParticles({ count, adRef, emoRef, isHub }) {
  const ref = useRef();
  
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3); 
    const col = new Float32Array(count * 3);
    const sizes = new Float32Array(count); 
    const phase = new Float32Array(count);
    const state = new Float32Array(count); 
    const c = new THREE.Color("#ffffff");
    
    for (let i = 0; i < count; i++) {
      const r = 50 + Math.random() * 4000; 
      const theta = Math.random() * Math.PI * 2;
      
      pos[i * 3] = r * Math.cos(theta); 
      pos[i * 3 + 1] = (Math.random() - 0.5) * 500 + 100; 
      pos[i * 3 + 2] = r * Math.sin(theta);
      
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      
      sizes[i] = 4.0 + Math.random() * 8.0; 
      phase[i] = Math.random() * Math.PI * 2; 
      state[i] = 0; 
    }
    
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor",   new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize",    new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aPhase",   new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aState",   new THREE.BufferAttribute(state, 1));
    
    const m = new THREE.ShaderMaterial({
      vertexShader: PART_V, fragmentShader: PART_F,
      uniforms: { 
        uT: { value: 0 }, uCamPos: { value: new THREE.Vector3() }, uProx: { value: 0 }, 
        uEnergy: { value: 0 }, uDiss: { value: 0 } 
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    return { geo: g, mat: m };
  }, [count]);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime(); 
    const ad = adRef.current; 
    const sp = emoRef.current;
    
    const pos = ref.current?.geometry?.attributes?.position; 
    const state = ref.current?.geometry?.attributes?.aState;
    if (!pos || !state) return;

    const dt = 1.0 + (ad?.energy || 0) * 2.0;
    const scatter = sp?.dissonance > 0.6 ? 5.0 : 1.0;
    const windX = Math.sin(t * 0.05) * 2.0 * scatter; 
    const windZ = Math.cos(t * 0.08) * 2.0 * scatter;
    const camPos = camera.position;

    for (let i = 0; i < count; i++) {
      let x = pos.array[i * 3]; let y = pos.array[i * 3 + 1]; let z = pos.array[i * 3 + 2];
      let s = state.array[i];

      if (s === 0) {
        x += windX * dt; y += (Math.cos(t * 0.3 + i) * 0.5) * dt * scatter; z += windZ * dt;

        if (isHub) {
          const distToCenter = Math.sqrt(x * x + z * z);
          if (distToCenter < 500) { x -= (x / distToCenter) * 2.0; z -= (z / distToCenter) * 2.0; } 
        }

        const distToCamSq = camPos.distanceToSquared(new THREE.Vector3(x, y, z));
        if (distToCamSq < 400) {
          state.array[i] = 1; engineState.orbsCollected++;
          if(engineState.orbsCollected % 10 === 0) engineState.comboMultiplier++;
        }

        const br = 6000; 
        if (Math.abs(x) > br) x = -Math.sign(x) * br;
        if (y > 1000) y = -100; if (y < -200) y = 1000;
        if (Math.abs(z) > br) z = -Math.sign(z) * br;

      } else if (s === 1) {
        const angle = t * 3.0 + i;
        x = camPos.x + Math.cos(angle) * 15; y = camPos.y + Math.sin(t * 5.0 + i) * 5 - 5; z = camPos.z + Math.sin(angle) * 15;
        if (Math.random() < 0.005) { state.array[i] = 0; } 
      }
      
      pos.array[i * 3] = x; pos.array[i * 3 + 1] = y; pos.array[i * 3 + 2] = z;
    }
    
    pos.needsUpdate = true; state.needsUpdate = true;

    if (mat.uniforms) {
      mat.uniforms.uT.value = t; 
      mat.uniforms.uCamPos.value.copy(camera.position);
      mat.uniforms.uProx.value = Math.max(0, 1 - camera.position.length() / 800);
      mat.uniforms.uEnergy.value = ad?.energy || 0;
      mat.uniforms.uDiss.value = sp?.dissonance || 0;
      
      const c = new THREE.Color().setHSL(((sp?.hue || 200) % 360) / 360, 1, 0.6);
      const colors = geo.attributes.aColor.array;
      for (let j = 0; j < count * 3; j += 3) {
        colors[j] = c.r; colors[j + 1] = c.g; colors[j + 2] = c.b;
      }
      geo.attributes.aColor.needsUpdate = true;
    }
  });

  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// § FIRST PERSON EXPLORER CAMERA
// ─────────────────────────────────────────────────────────────────────────────
function ExplorerCamera({ isTransitioning, mouseRef, inHub, planetsRef, adRef }) {
  const { camera } = useThree();
  const keys = useRef({w: false, a: false, s: false, d: false, shift: false, space: false});
  const vel = useRef(new THREE.Vector3());
  const targetRotation = useRef(new THREE.Quaternion());

  useEffect(() => {
    const handleKey = (e, isDown) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' '].includes(k)) keys.current[k === " " ? "space" : k] = isDown;
      if (e.shiftKey !== undefined) keys.current.shift = e.shiftKey;
      if (e.key === 'e' && isDown) engineState.pingTime = performance.now() / 1000;
    };
    
    const down = (e) => handleKey(e, true); 
    const up = (e) => handleKey(e, false);
    
    window.addEventListener('keydown', down); 
    window.addEventListener('keyup', up);
    
    return () => { 
      window.removeEventListener('keydown', down); 
      window.removeEventListener('keyup', up); 
    };
  }, []);

  useFrame(() => {
    if (isTransitioning) return;
    
    const m = mouseRef.current;
    
    let yaw = -m.x * Math.PI; 
    let pitch = m.y * Math.PI * 0.5;

    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    targetRotation.current.setFromEuler(euler);
    camera.quaternion.slerp(targetRotation.current, 0.08);

    const baseSpeed = 4.0; 
    const speed = keys.current.shift ? baseSpeed * 10.0 : baseSpeed; 
    
    camera.fov += ((keys.current.shift ? 100 : 60) - camera.fov) * 0.05;
    camera.updateProjectionMatrix();

    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();

    if (keys.current.w) vel.current.add(direction.clone().multiplyScalar(speed));
    if (keys.current.s) vel.current.add(direction.clone().multiplyScalar(-speed));
    if (keys.current.a) vel.current.add(right.clone().multiplyScalar(-speed));
    if (keys.current.d) vel.current.add(right.clone().multiplyScalar(speed));
    if (keys.current.space) vel.current.y += speed * 1.5; 

    if (planetsRef?.current) {
      planetsRef.current.children.forEach(p => {
        if(p.type === "Group") { 
           const pWorld = new THREE.Vector3(); 
           p.getWorldPosition(pWorld);
           const distSq = camera.position.distanceToSquared(pWorld);
           if (distSq < 250000) { 
             const pull = pWorld.clone().sub(camera.position).normalize().multiplyScalar(3000 / distSq);
             vel.current.add(pull);
           }
        }
      });
    }

    vel.current.multiplyScalar(0.95); 
    camera.position.add(vel.current);

    if (adRef.current?.sub > 0.8) {
      camera.position.x += (Math.random() - 0.5) * 2.5;
      camera.position.y += (Math.random() - 0.5) * 2.5;
    }

    if (!inHub) {
       const groundY = getTerrainHeight(camera.position.x, camera.position.z);
       const hoverHeight = 60.0; 
       if (camera.position.y < groundY + hoverHeight) {
         camera.position.y += (groundY + hoverHeight - camera.position.y) * 0.15;
       }
       if(camera.position.length() > 20000) {
         camera.position.lerp(new THREE.Vector3(0, camera.position.y, 0), 0.02); 
       }
    } else {
       if(camera.position.length() > 4000) {
         camera.position.lerp(new THREE.Vector3(0, 0, 0), 0.02); 
       }
    }
  });
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// § MAIN APP & UI
// ─────────────────────────────────────────────────────────────────────────────
export default function AuraFieldV12() {
  const adRef = useRef({ kick: 0, bass: 0, mid: 0, treble: 0, sub: 0, energy: 0, beat: false, freqData: null, timeData: null, hue: 200 });
  const emoRef = useRef({ mood: "void", hue: 200, spd: 0.5, energy: 0, bass: 0, mid: 0, treble: 0, dissonance: 0, genre: "STABLE", flux: 0 });
  
  const awRef = useRef(new AudioWrap());
  const bpmRef = useRef(new BPMDetector());
  const engRef = useRef(new EmotionEngine());
  const mouseRef = useRef({ x: 0, y: 0 });
  const planetsRef = useRef(); 
  const adLoopRef = useRef(null);
  const uiRef = useRef(0);

  const [world, setWorld] = useState("void");
  const [transPhase, setTransPhase] = useState("none"); 
  const [hudVisible, setHudVisible] = useState(true);
  const [introState, setIntroState] = useState("ready"); 
  const [phase, setPhase] = useState("idle"); 
  const [playlist, setPlaylist] = useState([]);
  const [trackIdx, setTrackIdx] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [stats, setStats] = useState({ bpm: "--", mood: "void", bass: 0, mid: 0, treble: 0, fps: 60, ai_genre: "STABLE", loops: 0, combo: 1, diss: 0 });
  const [showEntryText, setShowEntryText] = useState(false);

  const isTransitioning = transPhase !== "none";
  const pal = WORLDS[world] || WORLDS.void;
  const isInWorld = world !== "void" && introState === "done";

  useEffect(() => {
    const handleMouseMove = (e) => { 
      mouseRef.current = { 
        x: (e.clientX / window.innerWidth) * 2 - 1, 
        y: -(e.clientY / window.innerHeight) * 2 + 1 
      }; 
    };
    window.addEventListener("mousemove", handleMouseMove); 
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    
    let lastT = performance.now();
    let frames = 0;
    let fpsAcc = 0;
    
    const tick = () => {
      adLoopRef.current = requestAnimationFrame(tick);
      
      const now = performance.now();
      const dt = (now - lastT) / 1000; 
      lastT = now;
      
      frames++; 
      fpsAcc += dt;
      
      if (fpsAcc > 1) { 
        setStats(s => ({ ...s, fps: Math.round(frames / fpsAcc) })); 
        frames = 0; 
        fpsAcc = 0; 
      }

      const aw = awRef.current;
      const buf = aw.freq();
      
      if (!buf) return;
      
      const kick = aw.band(buf, 20, 80);
      const bass = aw.band(buf, 20, 250);
      const mid = aw.band(buf, 250, 4000);
      const treble = aw.band(buf, 4000, 20000);
      const sub = aw.band(buf, 20, 60);
      const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;
      const beat = bpmRef.current.update(kick);
      
      adRef.current = {
        kick, bass, mid, treble, sub, energy, beat, 
        freqData: buf, timeData: aw.time(), hue: adRef.current.hue
      };
      
      const sp = engRef.current.update(bass, mid, treble, energy, sub, buf);
      emoRef.current = { ...sp, beat };

      const currentWorldTime = now - engineState.worldStartTime;
      if (currentWorldTime > 300000) { 
        engineState.loopCount++; 
        engineState.worldStartTime = now; 
      }
      
      if (engineState.loopCount > 0) {
        engineState.distortPhase += (1.0 - engineState.distortPhase) * 0.001; 
      } else {
        engineState.distortPhase = 0;
      }

      if (now - uiRef.current > 180) {
        uiRef.current = now;
        setStats(s => ({
          ...s, 
          bpm: bpmRef.current.display, 
          mood: sp.mood, 
          ai_genre: sp.genre, 
          loops: engineState.loopCount, 
          combo: engineState.comboMultiplier, 
          diss: sp.dissonance,
          bass: Math.round(bass * 100), 
          mid: Math.round(mid * 100), 
          treble: Math.round(treble * 100)
        }));
      }
    };
    
    tick();
    return () => cancelAnimationFrame(adLoopRef.current);
  }, [phase]);

  const enterWorld = useCallback((id) => {
    if (isTransitioning || id === world) return;
    
    setTransPhase("out"); 
    setHudVisible(false);
    
    setTimeout(() => {
      setWorld(id); 
      engineState.worldStartTime = performance.now(); 
      engineState.loopCount = 0; 
      engineState.orbsCollected = 0; 
      engineState.comboMultiplier = 1;
      
      setTransPhase("in"); 
      setShowEntryText(true);
      
      setTimeout(() => { 
        setTransPhase("none"); 
        setTimeout(() => setShowEntryText(false), 4000); 
      }, 2500);
    }, 2000); 
  }, [world, isTransitioning]);

  const goBack = useCallback(() => { 
    if (world === "void") return; 
    enterWorld("void"); 
    setTimeout(() => setHudVisible(true), 3500); 
  }, [world, enterWorld]);

  const addTracks = useCallback((e) => {
    const files = Array.from(e.target.files); 
    if (!files.length) return;
    
    const newTracks = files.map(f => ({ 
      name: f.name.replace(/\.[^.]+$/, ""), 
      el: (() => { 
        const a = new Audio(URL.createObjectURL(f)); 
        return a; 
      })() 
    }));
    
    setPlaylist(prev => [...prev, ...newTracks]); 
    if (phase === "idle") setPhase("file"); 
  }, [phase]);

  const playTrack = useCallback((idx) => {
    const tr = playlist[idx]; 
    if (!tr) return;
    try { 
      awRef.current.file(tr.el); 
      setTrackIdx(idx); 
      setPhase("playing"); 
    } catch(e) { console.error(e); }
  }, [playlist]);

  const startMic = useCallback(async () => { 
    try { await awRef.current.mic(); setPhase("playing"); } catch (e) { console.error(e); } 
  }, []);

  const enterVoid = useCallback(() => {
    setIntroState("entering"); 
    engineState.worldStartTime = performance.now();
    setTimeout(() => { 
      setIntroState("done"); 
      setHudVisible(true); 
      if (playlist.length > 0) playTrack(0); 
    }, 1500);
  }, [playlist, playTrack]);

  useEffect(() => { 
    playlist.forEach((tr, i) => { 
      tr.el.onended = () => { 
        const next = (i + 1) % playlist.length; 
        if (next !== i) playTrack(next); 
      }; 
    }); 
  }, [playlist, playTrack]);

  useEffect(() => { 
    const handleKey = e => { if (e.key === "Escape") goBack(); }; 
    window.addEventListener("keydown", handleKey); 
    return () => window.removeEventListener("keydown", handleKey); 
  }, [goBack]);

  const MC = {
    void: "#00ccff", bloom: "#00ffcc", flame: "#ff6600", wilt: "#cc2200", root: "#00ff88"
  };

  return (
    <div style={{ width: "100%", height: "100vh", background: "#000000", position: "relative", overflow: "hidden", fontFamily: FONT, userSelect: "none" }}>
      
      <Canvas 
        style={{ position: "absolute", inset: 0 }} 
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }} 
        dpr={[1, 1.5]} 
        camera={{ position: [0, 100, 400], fov: 60, near: 1.0, far: 50000 }}
      >
        <Suspense fallback={null}>
          <SceneCore adRef={adRef} emoRef={emoRef} worldKey={world}/>
          
          <LivingSwarm count={500} adRef={adRef} emoRef={emoRef} />
          
          <ExplorerCamera isTransitioning={isTransitioning} mouseRef={mouseRef} inHub={world === "void"} planetsRef={planetsRef} adRef={adRef} />

          {introState === "done" && (
            <>
              {world === "void"  && (
                <group>
                  <MassiveTerrain worldKey="void" adRef={adRef} />
                  <BlackHoleCenter adRef={adRef} emoRef={emoRef} />
                  <OrbitalPlanets fwdRef={planetsRef} adRef={adRef} emoRef={emoRef} worldKey="void" scale={5} />
                  {PORTAL_CONFIGS.map(pc => (
                    <Portal 
                      key={pc.id} 
                      worldId={pc.id} 
                      position={[
                        Math.cos(pc.angle) * pc.dist, 
                        pc.y, 
                        Math.sin(pc.angle) * pc.dist
                      ]} 
                      color={WORLDS[pc.id].color} 
                      onEnter={enterWorld} 
                      adRef={adRef} 
                    />
                  ))}
                </group>
              )}
              {world === "bloom" && (
                <group>
                  <MassiveTerrain worldKey="bloom" adRef={adRef} />
                  <SkyAurora color={WORLDS.bloom.color} adRef={adRef} />
                  <EnvironmentScatter type="trees" count={8000} adRef={adRef} />
                  <AtmosphericParticles count={5000} adRef={adRef} emoRef={emoRef} isHub={false} />
                  <OrbitalPlanets fwdRef={planetsRef} adRef={adRef} emoRef={emoRef} worldKey="bloom" scale={6} />
                </group>
              )}
              {world === "flame" && (
                <group>
                  <MassiveTerrain worldKey="flame" adRef={adRef} />
                  <EnvironmentScatter type="crystals" count={8000} adRef={adRef} />
                  <AtmosphericParticles count={5000} adRef={adRef} emoRef={emoRef} isHub={false} />
                  <OrbitalPlanets fwdRef={planetsRef} adRef={adRef} emoRef={emoRef} worldKey="flame" scale={6} />
                </group>
              )}
              {world === "wilt"  && (
                <group>
                  <MassiveTerrain worldKey="wilt" adRef={adRef} />
                  <EnvironmentScatter type="ruins" count={8000} adRef={adRef} />
                  <AtmosphericParticles count={5000} adRef={adRef} emoRef={emoRef} isHub={false} />
                  <OrbitalPlanets fwdRef={planetsRef} adRef={adRef} emoRef={emoRef} worldKey="wilt" scale={6} />
                </group>
              )}
              {world === "root"  && (
                <group>
                  <MassiveTerrain worldKey="root" adRef={adRef} />
                  <SkyAurora color={WORLDS.root.color} adRef={adRef} />
                  <EnvironmentScatter type="trees" count={8000} adRef={adRef} />
                  <AtmosphericParticles count={5000} adRef={adRef} emoRef={emoRef} isHub={false} />
                  <OrbitalPlanets fwdRef={planetsRef} adRef={adRef} emoRef={emoRef} worldKey="root" scale={6} />
                </group>
              )}
            </>
          )}
        </Suspense>
      </Canvas>

      {/* ── UI OVERLAYS ────────────────────────────────────────── */}
      <div style={{ 
        position: "absolute", inset: 0, zIndex: 45, pointerEvents: "none", 
        background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${stats.diss * 0.9}) 100%)`, 
        transition: "background 0.5s" 
      }}/>
      
      <div style={{ 
        position: "absolute", inset: 0, zIndex: 60, pointerEvents: "none", 
        background: "#000000", opacity: transPhase === "out" ? 1 : 0, 
        transition: `opacity ${transPhase === "out" ? 0.4 : 0.8}s ease` 
      }}/>

      <div style={{ 
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", 
        alignItems: "center", justifyContent: "space-between", padding: "14px 22px", 
        background: "linear-gradient(to bottom,rgba(0,0,0,0.92),transparent)", 
        opacity: isInWorld ? 0 : 1, transition: "opacity 0.8s ease", pointerEvents: isInWorld ? "none" : "auto" 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%,${pal.color},${pal.accent})`, boxShadow: `0 0 20px ${pal.color}88` }}/>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 6, color: pal.color, textShadow: `0 0 24px ${pal.color}88` }}>AURAFIELD V12</span>
        </div>
        <button 
          onClick={() => setShowPlaylist(v => !v)} 
          style={{ 
            padding: "6px 14px", background: showPlaylist ? "#00ccff18" : "transparent", 
            border: `1.5px solid ${showPlaylist ? "#00ccff" : "#ffffff18"}`, borderRadius: 5, 
            color: showPlaylist ? "#00ccff" : "#ffffff35", fontFamily: FONT, fontWeight: 700, 
            fontSize: 9, letterSpacing: 3, cursor: "pointer", outline: "none" 
          }}>
          ♫ MUSIC
        </button>
      </div>

      {isInWorld && (
        <button 
          onClick={goBack} 
          style={{ 
            position: "absolute", top: 18, left: 22, zIndex: 50, padding: "8px 18px", 
            background: "rgba(0,0,0,0.7)", border: `1.5px solid ${pal.color}55`, borderRadius: 5, 
            color: pal.color, fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: 3, 
            cursor: "pointer", outline: "none", backdropFilter: "blur(10px)", 
            opacity: isTransitioning ? 0 : 1, transition: "opacity 0.5s" 
          }}>
          ⏴ VOID HUB
        </button>
      )}

      {showPlaylist && (
        <div style={{ 
          position: "absolute", top: 60, right: 20, zIndex: 50, width: 280, 
          background: "rgba(0,0,0,0.88)", border: "1px solid #ffffff15", borderRadius: 10, 
          backdropFilter: "blur(20px)", padding: "14px", maxHeight: 360, overflowY: "auto" 
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: pal.color, marginBottom: 10 }}>PLAYLIST</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: `${pal.color}15`, border: `1.5px solid ${pal.color}40`, borderRadius: 6, color: pal.color, fontSize: 10, fontWeight: 700, letterSpacing: 2, cursor: "pointer", marginBottom: 8 }}>
            + ADD TRACKS
            <input type="file" accept="audio/*" multiple onChange={addTracks} style={{ display: "none" }}/>
          </label>
          <button onClick={startMic} style={{ width: "100%", padding: "8px", background: "#ffffff08", border: "1px solid #ffffff15", borderRadius: 6, color: "#ffffff55", fontFamily: FONT, fontSize: 9, letterSpacing: 2, cursor: "pointer", outline: "none", marginBottom: 10 }}>
            🎤 USE MICROPHONE
          </button>
          {playlist.map((tr, i) => (
            <div key={i} onClick={() => playTrack(i)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, cursor: "pointer", marginBottom: 3, background: trackIdx === i && phase === "playing" ? `${pal.color}18` : "transparent", border: `1px solid ${trackIdx === i && phase === "playing" ? pal.color + "30" : "transparent"}`, transition: "all 0.2s" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, background: trackIdx === i && phase === "playing" ? pal.color : "#ffffff15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: trackIdx === i && phase === "playing" ? "#000" : "#ffffff40" }}>
                {trackIdx === i && phase === "playing" ? "▶" : i + 1}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 10, color: trackIdx === i ? "#ffffff" : "#ffffff60", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {tr.name}
                </div>
              </div>
            </div>
          ))}
          {(playlist.length > 0 || phase === "file") && introState === "ready" && (
            <button onClick={enterVoid} style={{ width: "100%", marginTop: 10, padding: "10px", background: `${pal.color}20`, border: `1.5px solid ${pal.color}60`, borderRadius: 6, color: pal.color, fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: 3, cursor: "pointer", outline: "none" }}>
              ⚫ ENTER THE VOID
            </button>
          )}
        </div>
      )}

      {introState === "ready" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: "rgba(0,0,0,0.5)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 80, fontWeight: 900, letterSpacing: 20, color: "#00ccff", textShadow: "0 0 100px #00ccff44", lineHeight: 1, marginBottom: 10 }}>THE VOID</div>
            <div style={{ fontSize: 14, letterSpacing: 12, color: "#ffffff25", fontWeight: 700, marginBottom: 3 }}>V12 APEX ENGINE</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ padding: "14px 35px", background: "#00ccff15", border: "1.5px solid #00ccff50", borderRadius: 8, color: "#00ccff", fontFamily: FONT, fontWeight: 700, fontSize: 14, letterSpacing: 4, cursor: "pointer" }}>
              + UPLOAD MUSIC
              <input type="file" accept="audio/*" multiple onChange={e => { addTracks(e); setShowPlaylist(true); }} style={{ display: "none" }}/>
            </label>
          </div>
          <button onClick={enterVoid} style={{ padding: "14px 35px", background: "#00ccff15", border: "1.5px solid #00ccff50", borderRadius: 8, color: "#00ccff", fontFamily: FONT, fontWeight: 700, fontSize: 14, letterSpacing: 4, cursor: "pointer" }}>
            ⚫ ENTER WITHOUT MUSIC
          </button>
          <div style={{ fontSize: 10, color: "#ffffff40", letterSpacing: 5, marginTop: 20 }}>
            WASD = FLY • SHIFT = WARP • SPACE = BOOST • FLY INTO PORTALS TO WARP
          </div>
        </div>
      )}

      {isInWorld && introState === "done" && !isTransitioning && (
        <div style={{ position: "absolute", bottom: 18, right: 18, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, opacity: isInWorld ? 1 : 0, transition: "opacity 0.5s" }}>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 8, color: pal.color, textShadow: `0 0 20px ${pal.color}88` }}>{WORLDS[world]?.name}</div>
          <div style={{ fontSize: 10, color: "#ffffff40", letterSpacing: 4 }}>{WORLDS[world]?.desc}</div>
          <div style={{ fontSize: 10, color: pal.accent, letterSpacing: 4, marginTop: 6 }}>
            GENRE: {stats.ai_genre} {stats.loops > 0 && `| LOOP ${stats.loops}`}
          </div>
          {stats.combo > 1 && (
            <div style={{ fontSize: 12, color: "#fff", letterSpacing: 4, marginTop: 6, textShadow: "0 0 10px #fff" }}>
              COMBO x{stats.combo}
            </div>
          )}
        </div>
      )}

      {introState === "done" && world === "void" && hudVisible && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50, padding: "20px 30px", background: "linear-gradient(to top,rgba(0,0,0,0.96),transparent)", display: "flex", alignItems: "flex-end", gap: 24, opacity: isTransitioning ? 0 : 1, transition: "opacity 0.5s" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 4, color: "#ffffff35" }}>AUDIO SPECTRUM</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 50 }}>
              {Array.from({ length: 80 }).map((_, i) => {
                const segs = [stats.bass, stats.bass * 0.9, stats.mid * 1.2, stats.mid, stats.mid * 0.8, stats.treble * 0.9, stats.treble];
                const rawH = (segs[Math.floor((i / 80) * segs.length)] || 0) / 100;
                const h = Math.max(2, Math.round(rawH * 50));
                const alpha = 0.1 + rawH * 0.9;
                return (
                  <div key={i} style={{
                    flex: 1, 
                    height: h,
                    background: `linear-gradient(to top, rgba(20,20,20,0.6), rgba(255,255,255,${alpha * 0.8}))`,
                    borderTop: `1px solid rgba(255,255,255,${alpha})`,
                    borderRadius: "2px 2px 0 0",
                    transition: "height 0.08s ease-out"
                  }} />
                );
              })}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, letterSpacing: 6, color: "#ffffff35" }}>BPM</div>
            <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: 4, color: "#ffffff", textShadow: "0 0 20px rgba(255,255,255,0.4)", lineHeight: 1 }}>{stats.bpm}</div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 4, color: MC[stats.mood] || "#00ccff", marginTop: 6 }}>{WORLDS[stats.mood]?.name || "VOID"}</div>
          </div>
        </div>
      )}

      {showEntryText && (
        <div style={{ position: "absolute", inset: 0, zIndex: 55, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity: transPhase === "in" || showEntryText ? 1 : 0, transition: "opacity 1.5s ease" }}>
          <div style={{ fontSize: 100, fontWeight: 900, letterSpacing: 30, color: pal.color, textShadow: `0 0 120px ${pal.color}` }}>{pal.name}</div>
          <div style={{ fontSize: 16, letterSpacing: 16, color: "#ffffff60", marginTop: 15 }}>{pal.desc}</div>
        </div>
      )}
    </div>
  );
}