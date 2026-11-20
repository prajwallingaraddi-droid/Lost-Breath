import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  COMPOUND_BOUNDS,
  EXTERIOR_HERO_TREES,
  EXTERIOR_STATUE_POSITIONS,
} from '../../data/buildingLayout';

function makeSeededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createWeatheredBillboardTexture(
  variant: 'portrait-top' | 'theatrical-mid' | 'cream-banner' | 'crimson-banner',
  seed: number
): THREE.CanvasTexture {
  const rand = makeSeededRand(seed);
  const canvas = document.createElement('canvas');
  canvas.width = variant.includes('banner') ? 512 : 384;
  canvas.height = variant.includes('banner') ? 192 : 448;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  if (variant === 'portrait-top') {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#c8b4a4');
    bg.addColorStop(0.68, '#8d7569');
    bg.addColorStop(1, '#584a45');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Painted weathered portrait silhouette
    ctx.fillStyle = '#3d2825';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.36, 76, 98, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d7b5a1';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.34, 46, 58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4e332e';
    ctx.fillRect(w * 0.41, h * 0.28, 22, 9);
    ctx.fillRect(w * 0.54, h * 0.28, 22, 9);
    ctx.fillStyle = '#533530';
    ctx.fillRect(w * 0.3, h * 0.52, w * 0.4, h * 0.16);

    // Lower distressed placard strip
    ctx.fillStyle = '#d6c8b6';
    ctx.fillRect(16, h * 0.72, w - 32, h * 0.22);
    ctx.fillStyle = '#2d2320';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLITUDE', w * 0.5, h * 0.87);
  } else if (variant === 'theatrical-mid') {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#4d5350');
    bg.addColorStop(0.55, '#8c8378');
    bg.addColorStop(1, '#2f3231');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Dramatic diagonal spotlight & figure silhouette
    ctx.fillStyle = '#cbbba6';
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.9);
    ctx.lineTo(w * 0.44, h * 0.16);
    ctx.lineTo(w * 0.74, h * 0.24);
    ctx.lineTo(w * 0.82, h * 0.9);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2b2421';
    ctx.beginPath();
    ctx.ellipse(w * 0.48, h * 0.29, 34, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.24, h * 0.92);
    ctx.lineTo(w * 0.36, h * 0.39);
    ctx.lineTo(w * 0.62, h * 0.42);
    ctx.lineTo(w * 0.72, h * 0.92);
    ctx.closePath();
    ctx.fill();

    // Faded red margin label on left edge
    ctx.fillStyle = '#6f2622';
    ctx.fillRect(10, 14, 34, h - 28);
  } else if (variant === 'cream-banner') {
    ctx.fillStyle = '#cfc5b2';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#3b332d';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#4f382e';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('GRAND THEATRE', w * 0.5, h * 0.58);
  } else {
    ctx.fillStyle = '#241c1a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#732924';
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#a8342d';
    ctx.font = 'bold 46px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('METROPOLE', w * 0.5, h * 0.46);
    ctx.fillStyle = '#d39f89';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText('CABARET', w * 0.5, h * 0.76);
  }

  // Heavy rain streaks, peeling paper patches & grime
  for (let i = 0; i < 48; i++) {
    const px = rand() * w;
    const py = rand() * h;
    const rw = 10 + rand() * 44;
    const rh = 18 + rand() * 88;
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(34, 31, 26, 0.28)' : 'rgba(176, 166, 146, 0.22)';
    ctx.fillRect(px, py, rw, rh);
  }
  for (let i = 0; i < 24; i++) {
    const sx = rand() * w;
    ctx.fillStyle = 'rgba(26, 28, 22, 0.34)';
    ctx.fillRect(sx, 0, 2 + rand() * 4, h * (0.4 + rand() * 0.6));
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createCityResources() {
  const rand = makeSeededRand(74102);

  // 1. Cracked Asphalt Street Texture + Bump Map
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 512;
  const rCtx = roadCanvas.getContext('2d')!;
  rCtx.fillStyle = '#58595b';
  rCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 95; i++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const rad = 16 + rand() * 58;
    const g = rCtx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    g.addColorStop(0, rand() > 0.45 ? 'rgba(42, 43, 45, 0.34)' : 'rgba(116, 114, 108, 0.26)');
    g.addColorStop(1, 'rgba(88, 89, 91, 0)');
    rCtx.fillStyle = g;
    rCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  // Faded weathered white lane markings
  rCtx.fillStyle = 'rgba(208, 206, 198, 0.38)';
  for (let y = 16; y < 512; y += 92) {
    rCtx.fillRect(250, y, 10, 44);
  }
  rCtx.fillStyle = 'rgba(195, 192, 182, 0.25)';
  rCtx.fillRect(28, 0, 7, 512);
  rCtx.fillRect(476, 0, 7, 512);

  // Dark meandering fissures across asphalt
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#888888';
  bCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) {
    const v = 112 + Math.floor(rand() * 44);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(rand() * 512, rand() * 512, 2, 2);
  }
  for (let c = 0; c < 34; c++) {
    let cx = rand() * 512;
    let cy = rand() * 512;
    rCtx.strokeStyle = 'rgba(24, 25, 24, 0.78)';
    rCtx.lineWidth = 1.4 + rand() * 1.4;
    bCtx.strokeStyle = '#202020';
    bCtx.lineWidth = 2.2;
    rCtx.beginPath();
    bCtx.beginPath();
    rCtx.moveTo(cx, cy);
    bCtx.moveTo(cx, cy);
    for (let s = 0; s < 6; s++) {
      cx += (rand() - 0.5) * 44;
      cy += (rand() - 0.5) * 44;
      rCtx.lineTo(cx, cy);
      bCtx.lineTo(cx, cy);
    }
    rCtx.stroke();
    bCtx.stroke();
  }

  const roadTex = new THREE.CanvasTexture(roadCanvas);
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(2, 4);
  roadTex.colorSpace = THREE.SRGBColorSpace;
  roadTex.anisotropy = 4;

  const roadBump = new THREE.CanvasTexture(bumpCanvas);
  roadBump.wrapS = THREE.RepeatWrapping;
  roadBump.wrapT = THREE.RepeatWrapping;
  roadBump.repeat.set(2, 4);

  // 2. Broken Concrete Pavement Texture
  const walkCanvas = document.createElement('canvas');
  walkCanvas.width = 512;
  walkCanvas.height = 512;
  const wCtx = walkCanvas.getContext('2d')!;
  wCtx.fillStyle = '#979489';
  wCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 64) {
      const shade = 136 + Math.floor(rand() * 32);
      wCtx.fillStyle = `rgb(${shade}, ${shade - 3}, ${shade - 10})`;
      wCtx.fillRect(x + 2, y + 2, 60, 60);
    }
  }
  for (let c = 0; c < 36; c++) {
    let cx = rand() * 512;
    let cy = rand() * 512;
    wCtx.strokeStyle = 'rgba(34, 38, 28, 0.72)';
    wCtx.lineWidth = 2.0;
    wCtx.beginPath();
    wCtx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (rand() - 0.5) * 38;
      cy += (rand() - 0.5) * 38;
      wCtx.lineTo(cx, cy);
    }
    wCtx.stroke();
  }
  const walkTex = new THREE.CanvasTexture(walkCanvas);
  walkTex.wrapS = THREE.RepeatWrapping;
  walkTex.wrapT = THREE.RepeatWrapping;
  walkTex.repeat.set(3, 6);
  walkTex.colorSpace = THREE.SRGBColorSpace;
  walkTex.anisotropy = 4;

  // 3. Weathered Pre-War Brick & Window Grid Facade (Warm Tan / Brownstone)
  const buildFacadeTexture = (
    baseHex: string,
    trimHex: string,
    cols: number,
    rows: number,
    facadeSeed: number
  ) => {
    const fRand = makeSeededRand(facadeSeed);
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 1024;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 1024);

    // Masonry courses & weathering streaks
    for (let i = 0; i < 60; i++) {
      const px = fRand() * 512;
      const py = fRand() * 1024;
      const rw = 24 + fRand() * 68;
      const rh = 30 + fRand() * 120;
      ctx.fillStyle =
        fRand() > 0.5 ? 'rgba(34, 30, 26, 0.16)' : 'rgba(218, 208, 190, 0.12)';
      ctx.fillRect(px, py, rw, rh);
    }

    const colW = 512 / cols;
    const rowH = 1024 / rows;
    for (let r = 0; r < rows; r++) {
      // Belt cornice line every 3 floors
      if (r % 3 === 0) {
        ctx.fillStyle = trimHex;
        ctx.fillRect(0, r * rowH, 512, 8);
      }
      for (let col = 0; col < cols; col++) {
        const wx = col * colW + colW * 0.22;
        const wy = r * rowH + rowH * 0.22;
        const ww = colW * 0.56;
        const wh = rowH * 0.62;
        // Stone window sill & lintel
        ctx.fillStyle = trimHex;
        ctx.fillRect(wx - 4, wy - 6, ww + 8, 7);
        ctx.fillRect(wx - 4, wy + wh, ww + 8, 7);
        // Dark empty/broken interior window pane
        const broken = fRand() > 0.72;
        ctx.fillStyle = broken ? '#171c20' : '#26313a';
        ctx.fillRect(wx, wy, ww, wh);
        // Subtle sky reflection on intact panes
        if (!broken) {
          ctx.fillStyle = 'rgba(130, 158, 180, 0.22)';
          ctx.fillRect(wx + 3, wy + 3, ww * 0.42, wh * 0.45);
        }
        // Mullion frame
        ctx.strokeStyle = '#3f3d39';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, ww, wh);
        ctx.beginPath();
        ctx.moveTo(wx + ww * 0.5, wy);
        ctx.lineTo(wx + ww * 0.5, wy + wh);
        ctx.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  const brickFacadeTex = buildFacadeTexture('#8c7868', '#a89f92', 6, 10, 5011);
  const stoneTowerTex = buildFacadeTexture('#7c8083', '#9fa3a6', 7, 13, 5022);
  const redBrickTex = buildFacadeTexture('#795d52', '#9c9286', 5, 9, 5033);

  const billTopTex = createWeatheredBillboardTexture('portrait-top', 8101);
  const billMidTex = createWeatheredBillboardTexture('theatrical-mid', 8102);
  const billCreamTex = createWeatheredBillboardTexture('cream-banner', 8103);
  const billRedTex = createWeatheredBillboardTexture('crimson-banner', 8104);

  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    bumpMap: roadBump,
    bumpScale: 0.045,
    roughness: 0.9,
    metalness: 0.04,
  });
  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: walkTex,
    roughness: 0.93,
    metalness: 0.02,
  });
  const outerEarthMat = new THREE.MeshStandardMaterial({
    color: '#3f4538',
    roughness: 0.96,
    metalness: 0.01,
  });
  const brickFacadeMat = new THREE.MeshStandardMaterial({
    map: brickFacadeTex,
    roughness: 0.88,
    metalness: 0.04,
  });
  const stoneTowerMat = new THREE.MeshStandardMaterial({
    map: stoneTowerTex,
    roughness: 0.78,
    metalness: 0.12,
  });
  const redBrickMat = new THREE.MeshStandardMaterial({
    map: redBrickTex,
    roughness: 0.89,
    metalness: 0.04,
  });
  const shopWindowMat = new THREE.MeshStandardMaterial({
    color: '#181e22',
    roughness: 0.28,
    metalness: 0.35,
  });
  const stoneTrimMat = new THREE.MeshStandardMaterial({
    color: '#8e897f',
    roughness: 0.9,
    metalness: 0.04,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: '#2c2f32',
    roughness: 0.6,
    metalness: 0.68,
  });
  const statueStoneMat = new THREE.MeshStandardMaterial({
    color: '#9b9689',
    roughness: 0.91,
    metalness: 0.03,
  });
  const barkMat = new THREE.MeshStandardMaterial({
    color: '#483b31',
    roughness: 0.96,
    metalness: 0.02,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.88,
    metalness: 0.02,
  });
  const weedMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.86,
    metalness: 0.02,
  });
  const ivyMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.87,
    metalness: 0.02,
  });
  const awningA = new THREE.MeshStandardMaterial({ color: '#5c312b', roughness: 0.9 });
  const awningB = new THREE.MeshStandardMaterial({ color: '#394638', roughness: 0.9 });
  const billTopMat = new THREE.MeshStandardMaterial({ map: billTopTex, roughness: 0.85 });
  const billMidMat = new THREE.MeshStandardMaterial({ map: billMidTex, roughness: 0.85 });
  const billCreamMat = new THREE.MeshStandardMaterial({ map: billCreamTex, roughness: 0.86 });
  const billRedMat = new THREE.MeshStandardMaterial({ map: billRedTex, roughness: 0.86 });

  return {
    roadMat,
    sidewalkMat,
    outerEarthMat,
    brickFacadeMat,
    stoneTowerMat,
    redBrickMat,
    shopWindowMat,
    stoneTrimMat,
    darkMetalMat,
    statueStoneMat,
    barkMat,
    canopyMat,
    weedMat,
    ivyMat,
    awningA,
    awningB,
    billTopMat,
    billMidMat,
    billCreamMat,
    billRedMat,
    dispose: () => {
      roadTex.dispose();
      roadBump.dispose();
      walkTex.dispose();
      brickFacadeTex.dispose();
      stoneTowerTex.dispose();
      redBrickTex.dispose();
      billTopTex.dispose();
      billMidTex.dispose();
      billCreamTex.dispose();
      billRedTex.dispose();
      roadMat.dispose();
      sidewalkMat.dispose();
      outerEarthMat.dispose();
      brickFacadeMat.dispose();
      stoneTowerMat.dispose();
      redBrickMat.dispose();
      shopWindowMat.dispose();
      stoneTrimMat.dispose();
      darkMetalMat.dispose();
      statueStoneMat.dispose();
      barkMat.dispose();
      canopyMat.dispose();
      weedMat.dispose();
      ivyMat.dispose();
      awningA.dispose();
      awningB.dispose();
      billTopMat.dispose();
      billMidMat.dispose();
      billCreamMat.dispose();
      billRedMat.dispose();
    },
  };
}

/**
 * Outer distant city ground ring outside [-46, +46] so it never Z-fights with the compound yard.
 */
function createOuterGroundGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-190, -190);
  shape.lineTo(190, -190);
  shape.lineTo(190, 190);
  shape.lineTo(-190, 190);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(COMPOUND_BOUNDS.minX - 0.04, COMPOUND_BOUNDS.minZ - 0.04);
  hole.lineTo(COMPOUND_BOUNDS.maxX + 0.04, COMPOUND_BOUNDS.minZ - 0.04);
  hole.lineTo(COMPOUND_BOUNDS.maxX + 0.04, COMPOUND_BOUNDS.maxZ + 0.04);
  hole.lineTo(COMPOUND_BOUNDS.minX - 0.04, COMPOUND_BOUNDS.maxZ + 0.04);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -0.24, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Single merged BufferGeometry combining all exterior tree trunks, main boughs,
 * and gnarled exposed pavement roots breaking around statues and tree bases.
 */
function createMergedTreeTrunksAndExposedRoots(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rand = makeSeededRand(20488);

  for (let i = 0; i < EXTERIOR_HERO_TREES.length; i++) {
    const t = EXTERIOR_HERO_TREES[i];
    const h = 4.6 * t.scale;

    // Main curved organic trunk
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(t.x, -0.05, t.z),
      new THREE.Vector3(t.x + (rand() - 0.5) * 0.35, h * 0.45, t.z + (rand() - 0.5) * 0.35),
      new THREE.Vector3(t.x + (rand() - 0.5) * 0.5, h, t.z + (rand() - 0.5) * 0.5),
    ]);
    parts.push(new THREE.TubeGeometry(trunkCurve, 6, t.trunkRadius * 0.72, 6, false));

    // 3 ascending canopy boughs
    for (let b = 0; b < 3; b++) {
      const ang = t.rotY + b * ((Math.PI * 2) / 3) + (rand() - 0.5) * 0.35;
      const spread = 1.9 * t.scale;
      const bCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(t.x, h * 0.68, t.z),
        new THREE.Vector3(t.x + Math.cos(ang) * spread * 0.55, h * 0.92, t.z + Math.sin(ang) * spread * 0.55),
        new THREE.Vector3(t.x + Math.cos(ang) * spread, h * 1.18, t.z + Math.sin(ang) * spread),
      ]);
      parts.push(new THREE.TubeGeometry(bCurve, 5, t.trunkRadius * 0.32, 5, false));
    }

    // 4 exposed gnarled surface roots breaking pavement around the trunk
    for (let r = 0; r < 4; r++) {
      const ang = t.rotY + r * (Math.PI / 2) + (rand() - 0.5) * 0.5;
      const len = (1.6 + rand() * 1.4) * t.scale;
      const rCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(t.x + Math.cos(ang) * 0.25, 0.32, t.z + Math.sin(ang) * 0.25),
        new THREE.Vector3(t.x + Math.cos(ang) * len * 0.52, 0.14, t.z + Math.sin(ang) * len * 0.52),
        new THREE.Vector3(t.x + Math.cos(ang + 0.18) * len, -0.02, t.z + Math.sin(ang + 0.18) * len),
      ]);
      parts.push(new THREE.TubeGeometry(rCurve, 6, 0.085 * t.scale, 5, false));
    }
  }

  // Prominent exposed root clusters erupting around the classical street statues (as in reference)
  for (let sIdx = 0; sIdx < EXTERIOR_STATUE_POSITIONS.length; sIdx++) {
    const st = EXTERIOR_STATUE_POSITIONS[sIdx];
    for (let r = 0; r < 7; r++) {
      const ang = r * ((Math.PI * 2) / 7) + sIdx * 0.45;
      const reach = 1.9 + rand() * 1.8;
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(st.x + Math.cos(ang) * 0.45, 0.18, st.z + Math.sin(ang) * 0.45),
        new THREE.Vector3(
          st.x + Math.cos(ang + 0.12) * reach * 0.55,
          0.11 + rand() * 0.06,
          st.z + Math.sin(ang + 0.12) * reach * 0.55
        ),
        new THREE.Vector3(
          st.x + Math.cos(ang - 0.15) * reach,
          0.0,
          st.z + Math.sin(ang - 0.15) * reach
        ),
      ]);
      parts.push(new THREE.TubeGeometry(rootCurve, 7, 0.07 + rand() * 0.035, 5, false));
    }
  }

  const nonIndexed = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(nonIndexed, false);
  parts.forEach((g) => g.dispose());
  nonIndexed.forEach((g) => g.dispose());
  return merged;
}

const WeatheredStatue: React.FC<{
  x: number;
  z: number;
  rotY: number;
  scale: number;
  pose: 'robed' | 'scholar' | 'sentinel';
  stoneMat: THREE.Material;
}> = React.memo(({ x, z, rotY, scale, pose, stoneMat }) => {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]} scale={[scale, scale, scale]}>
      {/* Stepped stone plinth & classical pedestal */}
      <mesh position={[0, 0.16, 0]} material={stoneMat} castShadow receiveShadow>
        <boxGeometry args={[1.45, 0.32, 1.45]} />
      </mesh>
      <mesh position={[0, 0.92, 0]} material={stoneMat} castShadow receiveShadow>
        <boxGeometry args={[1.05, 1.24, 1.05]} />
      </mesh>
      <mesh position={[0, 1.62, 0]} material={stoneMat} castShadow receiveShadow>
        <boxGeometry args={[1.24, 0.18, 1.24]} />
      </mesh>

      {/* Draped classical figure */}
      <group position={[0, 1.71, 0]}>
        <mesh position={[0, 0.55, 0]} material={stoneMat} castShadow>
          <cylinderGeometry args={[0.24, 0.38, 1.12, 10]} />
        </mesh>
        <mesh position={[0, 1.28, 0]} material={stoneMat} castShadow>
          <cylinderGeometry args={[0.21, 0.25, 0.44, 10]} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.64, 0.02]} material={stoneMat} castShadow>
          <sphereGeometry args={[0.16, 10, 10]} />
        </mesh>
        {/* Pose arm */}
        <mesh
          position={[pose === 'sentinel' ? 0.22 : -0.22, 1.18, 0.14]}
          rotation={[pose === 'robed' ? -0.55 : -0.85, 0, pose === 'sentinel' ? -0.32 : 0.28]}
          material={stoneMat}
          castShadow
        >
          <cylinderGeometry args={[0.06, 0.075, 0.58, 7]} />
        </mesh>
        {pose === 'sentinel' && (
          <mesh position={[0.26, 0.92, 0.26]} material={stoneMat} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 1.78, 6]} />
          </mesh>
        )}
      </group>
    </group>
  );
});

export const AbandonedCityExterior: React.FC = React.memo(() => {
  const res = useMemo(() => createCityResources(), []);
  const outerGroundGeo = useMemo(() => createOuterGroundGeometry(), []);
  const trunkRootsGeo = useMemo(() => createMergedTreeTrunksAndExposedRoots(), []);
  const canopyGeo = useMemo(() => new THREE.DodecahedronGeometry(1.42, 1), []);
  const weedGeo = useMemo(() => new THREE.ConeGeometry(0.18, 0.72, 4), []);
  const ivyGeo = useMemo(() => new THREE.DodecahedronGeometry(0.55, 0), []);

  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const weedRef = useRef<THREE.InstancedMesh>(null);
  const ivyRef = useRef<THREE.InstancedMesh>(null);

  const foliageLayout = useMemo(() => {
    const rand = makeSeededRand(99217);

    // Lush canopy blobs across all 16 mature trees (~14 puffs per tree)
    const canopyColors = ['#3c5a27', '#4b6e32', '#2f4820', '#587c3b', '#3e5e2b'];
    const canopies: {
      pos: [number, number, number];
      scale: [number, number, number];
      hex: string;
    }[] = [];

    for (const t of EXTERIOR_HERO_TREES) {
      const topY = 5.4 * t.scale;
      for (let c = 0; c < 14; c++) {
        const ang = (c / 14) * Math.PI * 2 + rand() * 0.4;
        const rad = c === 0 ? 0.3 : (0.9 + rand() * 1.9) * t.scale;
        const dy = c === 0 ? 1.1 * t.scale : (rand() - 0.35) * 1.9 * t.scale;
        const s = (0.78 + rand() * 0.65) * t.scale;
        canopies.push({
          pos: [t.x + Math.cos(ang) * rad, topY + dy, t.z + Math.sin(ang) * rad],
          scale: [s * 1.18, s * 0.88, s * 1.12],
          hex: canopyColors[Math.floor(rand() * canopyColors.length)],
        });
      }
    }

    // Wild grass & weed clumps erupting from asphalt road cracks & broken sidewalks (avoid center walking lane)
    const weedColors = ['#4d6b2f', '#607d39', '#3d5824', '#6b753b'];
    const weeds: { pos: [number, number, number]; scale: number; rotY: number; hex: string }[] = [];
    // Intentional dense median clumps like the reference avenue
    const weedClusters: [number, number, number][] = [
      [-13.5, 53.5, 22],
      [-13.5, 62.5, 26],
      [-14.2, 71.0, 24],
      [-28.2, 56.0, 22],
      [-28.2, 67.5, 24],
      [-28.2, 79.0, 26],
      [-24.2, 84.5, 20],
      [-16.8, 86.0, 20],
      [-8.5, 55.0, 18],
      [-8.5, 74.0, 18],
    ];
    for (const [cx, cz, count] of weedClusters) {
      for (let i = 0; i < count; i++) {
        weeds.push({
          pos: [cx + (rand() - 0.5) * 2.8, 0.16, cz + (rand() - 0.5) * 3.4],
          scale: 0.72 + rand() * 1.05,
          rotY: rand() * Math.PI * 2,
          hex: weedColors[Math.floor(rand() * weedColors.length)],
        });
      }
    }
    // Scattered crack weeds along sidewalk seams
    for (let i = 0; i < 160; i++) {
      const side = rand() > 0.5;
      const wx = side ? -35.8 + rand() * 7.8 : -10.5 + rand() * 13.4;
      const wz = 47.0 + rand() * 44.0;
      weeds.push({
        pos: [wx, 0.17, wz],
        scale: 0.65 + rand() * 0.9,
        rotY: rand() * Math.PI * 2,
        hex: weedColors[Math.floor(rand() * weedColors.length)],
      });
    }

    // Dense climbing ivy draping down the Left (West) and Right (East) urban facades
    const ivy: { pos: [number, number, number]; scale: [number, number, number]; hex: string }[] = [];
    for (let i = 0; i < 190; i++) {
      const x = -36.25;
      const z = 47.5 + rand() * 45.0;
      const y = 3.5 + rand() * 32.0;
      const sc = 0.65 + rand() * 1.15;
      ivy.push({
        pos: [x, y, z],
        scale: [sc * 0.65, sc * 1.25, sc * 1.1],
        hex: canopyColors[Math.floor(rand() * canopyColors.length)],
      });
    }
    for (let i = 0; i < 120; i++) {
      const x = 3.3;
      const z = 48.0 + rand() * 44.0;
      const y = 4.0 + rand() * 34.0;
      const sc = 0.65 + rand() * 1.1;
      ivy.push({
        pos: [x, y, z],
        scale: [sc * 0.65, sc * 1.25, sc * 1.1],
        hex: canopyColors[Math.floor(rand() * canopyColors.length)],
      });
    }

    // Cracked tilted pavement slabs across foreground & sidewalks
    const crackedSlabs: { pos: [number, number, number]; rot: [number, number, number]; size: [number, number] }[] = [];
    for (let i = 0; i < 34; i++) {
      const sx = -33.5 + rand() * 35.0;
      const sz = 50.0 + rand() * 38.0;
      if (sx > -23.4 && sx < -17.6 && sz < 86.0) continue; // Keep clear player spawn/walk path
      crackedSlabs.push({
        pos: [sx, 0.036, sz],
        rot: [(rand() - 0.5) * 0.07, rand() * Math.PI, (rand() - 0.5) * 0.07],
        size: [0.9 + rand() * 1.3, 0.8 + rand() * 1.1],
      });
    }

    return { canopies, weeds, ivy, crackedSlabs };
  }, []);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    if (canopyRef.current) {
      foliageLayout.canopies.forEach((c, idx) => {
        dummy.position.set(c.pos[0], c.pos[1], c.pos[2]);
        dummy.rotation.set(idx * 0.2, idx * 0.5, 0);
        dummy.scale.set(c.scale[0], c.scale[1], c.scale[2]);
        dummy.updateMatrix();
        canopyRef.current!.setMatrixAt(idx, dummy.matrix);
        col.set(c.hex);
        canopyRef.current!.setColorAt(idx, col);
      });
      canopyRef.current.instanceMatrix.needsUpdate = true;
      if (canopyRef.current.instanceColor) canopyRef.current.instanceColor.needsUpdate = true;
    }

    if (weedRef.current) {
      foliageLayout.weeds.forEach((w, idx) => {
        dummy.position.set(w.pos[0], w.pos[1], w.pos[2]);
        dummy.rotation.set((idx % 3) * 0.14, w.rotY, ((idx + 1) % 3) * 0.12);
        dummy.scale.set(w.scale, w.scale * 1.1, w.scale);
        dummy.updateMatrix();
        weedRef.current!.setMatrixAt(idx, dummy.matrix);
        col.set(w.hex);
        weedRef.current!.setColorAt(idx, col);
      });
      weedRef.current.instanceMatrix.needsUpdate = true;
      if (weedRef.current.instanceColor) weedRef.current.instanceColor.needsUpdate = true;
    }

    if (ivyRef.current) {
      foliageLayout.ivy.forEach((iv, idx) => {
        dummy.position.set(iv.pos[0], iv.pos[1], iv.pos[2]);
        dummy.rotation.set(0, idx * 0.4, 0);
        dummy.scale.set(iv.scale[0], iv.scale[1], iv.scale[2]);
        dummy.updateMatrix();
        ivyRef.current!.setMatrixAt(idx, dummy.matrix);
        col.set(iv.hex);
        ivyRef.current!.setColorAt(idx, col);
      });
      ivyRef.current.instanceMatrix.needsUpdate = true;
      if (ivyRef.current.instanceColor) ivyRef.current.instanceColor.needsUpdate = true;
    }
  }, [foliageLayout]);

  useEffect(() => {
    return () => {
      outerGroundGeo.dispose();
      trunkRootsGeo.dispose();
      canopyGeo.dispose();
      weedGeo.dispose();
      ivyGeo.dispose();
      res.dispose();
    };
  }, [canopyGeo, ivyGeo, outerGroundGeo, res, trunkRootsGeo, weedGeo]);

  return (
    <group>
      {/* 1. Outer Horizon Earth Apron (strictly outside [-46, +46] compound) */}
      <mesh geometry={outerGroundGeo} material={res.outerEarthMat} receiveShadow />

      {/* 2. Explorable Cracked Asphalt Avenue (Z = 46..96, connecting flush to Single Gate at Z = 46) */}
      <mesh position={[-16.5, -0.015, 71.0]} rotation={[-Math.PI / 2, 0, 0]} material={res.roadMat} receiveShadow>
        <planeGeometry args={[40.0, 50.0]} />
      </mesh>

      {/* Broken Concrete Sidewalks & South Forecourt Apron */}
      <mesh position={[-32.25, 0.015, 71.0]} material={res.sidewalkMat} receiveShadow>
        <boxGeometry args={[8.5, 0.06, 50.0]} />
      </mesh>
      <mesh position={[-3.25, 0.015, 71.0]} material={res.sidewalkMat} receiveShadow>
        <boxGeometry args={[13.5, 0.06, 50.0]} />
      </mesh>
      <mesh position={[-16.5, 0.008, 90.8]} material={res.sidewalkMat} receiveShadow>
        <boxGeometry args={[40.0, 0.05, 10.4]} />
      </mesh>

      {/* Tilted Cracked Concrete Slabs Breaking Up the Forecourt & Sidewalks */}
      {foliageLayout.crackedSlabs.map((slab, idx) => (
        <mesh
          key={`slab-${idx}`}
          position={slab.pos}
          rotation={slab.rot}
          material={res.sidewalkMat}
          receiveShadow
        >
          <boxGeometry args={[slab.size[0], 0.036, slab.size[1]]} />
        </mesh>
      ))}

      {/* 3. WEST HERO URBAN BLOCK (Left Street Side — Brick Towers, Abandoned Shops, Stacked Billboards, Flags) */}
      <group>
        {/* Main Tall Pre-War Brick Building */}
        <mesh position={[-46.5, 19.0, 72.0]} material={res.brickFacadeMat} castShadow receiveShadow>
          <boxGeometry args={[20.0, 38.0, 32.0]} />
        </mesh>
        {/* Stepped Upper Cornice */}
        <mesh position={[-46.5, 38.4, 72.0]} material={res.stoneTrimMat} castShadow>
          <boxGeometry args={[20.8, 0.9, 32.8]} />
        </mesh>
        {/* Rear Setback Tall Pre-War Tower */}
        <mesh position={[-49.5, 24.5, 51.0]} material={res.redBrickMat} castShadow receiveShadow>
          <boxGeometry args={[19.0, 49.0, 14.0]} />
        </mesh>
        <mesh position={[-49.5, 50.8, 51.0]} material={res.stoneTrimMat} castShadow>
          <boxGeometry args={[13.5, 4.2, 10.5]} />
        </mesh>

        {/* Abandoned Ground-Floor Shops along West Sidewalk */}
        {[58.5, 68.5, 78.5].map((sz, idx) => (
          <group key={`w-shop-${idx}`} position={[-36.35, 0, sz]}>
            <mesh position={[0.12, 2.2, 0]} material={res.shopWindowMat}>
              <boxGeometry args={[0.25, 3.6, 6.8]} />
            </mesh>
            <mesh position={[0.24, 4.25, 0]} material={res.stoneTrimMat}>
              <boxGeometry args={[0.55, 0.42, 7.6]} />
            </mesh>
            {/* Faded Shop Awning */}
            <mesh
              position={[1.05, 3.85, 0]}
              rotation={[0, 0, -0.34]}
              material={idx % 2 === 0 ? res.awningA : res.awningB}
              castShadow
            >
              <boxGeometry args={[1.9, 0.14, 7.2]} />
            </mesh>
            {/* Masonry Piers */}
            <mesh position={[0.18, 2.2, -3.7]} material={res.stoneTrimMat} castShadow>
              <boxGeometry args={[0.62, 4.4, 0.85]} />
            </mesh>
          </group>
        ))}

        {/* STACKED LARGE WEATHERED BILLBOARDS & POSTERS (Faithful to Reference Left Facade) */}
        <group position={[-36.15, 0, 72.0]}>
          {/* Top Tall Portrait Billboard */}
          <group position={[0.22, 25.5, 1.5]} rotation={[0, Math.PI / 2, 0]}>
            <mesh material={res.darkMetalMat} castShadow>
              <boxGeometry args={[8.8, 10.6, 0.35]} />
            </mesh>
            <mesh position={[0, 0, 0.19]} material={res.billTopMat}>
              <planeGeometry args={[8.2, 10.0]} />
            </mesh>
          </group>

          {/* Middle Dramatic Theatrical Billboard */}
          <group position={[0.3, 15.0, 1.4]} rotation={[0, Math.PI / 2, 0]}>
            <mesh material={res.darkMetalMat} castShadow>
              <boxGeometry args={[9.2, 8.6, 0.38]} />
            </mesh>
            <mesh position={[0, 0, 0.21]} material={res.billMidMat}>
              <planeGeometry args={[8.6, 8.0]} />
            </mesh>
          </group>

          {/* Side Flanking Vertical Signboard */}
          <group position={[0.26, 14.5, -5.6]} rotation={[0, Math.PI / 2, 0]}>
            <mesh material={res.darkMetalMat} castShadow>
              <boxGeometry args={[4.4, 7.8, 0.3]} />
            </mesh>
            <mesh position={[0, 0, 0.17]} material={res.billCreamMat}>
              <planeGeometry args={[4.0, 7.2]} />
            </mesh>
          </group>

          {/* Lower Twin Horizontal Distressed Billboards Above Shops */}
          <group position={[0.34, 7.6, 3.8]} rotation={[0, Math.PI / 2, 0]}>
            <mesh material={res.darkMetalMat} castShadow>
              <boxGeometry args={[7.4, 3.6, 0.34]} />
            </mesh>
            <mesh position={[0, 0, 0.19]} material={res.billCreamMat}>
              <planeGeometry args={[6.9, 3.2]} />
            </mesh>
          </group>
          <group position={[0.34, 7.6, -4.1]} rotation={[0, Math.PI / 2, 0]}>
            <mesh material={res.darkMetalMat} castShadow>
              <boxGeometry args={[7.4, 3.6, 0.34]} />
            </mesh>
            <mesh position={[0, 0, 0.19]} material={res.billRedMat}>
              <planeGeometry args={[6.9, 3.2]} />
            </mesh>
          </group>

          {/* Tattered Hanging Urban Banners / Flags Projecting Over Boulevard */}
          {(
            [
              [11.8, -6.2, '#2d568c', -0.45],
              [10.2, -7.8, '#8c312b', -0.52],
            ] as ReadonlyArray<[number, number, string, number]>
          ).map(([fy, fz, col, tilt], i) => (
            <group key={`flag-${i}`} position={[0.4, fy, fz]}>
              <mesh position={[1.4, 0, 0]} rotation={[0, 0, tilt]} material={res.darkMetalMat}>
                <cylinderGeometry args={[0.04, 0.04, 3.2, 6]} />
              </mesh>
              <mesh position={[1.8, -0.45, 0]} rotation={[0.08, 0, tilt + 0.15]}>
                <boxGeometry args={[1.8, 0.85, 0.04]} />
                <meshStandardMaterial color={col} roughness={0.92} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* 4. EAST HERO URBAN BLOCK (Right Street Side — Classic Masonry & Limestone Towers + Shops) */}
      <group>
        <mesh position={[14.0, 21.0, 72.0]} material={res.redBrickMat} castShadow receiveShadow>
          <boxGeometry args={[21.0, 42.0, 34.0]} />
        </mesh>
        <mesh position={[14.0, 42.5, 72.0]} material={res.stoneTrimMat} castShadow>
          <boxGeometry args={[21.8, 1.0, 34.8]} />
        </mesh>
        {/* Tall Setback Limestone Urban Skyscraper */}
        <mesh position={[20.0, 27.0, 52.0]} material={res.stoneTowerMat} castShadow receiveShadow>
          <boxGeometry args={[22.0, 54.0, 16.0]} />
        </mesh>
        <mesh position={[20.0, 55.8, 52.0]} material={res.stoneTrimMat} castShadow>
          <boxGeometry args={[16.0, 4.0, 12.0]} />
        </mesh>

        {/* Abandoned Ground-Floor Shops along East Sidewalk */}
        {[58.5, 68.5, 78.5].map((sz, idx) => (
          <group key={`e-shop-${idx}`} position={[3.35, 0, sz]}>
            <mesh position={[-0.12, 2.2, 0]} material={res.shopWindowMat}>
              <boxGeometry args={[0.25, 3.6, 6.8]} />
            </mesh>
            <mesh position={[-0.24, 4.25, 0]} material={res.stoneTrimMat}>
              <boxGeometry args={[0.55, 0.42, 7.6]} />
            </mesh>
            <mesh
              position={[-1.05, 3.85, 0]}
              rotation={[0, 0, 0.34]}
              material={idx % 2 === 0 ? res.awningA : res.awningB}
              castShadow
            >
              <boxGeometry args={[1.9, 0.14, 7.2]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 5. 360° FAR CITY SKYLINE TOWERS (Surrounding Compound North, East, West & South Horizon) */}
      {[
        // North horizon towers framing behind the LAST EXIT apartment building
        { pos: [-46, 26, -86], size: [26, 52, 24], mat: res.brickFacadeMat },
        { pos: [-14, 31, -96], size: [24, 62, 22], mat: res.stoneTowerMat },
        { pos: [20, 28, -94], size: [26, 56, 22], mat: res.redBrickMat },
        { pos: [52, 24, -84], size: [24, 48, 22], mat: res.stoneTowerMat },
        // West & East outer city blocks flanking compound
        { pos: [-78, 21, -24], size: [24, 42, 34], mat: res.stoneTowerMat },
        { pos: [-76, 18, 20], size: [22, 36, 32], mat: res.redBrickMat },
        { pos: [76, 22, -20], size: [24, 44, 34], mat: res.brickFacadeMat },
        { pos: [74, 19, 22], size: [22, 38, 30], mat: res.stoneTowerMat },
        // Far South boulevard horizon
        { pos: [-48, 22, 118], size: [28, 44, 24], mat: res.stoneTowerMat },
        { pos: [16, 25, 122], size: [28, 50, 24], mat: res.brickFacadeMat },
      ].map((b, idx) => (
        <mesh
          key={`skyline-${idx}`}
          position={b.pos as [number, number, number]}
          material={b.mat}
          castShadow
          receiveShadow
        >
          <boxGeometry args={b.size as [number, number, number]} />
        </mesh>
      ))}

      {/* 6. Abandoned Classical Stone Statues on Pedestals */}
      {EXTERIOR_STATUE_POSITIONS.map((st, idx) => (
        <WeatheredStatue
          key={`ext-statue-${idx}`}
          x={st.x}
          z={st.z}
          rotY={st.rotY}
          scale={st.scale}
          pose={st.pose}
          stoneMat={res.statueStoneMat}
        />
      ))}

      {/* 7. Merged Organic Tree Trunks, Canopy Boughs & Exposed 3D Gnarled Pavement Roots */}
      <mesh geometry={trunkRootsGeo} material={res.barkMat} castShadow receiveShadow />

      {/* 8. Instanced Leafy Tree Canopies, Road-Crack Weeds & Dense Climbing Wall Ivy */}
      <instancedMesh
        ref={canopyRef}
        args={[canopyGeo, res.canopyMat, foliageLayout.canopies.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={weedRef}
        args={[weedGeo, res.weedMat, foliageLayout.weeds.length]}
      />
      <instancedMesh
        ref={ivyRef}
        args={[ivyGeo, res.ivyMat, foliageLayout.ivy.length]}
        castShadow
      />

      {/* 9. Old Urban Streetlamps & Collapsed South Avenue Barricade */}
      {[
        [-31.2, 54.0],
        [-31.2, 74.0],
        [-8.2, 56.0],
        [-8.2, 76.0],
      ].map(([lx, lz], idx) => (
        <group key={`lamp-${idx}`} position={[lx, 0, lz]}>
          <mesh position={[0, 3.0, 0]} material={res.darkMetalMat} castShadow>
            <cylinderGeometry args={[0.09, 0.14, 6.0, 8]} />
          </mesh>
          <mesh position={[lx < -20 ? 0.55 : -0.55, 5.9, 0]} material={res.darkMetalMat}>
            <boxGeometry args={[1.25, 0.1, 0.12]} />
          </mesh>
        </group>
      ))}

      {/* South Street Collapsed Concrete Jersey Barriers (cleanly sealing Z = 90.2) */}
      {[-31.5, -24.5, -17.5, -10.5, -3.5].map((bx, idx) => (
        <mesh
          key={`barrier-${idx}`}
          position={[bx, 0.52, 90.4]}
          rotation={[0, (idx % 2 === 0 ? 1 : -1) * 0.08, 0]}
          material={res.stoneTrimMat}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[5.8, 1.04, 0.85]} />
        </mesh>
      ))}
    </group>
  );
});
