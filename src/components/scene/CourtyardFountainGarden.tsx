import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COURTYARD_HALF } from '../../data/buildingLayout';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

// Ground level flush inside the 26m x 26m hollow central courtyard
const GARDEN_SURFACE_Y = -0.14;
const GARDEN_SPAN = COURTYARD_HALF * 2 - 0.14;

function makeSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return [canvas, canvas.getContext('2d')!];
}

function createHauntedGardenTextures() {
  const rand = makeSeededRandom(94127);

  // 1. Neglected Damp Earth, Dead Grass & Overgrown Moss Turf
  const [groundCanvas, gCtx] = makeCanvas(512);
  gCtx.fillStyle = '#20261f';
  gCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 64; i++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const r = 24 + rand() * 72;
    const pick = rand();
    const grad = gCtx.createRadialGradient(cx, cy, 4, cx, cy, r);
    if (pick < 0.38) {
      // Damp dark mud / bare earth patch
      grad.addColorStop(0, 'rgba(34, 29, 24, 0.52)');
      grad.addColorStop(1, 'rgba(32, 38, 31, 0)');
    } else if (pick < 0.72) {
      // Dark neglected moss & shadowed weeds
      grad.addColorStop(0, 'rgba(34, 52, 34, 0.44)');
      grad.addColorStop(1, 'rgba(32, 38, 31, 0)');
    } else {
      // Withered dead grass patch
      grad.addColorStop(0, 'rgba(68, 60, 42, 0.36)');
      grad.addColorStop(1, 'rgba(32, 38, 31, 0)');
    }
    gCtx.fillStyle = grad;
    gCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  for (let i = 0; i < 8200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const v = 30 + Math.floor(rand() * 34);
    gCtx.fillStyle =
      rand() > 0.35
        ? `rgba(${v}, ${v + 8}, ${v - 2}, 0.38)`
        : `rgba(${v + 12}, ${v + 6}, ${v - 4}, 0.34)`;
    gCtx.fillRect(x, y, 1.5, 3 + rand() * 3.5);
  }
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.wrapS = THREE.RepeatWrapping;
  groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(5, 5);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = 4;

  // 2. Cracked Weathered Stone Pathways with Moss & Fracture Lines
  const [pathCanvas, pCtx] = makeCanvas(512);
  const [pathBumpCanvas, pBumpCtx] = makeCanvas(512);
  pCtx.fillStyle = '#141917';
  pCtx.fillRect(0, 0, 512, 512);
  pBumpCtx.fillStyle = '#303030';
  pBumpCtx.fillRect(0, 0, 512, 512);

  const slab = 128;
  for (let py = 0; py < 512; py += slab) {
    for (let px = 0; px < 512; px += slab) {
      const jit = Math.floor(rand() * 18) - 9;
      pCtx.fillStyle = `rgb(${54 + jit}, ${59 + jit}, ${57 + jit})`;
      pCtx.fillRect(px + 4, py + 4, slab - 8, slab - 8);
      pBumpCtx.fillStyle = '#989898';
      pBumpCtx.fillRect(px + 4, py + 4, slab - 8, slab - 8);

      // Damp stain or moss along slab joint
      if (rand() < 0.65) {
        const mx = px + 14 + rand() * 100;
        const my = py + 14 + rand() * 100;
        const mr = 14 + rand() * 32;
        const mg = pCtx.createRadialGradient(mx, my, 2, mx, my, mr);
        mg.addColorStop(0, 'rgba(30, 46, 32, 0.45)');
        mg.addColorStop(1, 'rgba(30, 46, 32, 0)');
        pCtx.fillStyle = mg;
        pCtx.fillRect(px + 4, py + 4, slab - 8, slab - 8);
      }

      // Jagged cracks splitting across individual flagstones
      if (rand() < 0.78) {
        let cx = px + 16 + rand() * 96;
        let cy = py + 8;
        pCtx.beginPath();
        pBumpCtx.beginPath();
        pCtx.moveTo(cx, cy);
        pBumpCtx.moveTo(cx, cy);
        for (let s = 0; s < 5; s++) {
          cx += (rand() - 0.5) * 34;
          cy += 18 + rand() * 14;
          pCtx.lineTo(Math.min(px + slab - 6, Math.max(px + 6, cx)), Math.min(py + slab - 6, cy));
          pBumpCtx.lineTo(Math.min(px + slab - 6, Math.max(px + 6, cx)), Math.min(py + slab - 6, cy));
        }
        pCtx.strokeStyle = 'rgba(14, 18, 16, 0.85)';
        pCtx.lineWidth = 2.0;
        pCtx.stroke();
        pBumpCtx.strokeStyle = '#242424';
        pBumpCtx.lineWidth = 2.6;
        pBumpCtx.stroke();
      }
    }
  }
  // Mossy dark crevices between stone slabs
  pCtx.strokeStyle = 'rgba(22, 36, 24, 0.88)';
  pCtx.lineWidth = 5;
  for (let g = 0; g <= 512; g += slab) {
    pCtx.beginPath();
    pCtx.moveTo(g, 0);
    pCtx.lineTo(g, 512);
    pCtx.moveTo(0, g);
    pCtx.lineTo(512, g);
    pCtx.stroke();
  }
  const pathTex = new THREE.CanvasTexture(pathCanvas);
  pathTex.wrapS = THREE.RepeatWrapping;
  pathTex.wrapT = THREE.RepeatWrapping;
  pathTex.repeat.set(4, 4);
  pathTex.colorSpace = THREE.SRGBColorSpace;
  pathTex.anisotropy = 4;

  const pathBumpTex = new THREE.CanvasTexture(pathBumpCanvas);
  pathBumpTex.wrapS = THREE.RepeatWrapping;
  pathBumpTex.wrapT = THREE.RepeatWrapping;
  pathBumpTex.repeat.set(4, 4);
  pathBumpTex.colorSpace = THREE.NoColorSpace;

  // 3. Dark Weathered Fountain Stone with Cracks, Water Stains & Creeping Moss
  const [stoneCanvas, sCtx] = makeCanvas(512);
  const [stoneBumpCanvas, sBumpCtx] = makeCanvas(512);
  sCtx.fillStyle = '#474e4d';
  sCtx.fillRect(0, 0, 512, 512);
  sBumpCtx.fillStyle = '#828282';
  sBumpCtx.fillRect(0, 0, 512, 512);

  // Dark weathered damp blotches & mineral stains
  for (let i = 0; i < 55; i++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const r = 18 + rand() * 68;
    const g = sCtx.createRadialGradient(cx, cy, 2, cx, cy, r);
    const t = rand();
    if (t < 0.42) {
      // Dark rain-soaked slate stain
      g.addColorStop(0, 'rgba(20, 24, 25, 0.48)');
      g.addColorStop(1, 'rgba(40, 46, 46, 0)');
    } else if (t < 0.76) {
      // Deep damp moss / lichen patch
      g.addColorStop(0, 'rgba(32, 54, 34, 0.56)');
      g.addColorStop(0.6, 'rgba(26, 42, 28, 0.28)');
      g.addColorStop(1, 'rgba(40, 46, 46, 0)');
    } else {
      // Pale weathered mineral lime streak
      g.addColorStop(0, 'rgba(128, 134, 130, 0.24)');
      g.addColorStop(1, 'rgba(70, 76, 75, 0)');
    }
    sCtx.fillStyle = g;
    sCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Vertical mineral & rainwater runoff streaks
  for (let i = 0; i < 36; i++) {
    const sx = rand() * 512;
    const sy = rand() * 140;
    const sh = 120 + rand() * 320;
    const sg = sCtx.createLinearGradient(sx, sy, sx, sy + sh);
    sg.addColorStop(0, 'rgba(16, 22, 20, 0.42)');
    sg.addColorStop(0.5, 'rgba(28, 44, 30, 0.22)');
    sg.addColorStop(1, 'rgba(20, 24, 24, 0)');
    sCtx.fillStyle = sg;
    sCtx.fillRect(sx, sy, 3 + rand() * 8, sh);
  }
  // Stone pitting & grain
  for (let i = 0; i < 5500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const v = 50 + Math.floor(rand() * 44);
    sCtx.fillStyle = `rgba(${v}, ${v + 4}, ${v + 3}, 0.28)`;
    sCtx.fillRect(x, y, 2, 2);
    const bv = 96 + Math.floor(rand() * 64);
    sBumpCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    sBumpCtx.fillRect(x, y, 2, 2);
  }
  // Deep jagged stone cracks across fountain structure
  for (let c = 0; c < 18; c++) {
    let cx = rand() * 512;
    let cy = rand() * 512;
    const dir = rand() * Math.PI * 2;
    sCtx.beginPath();
    sBumpCtx.beginPath();
    sCtx.moveTo(cx, cy);
    sBumpCtx.moveTo(cx, cy);
    for (let s = 0; s < 8; s++) {
      cx += Math.cos(dir + (rand() - 0.5) * 1.1) * (8 + rand() * 14);
      cy += Math.sin(dir + (rand() - 0.5) * 1.1) * (8 + rand() * 14);
      sCtx.lineTo(cx, cy);
      sBumpCtx.lineTo(cx, cy);
    }
    sCtx.strokeStyle = 'rgba(12, 16, 15, 0.72)';
    sCtx.lineWidth = 1.6 + rand() * 1.2;
    sCtx.stroke();
    sBumpCtx.strokeStyle = '#222222';
    sBumpCtx.lineWidth = 2.4;
    sBumpCtx.stroke();
  }
  const stoneTex = new THREE.CanvasTexture(stoneCanvas);
  stoneTex.wrapS = THREE.RepeatWrapping;
  stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.repeat.set(3, 2);
  stoneTex.colorSpace = THREE.SRGBColorSpace;

  const stoneBumpTex = new THREE.CanvasTexture(stoneBumpCanvas);
  stoneBumpTex.wrapS = THREE.RepeatWrapping;
  stoneBumpTex.wrapT = THREE.RepeatWrapping;
  stoneBumpTex.repeat.set(3, 2);
  stoneBumpTex.colorSpace = THREE.NoColorSpace;

  // 4. Stagnant Dark Reflective Fountain Water (subtle algae edge & dark depth)
  const [waterCanvas, wCtx] = makeCanvas(256);
  const wg = wCtx.createRadialGradient(128, 128, 12, 128, 128, 128);
  wg.addColorStop(0, '#0c1c1e');
  wg.addColorStop(0.65, '#122625');
  wg.addColorStop(0.9, '#1c3329');
  wg.addColorStop(1, '#101d19');
  wCtx.fillStyle = wg;
  wCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 36; i++) {
    const cx = rand() * 256;
    const cy = rand() * 256;
    const r = 10 + rand() * 32;
    const ag = wCtx.createRadialGradient(cx, cy, 2, cx, cy, r);
    ag.addColorStop(0, 'rgba(34, 58, 44, 0.28)');
    ag.addColorStop(1, 'rgba(14, 28, 28, 0)');
    wCtx.fillStyle = ag;
    wCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const stagnantWaterTex = new THREE.CanvasTexture(waterCanvas);
  stagnantWaterTex.colorSpace = THREE.SRGBColorSpace;

  // 5. Deadwood Bark Texture for Twisted Dry Trees
  const [barkCanvas, bCtx] = makeCanvas(128);
  bCtx.fillStyle = '#2d2825';
  bCtx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 3) {
    const v = 32 + Math.floor(rand() * 28);
    bCtx.fillStyle = `rgb(${v + 4}, ${v + 1}, ${v - 2})`;
    bCtx.fillRect(x, 0, 2.2, 128);
  }
  const barkTex = new THREE.CanvasTexture(barkCanvas);
  barkTex.wrapS = THREE.RepeatWrapping;
  barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.colorSpace = THREE.SRGBColorSpace;

  // 6. Soft Radial Ground Fog / Mist Alpha Map
  const [mistCanvas, mCtx] = makeCanvas(128);
  const mg = mCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  mg.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
  mg.addColorStop(0.45, 'rgba(255, 255, 255, 0.34)');
  mg.addColorStop(0.8, 'rgba(255, 255, 255, 0.08)');
  mg.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  mCtx.fillStyle = '#000000';
  mCtx.fillRect(0, 0, 128, 128);
  mCtx.fillStyle = mg;
  mCtx.fillRect(0, 0, 128, 128);
  const mistAlphaTex = new THREE.CanvasTexture(mistCanvas);
  mistAlphaTex.colorSpace = THREE.NoColorSpace;

  return {
    groundTex,
    pathTex,
    pathBumpTex,
    stoneTex,
    stoneBumpTex,
    stagnantWaterTex,
    barkTex,
    mistAlphaTex,
    dispose: () => {
      groundTex.dispose();
      pathTex.dispose();
      pathBumpTex.dispose();
      stoneTex.dispose();
      stoneBumpTex.dispose();
      stagnantWaterTex.dispose();
      barkTex.dispose();
      mistAlphaTex.dispose();
    },
  };
}

/**
 * Generates twisted, gnarled bare dead-tree branch geometries and merges trunk,
 * root mound, limbs, and twigs into a single BufferGeometry per tree variant
 * (reduces 6 dead trees from 72 draw calls & shadow casters down to 6).
 */
function buildMergedDeadTree(seed: number): THREE.BufferGeometry {
  const rand = makeSeededRandom(seed);
  const parts: THREE.BufferGeometry[] = [];

  // Gnarled root mound + exposed surface roots gripping cracked courtyard earth
  const rootMound = new THREE.CylinderGeometry(0.18, 0.36, 0.3, 8);
  rootMound.translate(0, 0.14, 0);
  parts.push(rootMound.index ? rootMound.toNonIndexed() : rootMound);
  if (rootMound.index) rootMound.dispose();

  for (let r = 0; r < 5; r++) {
    const rAng = (r / 5) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const rLen = 0.72 + rand() * 0.65;
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(rAng) * 0.16, 0.22, Math.sin(rAng) * 0.16),
      new THREE.Vector3(Math.cos(rAng + 0.14) * rLen * 0.55, 0.08 + rand() * 0.06, Math.sin(rAng + 0.14) * rLen * 0.55),
      new THREE.Vector3(Math.cos(rAng - 0.08) * rLen, 0.015, Math.sin(rAng - 0.08) * rLen),
    ]);
    const rootTube = new THREE.TubeGeometry(rootCurve, 6, 0.052, 5, false);
    parts.push(rootTube.index ? rootTube.toNonIndexed() : rootTube);
    if (rootTube.index) rootTube.dispose();
  }

  // Gnarled curving main trunk (0 -> ~3.3m)
  const leanX = (rand() - 0.5) * 0.65;
  const leanZ = (rand() - 0.5) * 0.65;
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(leanX * 0.3, 1.05, leanZ * 0.3),
    new THREE.Vector3(leanX * 0.85, 2.2, leanZ * 0.7),
    new THREE.Vector3(leanX, 3.35, leanZ),
  ]);
  const trunkTube = new THREE.TubeGeometry(trunkCurve, 12, 0.16, 7, false);
  parts.push(trunkTube.index ? trunkTube.toNonIndexed() : trunkTube);
  if (trunkTube.index) trunkTube.dispose();

  // 5 primary twisted limbs + secondary dead twigs reaching outward into the moonlit air
  for (let b = 0; b < 5; b++) {
    const baseAngle = (b / 5) * Math.PI * 2 + (rand() - 0.5) * 0.45;
    const startT = 0.54 + (b % 3) * 0.18;
    const origin = trunkCurve.getPoint(startT);
    const reach = 1.65 + rand() * 1.15;
    const rise = 1.2 + rand() * 1.15;

    const midX = origin.x + Math.cos(baseAngle) * reach * 0.52 + (rand() - 0.5) * 0.38;
    const midY = origin.y + rise * 0.58 + (rand() - 0.5) * 0.25;
    const midZ = origin.z + Math.sin(baseAngle) * reach * 0.52 + (rand() - 0.5) * 0.38;

    const tipX = origin.x + Math.cos(baseAngle + (rand() - 0.5) * 0.55) * reach;
    const tipY = origin.y + rise;
    const tipZ = origin.z + Math.sin(baseAngle + (rand() - 0.5) * 0.55) * reach;

    const branchCurve = new THREE.CatmullRomCurve3([
      origin,
      new THREE.Vector3(midX, midY, midZ),
      new THREE.Vector3(tipX, tipY, tipZ),
    ]);
    const branchTube = new THREE.TubeGeometry(branchCurve, 9, 0.062, 6, false);
    parts.push(branchTube.index ? branchTube.toNonIndexed() : branchTube);
    if (branchTube.index) branchTube.dispose();

    // Forked gnarled secondary twig off the mid-point
    const twigAngle = baseAngle + (b % 2 === 0 ? 0.68 : -0.68);
    const twigReach = 0.75 + rand() * 0.65;
    const twigStart = branchCurve.getPoint(0.55);
    const twigCurve = new THREE.CatmullRomCurve3([
      twigStart,
      new THREE.Vector3(
        twigStart.x + Math.cos(twigAngle) * twigReach * 0.5,
        twigStart.y + 0.42 + rand() * 0.3,
        twigStart.z + Math.sin(twigAngle) * twigReach * 0.5
      ),
      new THREE.Vector3(
        twigStart.x + Math.cos(twigAngle) * twigReach,
        twigStart.y + 0.7 + rand() * 0.48,
        twigStart.z + Math.sin(twigAngle) * twigReach
      ),
    ]);
    const twigTube = new THREE.TubeGeometry(twigCurve, 6, 0.028, 5, false);
    parts.push(twigTube.index ? twigTube.toNonIndexed() : twigTube);
    if (twigTube.index) twigTube.dispose();
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

interface DripSource {
  x: number;
  z: number;
  startY: number;
  endY: number;
  period: number;
  offset: number;
}

/**
 * Abandoned, haunted moonlit central courtyard featuring:
 * - Dark weathered moss-stained & cracked stone fountain with stagnant reflective water & slow dripping drops
 * - Dry twisted dead trees casting moonlit shadows across cracked stone pathways
 * - Overgrown weeds, dead plants, creeping dark green ivy, scattered fallen dead leaves
 * - Broken garden benches, toppled cracked stone urns, dead & flickering haunted courtyard lamps
 * - Subtle drifting ground mist & dim cool blue / pale green moonlight ambience
 */
export const CourtyardFountainGarden: React.FC = React.memo(() => {
  const textures = useMemo(() => createHauntedGardenTextures(), []);

  const mats = useMemo(() => {
    const ground = new THREE.MeshStandardMaterial({
      map: textures.groundTex,
      roughness: 0.96,
      metalness: 0.02,
    });
    const crackedPath = new THREE.MeshStandardMaterial({
      map: textures.pathTex,
      bumpMap: textures.pathBumpTex,
      bumpScale: 0.032,
      roughness: 0.78,
      metalness: 0.08,
      envMapIntensity: 0.75,
    });
    const fountainStone = new THREE.MeshStandardMaterial({
      map: textures.stoneTex,
      bumpMap: textures.stoneBumpTex,
      bumpScale: 0.042,
      color: '#6b7270',
      roughness: 0.84,
      metalness: 0.06,
      envMapIntensity: 0.65,
    });
    const dampStone = new THREE.MeshStandardMaterial({
      map: textures.stoneTex,
      bumpMap: textures.stoneBumpTex,
      bumpScale: 0.036,
      color: '#46504d',
      roughness: 0.42,
      metalness: 0.12,
      envMapIntensity: 1.05,
    });
    const poolFloor = new THREE.MeshStandardMaterial({
      color: '#0c1616',
      roughness: 0.6,
      metalness: 0.1,
    });
    const verdigrisBronze = new THREE.MeshStandardMaterial({
      color: '#3c4f48',
      roughness: 0.56,
      metalness: 0.68,
      envMapIntensity: 0.9,
    });
    // Stagnant dark reflective water with subtle sheen
    const stagnantWater = new THREE.MeshStandardMaterial({
      map: textures.stagnantWaterTex,
      color: '#22383a',
      emissive: '#08181c',
      emissiveIntensity: 0.25,
      roughness: 0.08,
      metalness: 0.34,
      transparent: true,
      opacity: 0.92,
      envMapIntensity: 1.85,
    });
    const dripDrop = new THREE.MeshStandardMaterial({
      color: '#a8d4dc',
      emissive: '#487d88',
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.15,
      transparent: true,
      opacity: 0.82,
    });
    const deadWood = new THREE.MeshStandardMaterial({
      map: textures.barkTex,
      color: '#4a433e',
      roughness: 0.94,
      metalness: 0.02,
    });
    const weedMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', // Per-instance muted olive / dead brown via setColorAt
      roughness: 0.94,
      metalness: 0.01,
      side: THREE.DoubleSide,
    });
    const ivyMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', // Per-instance dark green ivy via setColorAt
      roughness: 0.78,
      metalness: 0.04,
    });
    const deadLeafMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', // Per-instance dry brown/amber leaves via setColorAt
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const benchWood = new THREE.MeshStandardMaterial({
      color: '#403830',
      roughness: 0.9,
      metalness: 0.03,
    });
    const agedIron = new THREE.MeshStandardMaterial({
      color: '#22282b',
      roughness: 0.58,
      metalness: 0.74,
    });
    const deadLanternGlass = new THREE.MeshStandardMaterial({
      color: '#283236',
      roughness: 0.45,
      metalness: 0.2,
    });
    const mistMat = new THREE.MeshBasicMaterial({
      color: '#7f9ba8',
      alphaMap: textures.mistAlphaTex,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const soilMat = new THREE.MeshStandardMaterial({
      color: '#1e1b17',
      roughness: 0.98,
      metalness: 0.01,
    });

    const list = [
      ground,
      crackedPath,
      fountainStone,
      dampStone,
      poolFloor,
      verdigrisBronze,
      stagnantWater,
      dripDrop,
      deadWood,
      weedMat,
      ivyMat,
      deadLeafMat,
      benchWood,
      agedIron,
      deadLanternGlass,
      mistMat,
      soilMat,
    ];

    return {
      ground,
      crackedPath,
      fountainStone,
      dampStone,
      poolFloor,
      verdigrisBronze,
      stagnantWater,
      dripDrop,
      deadWood,
      weedMat,
      ivyMat,
      deadLeafMat,
      benchWood,
      agedIron,
      deadLanternGlass,
      mistMat,
      soilMat,
      dispose: () => list.forEach((m) => m.dispose()),
    };
  }, [textures]);

  // Sculpted weathered fountain geometry + 3 distinct dead tree archetypes + broken urn geometry
  const geos = useMemo(() => {
    const outerRimPts = [
      new THREE.Vector2(4.28, 0.0),
      new THREE.Vector2(4.28, 0.16),
      new THREE.Vector2(4.06, 0.2),
      new THREE.Vector2(4.0, 0.66),
      new THREE.Vector2(4.14, 0.72),
      new THREE.Vector2(4.12, 0.82),
      new THREE.Vector2(3.6, 0.82),
      new THREE.Vector2(3.56, 0.7),
      new THREE.Vector2(3.58, 0.12),
      new THREE.Vector2(0.0, 0.12),
    ];
    const outerBasin = new THREE.LatheGeometry(outerRimPts, 32);

    const tier1Pts = [
      new THREE.Vector2(0.0, 0.12),
      new THREE.Vector2(0.98, 0.12),
      new THREE.Vector2(0.86, 0.42),
      new THREE.Vector2(0.58, 0.72),
      new THREE.Vector2(0.52, 1.36),
      new THREE.Vector2(0.88, 1.54),
      new THREE.Vector2(1.7, 1.7),
      new THREE.Vector2(2.04, 1.94),
      new THREE.Vector2(1.94, 2.01),
      new THREE.Vector2(1.76, 1.95),
      new THREE.Vector2(1.38, 1.8),
      new THREE.Vector2(0.42, 1.76),
      new THREE.Vector2(0.0, 1.76),
    ];
    const tier1Bowl = new THREE.LatheGeometry(tier1Pts, 28);

    const tier2Pts = [
      new THREE.Vector2(0.0, 1.76),
      new THREE.Vector2(0.5, 1.76),
      new THREE.Vector2(0.38, 2.12),
      new THREE.Vector2(0.34, 2.8),
      new THREE.Vector2(0.68, 2.98),
      new THREE.Vector2(1.14, 3.24),
      new THREE.Vector2(1.08, 3.31),
      new THREE.Vector2(0.94, 3.26),
      new THREE.Vector2(0.3, 3.12),
      new THREE.Vector2(0.22, 3.55),
      new THREE.Vector2(0.28, 3.72),
      new THREE.Vector2(0.14, 3.96),
      new THREE.Vector2(0.0, 4.04),
    ];
    const tier2Bowl = new THREE.LatheGeometry(tier2Pts, 24);

    // Cracked decorative stone garden urn (for broken/toppled ornaments)
    const urnPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.26, 0.0),
      new THREE.Vector2(0.18, 0.14),
      new THREE.Vector2(0.36, 0.42),
      new THREE.Vector2(0.38, 0.68),
      new THREE.Vector2(0.26, 0.84),
      new THREE.Vector2(0.34, 0.94),
      new THREE.Vector2(0.26, 0.94),
      new THREE.Vector2(0.22, 0.78),
    ];
    const urnGeo = new THREE.LatheGeometry(urnPts, 16);

    const treeVariantA = buildMergedDeadTree(1011);
    const treeVariantB = buildMergedDeadTree(2027);
    const treeVariantC = buildMergedDeadTree(3049);

    const dripGeo = new THREE.SphereGeometry(0.032, 8, 8);
    const rippleGeo = new THREE.RingGeometry(0.84, 1.0, 24);
    const weedGeo = new THREE.ConeGeometry(0.11, 0.56, 4);
    const ivyGeo = new THREE.DodecahedronGeometry(0.24, 0);
    const leafGeo = new THREE.PlaneGeometry(0.16, 0.11);
    const mistPlaneGeo = new THREE.PlaneGeometry(10.5, 10.5);
    const crookedSlabGeo = new THREE.BoxGeometry(0.92, 0.04, 0.78);
    const lampBaseGeo = new THREE.BoxGeometry(0.38, 0.28, 0.38);
    const lampPostGeo = new THREE.CylinderGeometry(0.055, 0.085, 1.44, 8);
    const lampGlassGeo = new THREE.BoxGeometry(0.24, 0.28, 0.24);
    const lampCapGeo = new THREE.ConeGeometry(0.28, 0.2, 4);

    return {
      outerBasin,
      tier1Bowl,
      tier2Bowl,
      urnGeo,
      treeVariantA,
      treeVariantB,
      treeVariantC,
      dripGeo,
      rippleGeo,
      weedGeo,
      ivyGeo,
      leafGeo,
      mistPlaneGeo,
      crookedSlabGeo,
      lampBaseGeo,
      lampPostGeo,
      lampGlassGeo,
      lampCapGeo,
      dispose: () => {
        outerBasin.dispose();
        tier1Bowl.dispose();
        tier2Bowl.dispose();
        urnGeo.dispose();
        treeVariantA.dispose();
        treeVariantB.dispose();
        treeVariantC.dispose();
        dripGeo.dispose();
        rippleGeo.dispose();
        weedGeo.dispose();
        ivyGeo.dispose();
        leafGeo.dispose();
        mistPlaneGeo.dispose();
        crookedSlabGeo.dispose();
        lampBaseGeo.dispose();
        lampPostGeo.dispose();
        lampGlassGeo.dispose();
        lampCapGeo.dispose();
      },
    };
  }, []);

  // 6 intermittent slow water drip sources falling from weathered stone fountain lips
  const dripSources = useMemo<DripSource[]>(
    () => [
      { x: 1.98, z: 0.0, startY: 1.94, endY: 0.44, period: 2.8, offset: 0.1 },
      { x: -1.42, z: 1.4, startY: 1.94, endY: 0.44, period: 3.4, offset: 1.25 },
      { x: -0.95, z: -1.72, startY: 1.94, endY: 0.44, period: 4.1, offset: 2.3 },
      { x: 0.72, z: -1.84, startY: 1.94, endY: 0.44, period: 3.7, offset: 0.8 },
      { x: 0.78, z: 0.78, startY: 3.24, endY: 1.88, period: 3.1, offset: 1.7 },
      { x: -0.92, z: -0.58, startY: 3.24, endY: 1.88, period: 4.4, offset: 0.45 },
    ],
    []
  );

  // Neglected haunted courtyard placements
  const layout = useMemo(() => {
    const rand = makeSeededRandom(66341);

    // 6 dry twisted dead trees framing the courtyard & casting dramatic shadows
    const deadTrees = [
      { pos: [-8.5, 0, -8.4] as [number, number, number], rotY: 0.4, scale: 1.22, variant: 0 },
      { pos: [8.4, 0, -8.7] as [number, number, number], rotY: 1.9, scale: 1.16, variant: 1 },
      { pos: [-8.7, 0, 8.3] as [number, number, number], rotY: 3.5, scale: 1.18, variant: 2 },
      { pos: [8.6, 0, 8.6] as [number, number, number], rotY: 5.1, scale: 1.25, variant: 0 },
      { pos: [-9.8, 0, -3.4] as [number, number, number], rotY: 2.4, scale: 0.86, variant: 1 },
      { pos: [9.6, 0, 3.8] as [number, number, number], rotY: 4.2, scale: 0.88, variant: 2 },
    ];

    // 220 overgrown weeds & dead dry plant tufts sprouting around paths, fountain base & corners
    const weeds: { pos: [number, number, number]; scale: [number, number, number]; rotY: number; tilt: number; hex: string }[] = [];
    const weedPalette = ['#2d3826', '#3d3928', '#253121', '#4b412e', '#1e281c'];
    for (let i = 0; i < 220; i++) {
      let wx = (rand() - 0.5) * 23.6;
      let wz = (rand() - 0.5) * 23.6;
      const r = Math.hypot(wx, wz);
      // Allow some weeds right up against the fountain rim and cracks, avoid center inside basin
      if (r < 4.35) {
        const ang = rand() * Math.PI * 2;
        const rad = 4.38 + rand() * 0.42;
        wx = Math.cos(ang) * rad;
        wz = Math.sin(ang) * rad;
      } else if (r < 6.0 && Math.abs(wx) > 1.35 && Math.abs(wz) > 1.35 && rand() < 0.72) {
        // Push most plaza weeds toward the cracked rim
        const push = 6.25 / Math.max(0.1, r);
        wx *= push;
        wz *= push;
      }
      const h = 0.45 + rand() * 1.15;
      weeds.push({
        pos: [wx, h * 0.24, wz],
        scale: [0.7 + rand() * 0.9, h, 0.7 + rand() * 0.9],
        rotY: rand() * Math.PI * 2,
        tilt: (rand() - 0.5) * 0.32,
        hex: weedPalette[Math.floor(rand() * weedPalette.length)],
      });
    }

    // 135 dark green creeping ivy clusters climbing fountain base, perimeter walls & dead trunks
    const ivyClusters: { pos: [number, number, number]; scale: [number, number, number]; hex: string }[] = [];
    const ivyPalette = ['#183020', '#203d29', '#14281b', '#264630'];
    // Ivy creeping up the outer fountain basin & lower pedestal
    for (let i = 0; i < 38; i++) {
      const a = rand() * Math.PI * 2;
      const onPedestal = i > 26;
      const rad = onPedestal ? 0.62 + rand() * 0.35 : 4.02 + rand() * 0.28;
      const iy = onPedestal ? 0.6 + rand() * 1.15 : 0.14 + rand() * 0.66;
      const sc = 0.65 + rand() * 0.75;
      ivyClusters.push({
        pos: [Math.cos(a) * rad, iy, Math.sin(a) * rad],
        scale: [sc * 1.15, sc * 0.8, sc * 1.15],
        hex: ivyPalette[Math.floor(rand() * ivyPalette.length)],
      });
    }
    // Ivy clinging along selected perimeter courtyard edges & climbing base of dead trees
    for (let i = 0; i < 72; i++) {
      const side = i % 4;
      const along = (rand() - 0.5) * 23.0;
      const h = 0.18 + rand() * 1.45;
      const edge = COURTYARD_HALF - 0.32;
      let ix = 0;
      let iz = 0;
      if (side === 0) { ix = along; iz = -edge; }
      else if (side === 1) { ix = along; iz = edge; }
      else if (side === 2) { ix = -edge; iz = along; }
      else { ix = edge; iz = along; }
      const sc = 0.8 + rand() * 1.05;
      ivyClusters.push({
        pos: [ix, h, iz],
        scale: [sc * 1.2, sc * 0.9, sc * 1.2],
        hex: ivyPalette[Math.floor(rand() * ivyPalette.length)],
      });
    }
    deadTrees.forEach((tr) => {
      for (let k = 0; k < 4; k++) {
        const a = rand() * Math.PI * 2;
        const sc = 0.55 + rand() * 0.5;
        ivyClusters.push({
          pos: [tr.pos[0] + Math.cos(a) * 0.24, 0.25 + k * 0.34, tr.pos[2] + Math.sin(a) * 0.24],
          scale: [sc, sc * 0.85, sc],
          hex: ivyPalette[k % ivyPalette.length],
        });
      }
    });

    // 260 scattered dead fallen leaves across cracked stone pathways, plaza, lawn & stagnant pool rim
    const deadLeaves: { pos: [number, number, number]; rotY: number; scale: number; hex: string }[] = [];
    const leafPalette = ['#4e3523', '#3a291d', '#634329', '#2f241c', '#59422a'];
    for (let i = 0; i < 260; i++) {
      let lx = (rand() - 0.5) * 23.8;
      let lz = (rand() - 0.5) * 23.8;
      let ly = 0.028 + (i % 4) * 0.003;
      const r = Math.hypot(lx, lz);
      if (r < 3.45) {
        // Float a handful of dead leaves on the dark stagnant fountain pool
        if (i % 5 === 0) {
          const a = rand() * Math.PI * 2;
          const pr = 1.65 + rand() * 1.75;
          lx = Math.cos(a) * pr;
          lz = Math.sin(a) * pr;
          ly = 0.455;
        } else {
          const a = rand() * Math.PI * 2;
          const pr = 4.45 + rand() * 4.5;
          lx = Math.cos(a) * pr;
          lz = Math.sin(a) * pr;
        }
      }
      deadLeaves.push({
        pos: [lx, ly, lz],
        rotY: rand() * Math.PI * 2,
        scale: 0.75 + rand() * 0.95,
        hex: leafPalette[Math.floor(rand() * leafPalette.length)],
      });
    }

    // 4 neglected stone & weathered wood benches (with 2 showing broken/tilted decay)
    const benches = [
      { pos: [-4.7, 0, -4.7] as [number, number, number], rotY: Math.PI / 4, broken: false, tiltZ: 0 },
      { pos: [4.7, 0, -4.7] as [number, number, number], rotY: -Math.PI / 4, broken: true, tiltZ: 0.14 },
      { pos: [-4.7, 0, 4.7] as [number, number, number], rotY: (3 * Math.PI) / 4, broken: true, tiltZ: -0.09 },
      { pos: [4.7, 0, 4.7] as [number, number, number], rotY: -(3 * Math.PI) / 4, broken: false, tiltZ: 0 },
    ];

    // 8 weathered courtyard lamp posts: 3 flickering haunted lights, 5 dead/damaged
    const lamps = [
      { pos: [-1.8, 0, -6.5] as [number, number, number], flickering: true, tint: '#8cbce0', seed: 1.3, tilted: 0 },
      { pos: [1.8, 0, 6.5] as [number, number, number], flickering: true, tint: '#8cc9ba', seed: 4.7, tilted: 0.04 },
      { pos: [-6.5, 0, 1.8] as [number, number, number], flickering: false, tint: '#000', seed: 0, tilted: -0.11 },
      { pos: [6.5, 0, -1.8] as [number, number, number], flickering: true, tint: '#8ab8d8', seed: 7.9, tilted: 0 },
      { pos: [-1.8, 0, -11.4] as [number, number, number], flickering: false, tint: '#000', seed: 0, tilted: 0.06 },
      { pos: [1.8, 0, 11.4] as [number, number, number], flickering: false, tint: '#000', seed: 0, tilted: 0 },
      { pos: [-11.4, 0, 1.8] as [number, number, number], flickering: false, tint: '#000', seed: 0, tilted: 0.13 },
      { pos: [11.4, 0, -1.8] as [number, number, number], flickering: false, tint: '#000', seed: 0, tilted: 0 },
    ];

    // Subtle ground mist sheets drifting low over the haunted lawn
    const mistSheets = [
      { pos: [-5.8, 0.34, -5.2] as [number, number, number], scale: 1.15, phase: 0.0 },
      { pos: [5.6, 0.42, -4.8] as [number, number, number], scale: 1.05, phase: 1.7 },
      { pos: [-5.2, 0.38, 5.8] as [number, number, number], scale: 1.12, phase: 3.1 },
      { pos: [5.8, 0.32, 5.4] as [number, number, number], scale: 1.2, phase: 4.6 },
      { pos: [0.0, 0.58, 0.0] as [number, number, number], scale: 1.35, phase: 2.2 },
    ];

    return { deadTrees, weeds, ivyClusters, deadLeaves, benches, lamps, mistSheets };
  }, []);

  // Subtle floating nocturnal mist motes (Points single draw call)
  const mistParticles = useMemo(() => {
    const rand = makeSeededRandom(31904);
    const count = 64;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 1.5 + rand() * 10.2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.4 + rand() * 3.8;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#9dbbc6',
      size: 0.065,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      sizeAttenuation: true,
    });
    return { geo, mat };
  }, []);

  useEffect(() => {
    return () => {
      textures.dispose();
      mats.dispose();
      geos.dispose();
      mistParticles.geo.dispose();
      mistParticles.mat.dispose();
    };
  }, [geos, mats, mistParticles, textures]);

  const weedRef = useRef<THREE.InstancedMesh>(null);
  const ivyRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const dripMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const rippleMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lampGlowRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const mistPlaneRefs = useRef<(THREE.Mesh | null)[]>([]);
  const flickerPointLightRef = useRef<THREE.PointLight>(null);
  const mistPointsRef = useRef<THREE.Points>(null);

  useLayoutEffect(() => {
    const wMesh = weedRef.current;
    if (wMesh) {
      layout.weeds.forEach((item, i) => {
        _dummy.position.set(item.pos[0], item.pos[1], item.pos[2]);
        _dummy.rotation.set(item.tilt, item.rotY, item.tilt * 0.5);
        _dummy.scale.set(item.scale[0], item.scale[1], item.scale[2]);
        _dummy.updateMatrix();
        wMesh.setMatrixAt(i, _dummy.matrix);
        _color.set(item.hex);
        wMesh.setColorAt(i, _color);
      });
      wMesh.instanceMatrix.needsUpdate = true;
      if (wMesh.instanceColor) wMesh.instanceColor.needsUpdate = true;
      wMesh.computeBoundingSphere();
    }

    const iMesh = ivyRef.current;
    if (iMesh) {
      layout.ivyClusters.forEach((item, i) => {
        _dummy.position.set(item.pos[0], item.pos[1], item.pos[2]);
        _dummy.rotation.set(i * 0.5, i * 1.1, 0);
        _dummy.scale.set(item.scale[0], item.scale[1], item.scale[2]);
        _dummy.updateMatrix();
        iMesh.setMatrixAt(i, _dummy.matrix);
        _color.set(item.hex);
        iMesh.setColorAt(i, _color);
      });
      iMesh.instanceMatrix.needsUpdate = true;
      if (iMesh.instanceColor) iMesh.instanceColor.needsUpdate = true;
      iMesh.computeBoundingSphere();
    }

    const lMesh = leafRef.current;
    if (lMesh) {
      layout.deadLeaves.forEach((item, i) => {
        _dummy.position.set(item.pos[0], item.pos[1], item.pos[2]);
        _dummy.rotation.set(-Math.PI / 2 + (i % 3 - 1) * 0.08, item.rotY, 0);
        _dummy.scale.setScalar(item.scale);
        _dummy.updateMatrix();
        lMesh.setMatrixAt(i, _dummy.matrix);
        _color.set(item.hex);
        lMesh.setColorAt(i, _color);
      });
      lMesh.instanceMatrix.needsUpdate = true;
      if (lMesh.instanceColor) lMesh.instanceColor.needsUpdate = true;
      lMesh.computeBoundingSphere();
    }
  }, [layout]);

  // Subtle intermittent water drips, faint dark pool ripples, flickering lamps & drifting ground mist (Zero GC!)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // 1. Slow occasional water drips falling from fountain bowls + subtle splash ripple
    for (let i = 0; i < dripSources.length; i++) {
      const src = dripSources[i];
      const drop = dripMeshRefs.current[i];
      const rip = rippleMeshRefs.current[i];
      const cycle = ((t + src.offset) % src.period) / src.period;

      // Drop forms briefly [0..0.14], falls with gravity [0.14..0.34], then ripples [0.34..0.68]
      if (drop) {
        if (cycle < 0.14) {
          const swell = cycle / 0.14;
          drop.visible = true;
          drop.position.set(src.x, src.startY - swell * 0.04, src.z);
          drop.scale.set(0.5 + swell * 0.5, 0.7 + swell * 0.7, 0.5 + swell * 0.5);
        } else if (cycle < 0.34) {
          const u = (cycle - 0.14) / 0.2;
          const y = src.startY - (src.startY - src.endY) * u * u;
          drop.visible = true;
          drop.position.set(src.x, y, src.z);
          drop.scale.set(0.75, 1.55, 0.75);
        } else {
          drop.visible = false;
        }
      }

      if (rip) {
        if (cycle >= 0.34 && cycle < 0.72) {
          const ru = (cycle - 0.34) / 0.38;
          rip.visible = true;
          const sc = 0.06 + ru * 0.52;
          rip.scale.set(sc, sc, 1);
          (rip.material as THREE.MeshBasicMaterial).opacity = (1 - ru) * 0.36;
        } else {
          rip.visible = false;
        }
      }
    }

    // 2. Occasional flickering haunted courtyard lamps (cool blue / pale green stutter)
    let lampSum = 0;
    let flickerIdx = 0;
    for (let i = 0; i < layout.lamps.length; i++) {
      const lamp = layout.lamps[i];
      if (!lamp.flickering) continue;
      const mat = lampGlowRefs.current[flickerIdx];
      const s = lamp.seed;
      const wave = Math.sin(t * 2.4 + s) * Math.sin(t * 11.3 + s * 1.7);
      const stutter = Math.sin(t * 1.1 + s) > 0.55 && wave > 0.32;
      const val = stutter ? 0.18 : 1.05 + 0.18 * Math.sin(t * 3.1 + s);
      if (mat) mat.emissiveIntensity = val;
      lampSum += val;
      flickerIdx++;
    }
    if (flickerPointLightRef.current) {
      flickerPointLightRef.current.intensity = 2.8 + lampSum * 0.65;
    }

    // 3. Slow drifting ground mist planes across the neglected garden
    for (let i = 0; i < layout.mistSheets.length; i++) {
      const m = mistPlaneRefs.current[i];
      if (!m) continue;
      const cfg = layout.mistSheets[i];
      m.position.x = cfg.pos[0] + Math.sin(t * 0.14 + cfg.phase) * 0.9;
      m.position.z = cfg.pos[2] + Math.cos(t * 0.11 + cfg.phase) * 0.8;
      m.rotation.z = t * 0.025 + cfg.phase;
    }
    if (mistPointsRef.current) {
      mistPointsRef.current.position.y = Math.sin(t * 0.28) * 0.18;
      mistPointsRef.current.rotation.y = t * 0.02;
    }
  });

  let lampGlowCounter = 0;

  return (
    <group position={[0, GARDEN_SURFACE_Y, 0]}>
      {/* ==================================================================== */}
      {/* 1. NEGLECTED EARTH, OVERGROWN LAWN & CRACKED STONE PATHWAYS          */}
      {/* ==================================================================== */}
      <mesh position={[0, -0.11, 0]} material={mats.ground} receiveShadow>
        <boxGeometry args={[GARDEN_SPAN, 0.22, GARDEN_SPAN]} />
      </mesh>

      {/* Cracked Weathered Central Fountain Plaza */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.crackedPath} receiveShadow>
        <circleGeometry args={[6.32, 40]} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.fountainStone} receiveShadow>
        <ringGeometry args={[6.18, 6.46, 40]} />
      </mesh>

      {/* Four Cracked Cardinal Stone Walkways */}
      <mesh position={[0, 0.012, 0]} material={mats.crackedPath} receiveShadow>
        <boxGeometry args={[2.25, 0.024, GARDEN_SPAN - 0.16]} />
      </mesh>
      <mesh position={[0, 0.012, 0]} material={mats.crackedPath} receiveShadow>
        <boxGeometry args={[GARDEN_SPAN - 0.16, 0.024, 2.25]} />
      </mesh>

      {/* A few crooked/cracked displaced stepping pavers along paths */}
      {[
        [-0.32, -8.4, 0.08],
        [0.45, 7.6, -0.12],
        [-8.1, 0.35, 0.1],
        [7.9, -0.4, -0.08],
      ].map(([px, pz, rot], idx) => (
        <mesh
          key={`crooked-slab-${idx}`}
          position={[px, 0.032, pz]}
          rotation={[0.03, rot, -0.02]}
          geometry={geos.crookedSlabGeo}
          material={mats.fountainStone}
          receiveShadow
        />
      ))}

      {/* ==================================================================== */}
      {/* 2. OLD, NEGLECTED & ABANDONED WEATHERED STONE FOUNTAIN               */}
      {/* ==================================================================== */}
      <group>
        {/* Dark weathered cracked outer stone basin */}
        <mesh geometry={geos.outerBasin} material={mats.fountainStone} castShadow receiveShadow />

        {/* Chipped / fallen stone coping fragment resting near fountain base */}
        <mesh position={[3.95, 0.12, 2.15]} rotation={[0.18, 0.6, 0.25]} material={mats.fountainStone} castShadow receiveShadow>
          <boxGeometry args={[0.68, 0.22, 0.38]} />
        </mesh>

        {/* Dark submerged inner pool floor */}
        <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.poolFloor} receiveShadow>
          <circleGeometry args={[3.56, 32]} />
        </mesh>

        {/* Weathered mossy Tier 1 & Tier 2 carved stone bowls */}
        <mesh geometry={geos.tier1Bowl} material={mats.fountainStone} castShadow receiveShadow />
        <mesh geometry={geos.tier2Bowl} material={mats.dampStone} castShadow receiveShadow />

        {/* Aged oxidized verdigris bronze finial crown */}
        <mesh position={[0, 4.08, 0]} material={mats.verdigrisBronze} castShadow>
          <cylinderGeometry args={[0.06, 0.14, 0.28, 10]} />
        </mesh>

        {/* Shallow Stagnant Dark Reflective Water Pool (recessed below outer rim) */}
        <mesh position={[0, 0.44, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.stagnantWater}>
          <circleGeometry args={[3.56, 36]} />
        </mesh>
        {/* Small stagnant puddles retained inside Tier 1 & Tier 2 bowls */}
        <mesh position={[0, 1.88, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.stagnantWater}>
          <circleGeometry args={[1.86, 24]} />
        </mesh>
        <mesh position={[0, 3.22, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.stagnantWater}>
          <circleGeometry args={[0.98, 20]} />
        </mesh>

        {/* Occasional Slow Water Dripping Effects + Subtle Expanding Dark Pool Ripples */}
        {dripSources.map((src, i) => (
          <React.Fragment key={`drip-${i}`}>
            <mesh
              ref={(el) => {
                dripMeshRefs.current[i] = el;
              }}
              position={[src.x, src.startY, src.z]}
              geometry={geos.dripGeo}
              material={mats.dripDrop}
            />
            <mesh
              ref={(el) => {
                rippleMeshRefs.current[i] = el;
              }}
              position={[src.x, src.endY + 0.012, src.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              geometry={geos.rippleGeo}
            >
              <meshBasicMaterial color="#8ebac2" transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Flickering Pale Green Haunted Courtyard Lamp Fill (main cool moonlight fill is provided by SceneEnvironment) */}
        <pointLight
          ref={flickerPointLightRef}
          position={[0.6, 2.2, 2.8]}
          color="#7cb8a8"
          intensity={3.6}
          distance={20}
          decay={1.45}
        />
      </group>

      {/* ==================================================================== */}
      {/* 3. DRY TWISTED DEAD TREES, WEEDS, DARK IVY & SCATTERED DEAD LEAVES   */}
      {/* ==================================================================== */}
      {layout.deadTrees.map((tree, idx) => {
        const treeGeo =
          tree.variant === 0
            ? geos.treeVariantA
            : tree.variant === 1
            ? geos.treeVariantB
            : geos.treeVariantC;
        return (
          <mesh
            key={`dead-tree-${idx}`}
            position={tree.pos}
            rotation={[0, tree.rotY, 0]}
            scale={tree.scale}
            geometry={treeGeo}
            material={mats.deadWood}
            castShadow
            receiveShadow
          />
        );
      })}

      {/* Overgrown Weeds & Dry Dead Plant Tufts */}
      <instancedMesh
        ref={weedRef}
        args={[geos.weedGeo, mats.weedMat, layout.weeds.length]}
      />

      {/* Dark Green Creeping Ivy */}
      <instancedMesh
        ref={ivyRef}
        args={[geos.ivyGeo, mats.ivyMat, layout.ivyClusters.length]}
        castShadow
        receiveShadow
      />

      {/* Scattered Fallen Dead Leaves */}
      <instancedMesh
        ref={leafRef}
        args={[geos.leafGeo, mats.deadLeafMat, layout.deadLeaves.length]}
        receiveShadow
      />

      {/* ==================================================================== */}
      {/* 4. BROKEN GARDEN DECORATIONS — NEGLECTED BENCHES, TOPPLED URNS, LAMPS*/}
      {/* ==================================================================== */}
      {layout.benches.map((bench, idx) => (
        <group
          key={`haunted-bench-${idx}`}
          position={bench.pos}
          rotation={[0, bench.rotY, bench.tiltZ]}
        >
          <mesh position={[-0.66, 0.22, 0]} material={mats.fountainStone} castShadow receiveShadow>
            <boxGeometry args={[0.16, 0.44, 0.52]} />
          </mesh>
          <mesh
            position={[0.66, bench.broken ? 0.16 : 0.22, 0]}
            rotation={[0, 0, bench.broken ? 0.28 : 0]}
            material={mats.fountainStone}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.16, 0.44, 0.52]} />
          </mesh>
          <mesh position={[0, 0.45, 0]} material={mats.benchWood} castShadow receiveShadow>
            <boxGeometry args={[1.64, 0.08, 0.56]} />
          </mesh>
          {/* Broken bench loses or skews backrest */}
          <mesh
            position={[bench.broken ? -0.25 : 0, 0.76, -0.23]}
            rotation={[-0.16, 0, bench.broken ? -0.18 : 0]}
            material={mats.benchWood}
            castShadow
          >
            <boxGeometry args={[bench.broken ? 1.05 : 1.64, 0.3, 0.07]} />
          </mesh>
        </group>
      ))}

      {/* Toppled & Cracked Stone Garden Urns + Fallen Broken Statue Fragments */}
      {[
        { pos: [-6.8, 0.34, -3.2] as [number, number, number], rot: [Math.PI * 0.48, 0.5, 0.2] as [number, number, number] },
        { pos: [6.7, 0.34, 3.6] as [number, number, number], rot: [Math.PI * 0.46, -1.1, -0.15] as [number, number, number] },
      ].map((urn, idx) => (
        <group key={`broken-urn-${idx}`} position={urn.pos}>
          <mesh geometry={geos.urnGeo} rotation={urn.rot} material={mats.fountainStone} castShadow receiveShadow />
          <mesh position={[0.45, -0.31, 0.28]} rotation={[-Math.PI / 2, 0, 0]} material={mats.soilMat}>
            <circleGeometry args={[0.58, 12]} />
          </mesh>
        </group>
      ))}

      {/* Chipped & mossy broken garden statue plinth + fallen torso fragment */}
      <group position={[-3.9, 0, 3.8]} rotation={[0, 0.72, 0]}>
        <mesh position={[0, 0.34, 0]} material={mats.fountainStone} castShadow receiveShadow>
          <boxGeometry args={[0.88, 0.68, 0.88]} />
        </mesh>
        <mesh position={[0, 0.74, 0]} material={mats.dampStone} castShadow receiveShadow>
          <boxGeometry args={[0.98, 0.14, 0.98]} />
        </mesh>
        <mesh position={[0.82, 0.18, 0.36]} rotation={[1.38, 0.42, 0.6]} material={mats.fountainStone} castShadow receiveShadow>
          <cylinderGeometry args={[0.2, 0.28, 0.85, 8]} />
        </mesh>
        <mesh position={[0.55, 0.12, -0.22]} rotation={[0.4, 0.9, 0.2]} material={mats.dampStone} castShadow>
          <dodecahedronGeometry args={[0.18, 0]} />
        </mesh>
      </group>

      {/* Weathered Courtyard Lamp Posts (mix of dead, tilted & dim flickering lights) */}
      {layout.lamps.map((lamp, idx) => {
        const myGlowIdx = lamp.flickering ? lampGlowCounter++ : -1;
        return (
          <group key={`courtyard-lamp-${idx}`} position={lamp.pos} rotation={[0, 0, lamp.tilted]}>
            <mesh position={[0, 0.14, 0]} geometry={geos.lampBaseGeo} material={mats.fountainStone} receiveShadow />
            <mesh position={[0, 0.96, 0]} geometry={geos.lampPostGeo} material={mats.agedIron} castShadow />
            {lamp.flickering ? (
              <mesh position={[0, 1.78, 0]} geometry={geos.lampGlassGeo}>
                <meshStandardMaterial
                  ref={(el) => {
                    lampGlowRefs.current[myGlowIdx] = el;
                  }}
                  color={lamp.tint}
                  emissive={lamp.tint}
                  emissiveIntensity={1.05}
                  roughness={0.3}
                />
              </mesh>
            ) : (
              <mesh position={[0, 1.78, 0]} geometry={geos.lampGlassGeo} material={mats.deadLanternGlass} />
            )}
            <mesh
              position={[0, 2.0, 0]}
              rotation={[lamp.tilted * 1.4, Math.PI / 4, 0]}
              geometry={geos.lampCapGeo}
              material={mats.agedIron}
              castShadow
            />
          </group>
        );
      })}

      {/* ==================================================================== */}
      {/* 5. SUBTLE DRIFTING GROUND FOG / MIST LAYER                           */}
      {/* ==================================================================== */}
      {layout.mistSheets.map((sheet, idx) => (
        <mesh
          key={`ground-mist-${idx}`}
          ref={(el) => {
            mistPlaneRefs.current[idx] = el;
          }}
          position={sheet.pos}
          rotation={[-Math.PI / 2, 0, sheet.phase]}
          scale={sheet.scale}
          geometry={geos.mistPlaneGeo}
          material={mats.mistMat}
        />
      ))}

      <points ref={mistPointsRef} geometry={mistParticles.geo} material={mistParticles.mat} frustumCulled={false} />
    </group>
  );
});
