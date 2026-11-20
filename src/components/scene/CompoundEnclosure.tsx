import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  COMPOUND_BOUNDS,
  COMPOUND_GATE_POS,
  COMPOUND_GATE_WIDTH,
  MAIN_ENTRANCE_POS,
} from '../../data/buildingLayout';
import { useGameStore } from '../../store/useGameStore';
import { playCompoundGateSound } from '../../three/soundEffects';

function makeSeededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCompoundResources() {
  const rand = makeSeededRand(66301);

  // 1. Weathered Precast Compound Wall Concrete Texture
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 512;
  wallCanvas.height = 256;
  const wCtx = wallCanvas.getContext('2d')!;
  wCtx.fillStyle = '#7c7b74';
  wCtx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 40; i++) {
    const cx = rand() * 512;
    const cy = rand() * 256;
    const r = 18 + rand() * 52;
    const g = wCtx.createRadialGradient(cx, cy, 3, cx, cy, r);
    g.addColorStop(0, rand() > 0.45 ? 'rgba(54, 62, 46, 0.28)' : 'rgba(146, 144, 134, 0.2)');
    g.addColorStop(1, 'rgba(115, 114, 108, 0)');
    wCtx.fillStyle = g;
    wCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Vertical moss & damp ground-up staining
  const mossBase = wCtx.createLinearGradient(0, 175, 0, 256);
  mossBase.addColorStop(0, 'rgba(42, 54, 34, 0)');
  mossBase.addColorStop(1, 'rgba(36, 46, 28, 0.56)');
  wCtx.fillStyle = mossBase;
  wCtx.fillRect(0, 175, 512, 81);

  wCtx.strokeStyle = 'rgba(46, 45, 42, 0.45)';
  wCtx.lineWidth = 3;
  for (let x = 0; x <= 512; x += 128) {
    wCtx.beginPath();
    wCtx.moveTo(x, 0);
    wCtx.lineTo(x, 256);
    wCtx.stroke();
  }

  const wallTex = new THREE.CanvasTexture(wallCanvas);
  wallTex.wrapS = THREE.RepeatWrapping;
  wallTex.wrapT = THREE.ClampToEdgeWrapping;
  wallTex.repeat.set(8, 1);
  wallTex.colorSpace = THREE.SRGBColorSpace;
  wallTex.anisotropy = 4;

  // 2. Rusted Iron Fence & Gate Texture
  const rustCanvas = document.createElement('canvas');
  rustCanvas.width = 256;
  rustCanvas.height = 256;
  const rCtx = rustCanvas.getContext('2d')!;
  rCtx.fillStyle = '#382f2b';
  rCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 65; i++) {
    const cx = rand() * 256;
    const cy = rand() * 256;
    const rad = 8 + rand() * 28;
    const rg = rCtx.createRadialGradient(cx, cy, 1, cx, cy, rad);
    rg.addColorStop(0, rand() > 0.4 ? 'rgba(118, 64, 36, 0.48)' : 'rgba(32, 34, 38, 0.45)');
    rg.addColorStop(1, 'rgba(56, 47, 43, 0)');
    rCtx.fillStyle = rg;
    rCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  const rustTex = new THREE.CanvasTexture(rustCanvas);
  rustTex.wrapS = THREE.RepeatWrapping;
  rustTex.wrapT = THREE.RepeatWrapping;
  rustTex.colorSpace = THREE.SRGBColorSpace;

  // 3. Compound Earth & Mossy Overgrown Yard Texture
  const yardCanvas = document.createElement('canvas');
  yardCanvas.width = 512;
  yardCanvas.height = 512;
  const yCtx = yardCanvas.getContext('2d')!;
  yCtx.fillStyle = '#3c4330';
  yCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 80; i++) {
    const cx = rand() * 512;
    const cy = rand() * 512;
    const rad = 20 + rand() * 68;
    const yg = yCtx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    yg.addColorStop(0, rand() > 0.48 ? 'rgba(72, 82, 52, 0.36)' : 'rgba(42, 38, 30, 0.38)');
    yg.addColorStop(1, 'rgba(60, 67, 48, 0)');
    yCtx.fillStyle = yg;
    yCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 4200; i++) {
    yCtx.fillStyle = rand() > 0.5 ? 'rgba(92, 102, 66, 0.24)' : 'rgba(32, 34, 24, 0.25)';
    yCtx.fillRect(rand() * 512, rand() * 512, 2, 2);
  }
  const yardTex = new THREE.CanvasTexture(yardCanvas);
  yardTex.wrapS = THREE.RepeatWrapping;
  yardTex.wrapT = THREE.RepeatWrapping;
  yardTex.repeat.set(9, 9);
  yardTex.colorSpace = THREE.SRGBColorSpace;
  yardTex.anisotropy = 4;

  // 4. Cracked Stone Pathway Texture
  const pathCanvas = document.createElement('canvas');
  pathCanvas.width = 256;
  pathCanvas.height = 512;
  const pCtx = pathCanvas.getContext('2d')!;
  pCtx.fillStyle = '#6f6d65';
  pCtx.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      const shade = 98 + Math.floor(rand() * 24);
      pCtx.fillStyle = `rgb(${shade}, ${shade - 2}, ${shade - 8})`;
      pCtx.fillRect(x + 2, y + 2, 60, 60);
    }
  }
  for (let c = 0; c < 18; c++) {
    let cx = rand() * 256;
    let cy = rand() * 512;
    pCtx.strokeStyle = 'rgba(32, 36, 26, 0.72)';
    pCtx.lineWidth = 1.6;
    pCtx.beginPath();
    pCtx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (rand() - 0.5) * 32;
      cy += (rand() - 0.5) * 32;
      pCtx.lineTo(cx, cy);
    }
    pCtx.stroke();
  }
  const pathTex = new THREE.CanvasTexture(pathCanvas);
  pathTex.wrapS = THREE.RepeatWrapping;
  pathTex.wrapT = THREE.RepeatWrapping;
  pathTex.repeat.set(1.5, 4.5);
  pathTex.colorSpace = THREE.SRGBColorSpace;
  pathTex.anisotropy = 4;

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.92,
    metalness: 0.04,
  });

  const pillarMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    color: '#9c968d',
    roughness: 0.88,
    metalness: 0.05,
  });

  const rustedIronMat = new THREE.MeshStandardMaterial({
    map: rustTex,
    roughness: 0.62,
    metalness: 0.72,
  });

  const yardMat = new THREE.MeshStandardMaterial({
    map: yardTex,
    roughness: 0.95,
    metalness: 0.02,
  });

  const stonePathMat = new THREE.MeshStandardMaterial({
    map: pathTex,
    roughness: 0.9,
    metalness: 0.04,
  });

  const foliageMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.88,
    metalness: 0.02,
  });

  const stoneRubbleMat = new THREE.MeshStandardMaterial({
    color: '#7a7870',
    roughness: 0.92,
    metalness: 0.03,
  });

  return {
    wallTex,
    rustTex,
    yardTex,
    pathTex,
    wallMat,
    pillarMat,
    rustedIronMat,
    yardMat,
    stonePathMat,
    foliageMat,
    stoneRubbleMat,
    dispose: () => {
      wallTex.dispose();
      rustTex.dispose();
      yardTex.dispose();
      pathTex.dispose();
      wallMat.dispose();
      pillarMat.dispose();
      rustedIronMat.dispose();
      yardMat.dispose();
      stonePathMat.dispose();
      foliageMat.dispose();
      stoneRubbleMat.dispose();
    },
  };
}

/**
 * Generates an extruded compound yard slab covering [-46, +46] with the 56x56 building center cut cleanly out
 * so Floor 1's dark industrial concrete floor and the Haunted Central Courtyard never Z-fight.
 */
function createCompoundGroundGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(COMPOUND_BOUNDS.minX, COMPOUND_BOUNDS.minZ);
  shape.lineTo(COMPOUND_BOUNDS.maxX, COMPOUND_BOUNDS.minZ);
  shape.lineTo(COMPOUND_BOUNDS.maxX, COMPOUND_BOUNDS.maxZ);
  shape.lineTo(COMPOUND_BOUNDS.minX, COMPOUND_BOUNDS.maxZ);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-28.05, -28.05);
  hole.lineTo(28.05, -28.05);
  hole.lineTo(28.05, 28.05);
  hole.lineTo(-28.05, 28.05);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -0.17, 0);
  geo.computeVertexNormals();
  return geo;
}

export const CompoundEnclosure: React.FC = React.memo(() => {
  const compoundGateState = useGameStore((s) => s.compoundGateState);
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const tryOpenCompoundGate = useGameStore((s) => s.tryOpenCompoundGate);
  const markCompoundGateOpen = useGameStore((s) => s.markCompoundGateOpen);

  const leftGateRef = useRef<THREE.Group>(null);
  const rightGateRef = useRef<THREE.Group>(null);
  const picketRef = useRef<THREE.InstancedMesh>(null);
  const bushRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const wallIvyRef = useRef<THREE.InstancedMesh>(null);
  const openedNotifiedRef = useRef(false);

  const res = useMemo(() => createCompoundResources(), []);
  const yardGeo = useMemo(() => createCompoundGroundGeometry(), []);
  const picketGeo = useMemo(() => new THREE.BoxGeometry(0.055, 1.55, 0.055), []);
  const bushGeo = useMemo(() => new THREE.DodecahedronGeometry(0.62, 1), []);
  const grassGeo = useMemo(() => new THREE.ConeGeometry(0.16, 0.65, 4), []);
  const ivyGeo = useMemo(() => new THREE.DodecahedronGeometry(0.45, 0), []);

  useEffect(() => {
    openedNotifiedRef.current = compoundGateState === 'open';
  }, [compoundGateState]);

  const layout = useMemo(() => {
    const rand = makeSeededRand(99041);
    const gateLeftX = COMPOUND_GATE_POS[0] - COMPOUND_GATE_WIDTH / 2;
    const gateRightX = COMPOUND_GATE_POS[0] + COMPOUND_GATE_WIDTH / 2;

    // Fence picket positions atop all 4 compound walls (skipping the single gate opening!)
    const pickets: [number, number][] = [];
    const step = 0.56;
    for (let x = -45.6; x <= 45.6; x += step) {
      pickets.push([x, -46.0]); // North fence
      if (x < gateLeftX - 0.55 || x > gateRightX + 0.55) {
        pickets.push([x, 46.0]); // South fence (with single gate gap)
      }
    }
    for (let z = -45.4; z <= 45.4; z += step) {
      pickets.push([-46.0, z]); // West fence
      pickets.push([46.0, z]); // East fence
    }

    // Perimeter bushes & shrubs (avoid walkway X ∈ [-24, -17] and Escape Tower margins)
    const bushes: { pos: [number, number, number]; scale: [number, number, number]; hex: string }[] = [];
    const bushColors = ['#3c5829', '#4a6b33', '#314922', '#527038'];
    for (let i = 0; i < 86; i++) {
      let bx = (rand() - 0.5) * 88;
      let bz = (rand() - 0.5) * 88;
      if (Math.abs(bx) < 30 && Math.abs(bz) < 30) {
        if (rand() > 0.5) bx = (rand() > 0.5 ? 1 : -1) * (31 + rand() * 13);
        else bz = (rand() > 0.5 ? 1 : -1) * (31 + rand() * 13);
      }
      // Keep main walkway from gate to entrance unobstructed
      if (bx > -24.5 && bx < -16.5 && bz > 26 && bz < 47) continue;
      // Keep Escape Tower strips uncluttered
      if (Math.abs(bx) > 28 && Math.abs(bx) < 42 && Math.abs(bz) < 16) continue;
      const sc = 0.75 + rand() * 1.1;
      bushes.push({
        pos: [bx, sc * 0.36, bz],
        scale: [sc * 1.25, sc * 0.9, sc * 1.15],
        hex: bushColors[Math.floor(rand() * bushColors.length)],
      });
    }

    // Wild grass & weed tufts along compound yard & stone walkway edges
    const grass: { pos: [number, number, number]; rotY: number; scale: number; hex: string }[] = [];
    const grassColors = ['#4d6c31', '#607d3b', '#3f5b28', '#6a743b'];
    for (let i = 0; i < 240; i++) {
      let gx = (rand() - 0.5) * 89;
      let gz = (rand() - 0.5) * 89;
      if (Math.abs(gx) < 28.4 && Math.abs(gz) < 28.4) continue;
      if (gx > -22.2 && gx < -18.8 && gz > 28.2 && gz < 45.8 && i % 4 !== 0) continue;
      grass.push({
        pos: [gx, 0.2, gz],
        rotY: rand() * Math.PI * 2,
        scale: 0.7 + rand() * 0.85,
        hex: grassColors[Math.floor(rand() * grassColors.length)],
      });
    }

    // Climbing ivy clinging to perimeter wall sections
    const wallIvy: { pos: [number, number, number]; scale: [number, number, number]; hex: string }[] = [];
    for (let i = 0; i < 110; i++) {
      const side = i % 4;
      let ix = 0;
      let iz = 0;
      if (side === 0) {
        ix = -45.72;
        iz = (rand() - 0.5) * 86;
      } else if (side === 1) {
        ix = 45.72;
        iz = (rand() - 0.5) * 86;
      } else if (side === 2) {
        ix = (rand() - 0.5) * 86;
        iz = -45.72;
      } else {
        ix = (rand() - 0.5) * 86;
        if (Math.abs(ix - COMPOUND_GATE_POS[0]) < 4.5) ix += 8;
        iz = 45.72;
      }
      const sc = 0.5 + rand() * 0.7;
      wallIvy.push({
        pos: [ix, 0.55 + rand() * 1.45, iz],
        scale: [sc, sc * 0.9, sc],
        hex: bushColors[Math.floor(rand() * bushColors.length)],
      });
    }

    return { pickets, bushes, grass, wallIvy, gateLeftX, gateRightX };
  }, []);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    if (picketRef.current) {
      layout.pickets.forEach(([px, pz], idx) => {
        dummy.position.set(px, 2.38, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        picketRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      picketRef.current.instanceMatrix.needsUpdate = true;
    }

    if (bushRef.current) {
      layout.bushes.forEach((b, idx) => {
        dummy.position.set(b.pos[0], b.pos[1], b.pos[2]);
        dummy.rotation.set(0, idx * 0.7, 0);
        dummy.scale.set(b.scale[0], b.scale[1], b.scale[2]);
        dummy.updateMatrix();
        bushRef.current!.setMatrixAt(idx, dummy.matrix);
        col.set(b.hex);
        bushRef.current!.setColorAt(idx, col);
      });
      bushRef.current.instanceMatrix.needsUpdate = true;
      if (bushRef.current.instanceColor) bushRef.current.instanceColor.needsUpdate = true;
    }

    if (grassRef.current) {
      layout.grass.forEach((g, idx) => {
        dummy.position.set(g.pos[0], g.pos[1], g.pos[2]);
        dummy.rotation.set((idx % 3) * 0.14, g.rotY, ((idx + 1) % 3) * 0.12);
        dummy.scale.set(g.scale, g.scale, g.scale);
        dummy.updateMatrix();
        grassRef.current!.setMatrixAt(idx, dummy.matrix);
        col.set(g.hex);
        grassRef.current!.setColorAt(idx, col);
      });
      grassRef.current.instanceMatrix.needsUpdate = true;
      if (grassRef.current.instanceColor) grassRef.current.instanceColor.needsUpdate = true;
    }

    if (wallIvyRef.current) {
      layout.wallIvy.forEach((iv, idx) => {
        dummy.position.set(iv.pos[0], iv.pos[1], iv.pos[2]);
        dummy.rotation.set(idx * 0.2, idx * 0.5, 0);
        dummy.scale.set(iv.scale[0], iv.scale[1], iv.scale[2]);
        dummy.updateMatrix();
        wallIvyRef.current!.setMatrixAt(idx, dummy.matrix);
        col.set(iv.hex);
        wallIvyRef.current!.setColorAt(idx, col);
      });
      wallIvyRef.current.instanceMatrix.needsUpdate = true;
      if (wallIvyRef.current.instanceColor) wallIvyRef.current.instanceColor.needsUpdate = true;
    }
  }, [layout]);

  useEffect(() => {
    return () => {
      yardGeo.dispose();
      picketGeo.dispose();
      bushGeo.dispose();
      grassGeo.dispose();
      ivyGeo.dispose();
      res.dispose();
    };
  }, [bushGeo, grassGeo, ivyGeo, picketGeo, res, yardGeo]);

  // Smooth inward swing animation for the single double-leaf rusted compound gate
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const targetAngle = compoundGateState === 'closed' ? 0 : Math.PI * 0.48;
    const leftLeaf = leftGateRef.current;
    const rightLeaf = rightGateRef.current;
    if (!leftLeaf || !rightLeaf) return;

    leftLeaf.rotation.y = THREE.MathUtils.damp(leftLeaf.rotation.y, targetAngle, 5.4, delta);
    rightLeaf.rotation.y = THREE.MathUtils.damp(rightLeaf.rotation.y, -targetAngle, 5.4, delta);

    if (
      compoundGateState === 'opening' &&
      !openedNotifiedRef.current &&
      Math.abs(leftLeaf.rotation.y - targetAngle) < 0.08
    ) {
      openedNotifiedRef.current = true;
      markCompoundGateOpen();
    }
  });

  const handleGateClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (compoundGateState === 'closed' && tryOpenCompoundGate()) {
      playCompoundGateSound(true, audioEnabled);
    }
  };

  const gateHalf = COMPOUND_GATE_WIDTH / 2;
  const leafWidth = gateHalf - 0.06;
  const swLen = layout.gateLeftX - COMPOUND_BOUNDS.minX;
  const seLen = COMPOUND_BOUNDS.maxX - layout.gateRightX;

  return (
    <group>
      {/* 1. Compound Yard Turf (outer [-46, +46] with [-28.05, +28.05] cut cleanly out) */}
      <mesh geometry={yardGeo} material={res.yardMat} receiveShadow />

      {/* 2. Cracked Stone Entry Walkway connecting Single Compound Gate (-20.5, 46) -> Main Building Entrance (-20.5, 28) */}
      <mesh
        position={[MAIN_ENTRANCE_POS[0], -0.004, (COMPOUND_GATE_POS[2] + MAIN_ENTRANCE_POS[2]) / 2]}
        material={res.stonePathMat}
        receiveShadow
      >
        <boxGeometry args={[4.2, 0.03, 18.6]} />
      </mesh>
      {/* Cracked perimeter courtyard service apron slabs around south entrance */}
      {[
        [-21.9, 39.2, 0.1],
        [-19.2, 33.4, -0.08],
        [-21.4, 30.8, 0.05],
      ].map(([sx, sz, rot], idx) => (
        <mesh
          key={`compound-paver-${idx}`}
          position={[sx, 0.014, sz]}
          rotation={[0.02, rot, -0.01]}
          material={res.stoneRubbleMat}
          receiveShadow
        >
          <boxGeometry args={[1.15, 0.03, 0.92]} />
        </mesh>
      ))}

      {/* 3. Weathered Concrete Perimeter Walls (92m x 92m) + Top Rusted Steel Fence Rails */}
      {/* North Wall */}
      <mesh position={[0, 0.82, -46]} material={res.wallMat} castShadow receiveShadow>
        <boxGeometry args={[92.6, 1.64, 0.56]} />
      </mesh>
      <mesh position={[0, 2.95, -46]} material={res.rustedIronMat}>
        <boxGeometry args={[92.2, 0.08, 0.09]} />
      </mesh>
      <mesh position={[0, 1.85, -46]} material={res.rustedIronMat}>
        <boxGeometry args={[92.2, 0.08, 0.09]} />
      </mesh>

      {/* West Wall */}
      <mesh position={[-46, 0.82, 0]} material={res.wallMat} castShadow receiveShadow>
        <boxGeometry args={[0.56, 1.64, 92.6]} />
      </mesh>
      <mesh position={[-46, 2.95, 0]} material={res.rustedIronMat}>
        <boxGeometry args={[0.09, 0.08, 92.2]} />
      </mesh>
      <mesh position={[-46, 1.85, 0]} material={res.rustedIronMat}>
        <boxGeometry args={[0.09, 0.08, 92.2]} />
      </mesh>

      {/* East Wall */}
      <mesh position={[46, 0.82, 0]} material={res.wallMat} castShadow receiveShadow>
        <boxGeometry args={[0.56, 1.64, 92.6]} />
      </mesh>
      <mesh position={[46, 2.95, 0]} material={res.rustedIronMat}>
        <boxGeometry args={[0.09, 0.08, 92.2]} />
      </mesh>
      <mesh position={[46, 1.85, 0]} material={res.rustedIronMat}>
        <boxGeometry args={[0.09, 0.08, 92.2]} />
      </mesh>

      {/* South-West & South-East Walls (split by the SINGLE compound entrance gate) */}
      <mesh
        position={[(COMPOUND_BOUNDS.minX + layout.gateLeftX) / 2, 0.82, 46]}
        material={res.wallMat}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[swLen, 1.64, 0.56]} />
      </mesh>
      <mesh
        position={[(COMPOUND_BOUNDS.minX + layout.gateLeftX) / 2, 2.95, 46]}
        material={res.rustedIronMat}
      >
        <boxGeometry args={[swLen, 0.08, 0.09]} />
      </mesh>

      <mesh
        position={[(layout.gateRightX + COMPOUND_BOUNDS.maxX) / 2, 0.82, 46]}
        material={res.wallMat}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[seLen, 1.64, 0.56]} />
      </mesh>
      <mesh
        position={[(layout.gateRightX + COMPOUND_BOUNDS.maxX) / 2, 2.95, 46]}
        material={res.rustedIronMat}
      >
        <boxGeometry args={[seLen, 0.08, 0.09]} />
      </mesh>

      {/* Instanced Rusted Fence Pickets Along All 4 Compound Sides (1 draw call) */}
      <instancedMesh
        ref={picketRef}
        args={[picketGeo, res.rustedIronMat, layout.pickets.length]}
        castShadow
      />

      {/* Corner & Perimeter Security Light Posts */}
      {[
        [-45.8, -45.8],
        [45.8, -45.8],
        [-45.8, 45.8],
        [45.8, 45.8],
      ].map(([cx, cz], idx) => (
        <mesh key={`corner-pier-${idx}`} position={[cx, 1.65, cz]} material={res.pillarMat} castShadow>
          <boxGeometry args={[0.92, 3.3, 0.92]} />
        </mesh>
      ))}

      {/* 4. EXACTLY ONE COMPOUND ENTRANCE GATE (-20.5, 0, 46.0) */}
      <group position={COMPOUND_GATE_POS}>
        {/* Left & Right Weathered Masonry Gate Pillars + Security Lanterns */}
        {[-gateHalf - 0.45, gateHalf + 0.45].map((px, idx) => (
          <group key={`gate-pillar-${idx}`} position={[px, 0, 0]}>
            <mesh position={[0, 1.85, 0]} material={res.pillarMat} castShadow receiveShadow>
              <boxGeometry args={[0.95, 3.7, 0.95]} />
            </mesh>
            <mesh position={[0, 3.78, 0]} material={res.stoneRubbleMat} castShadow>
              <boxGeometry args={[1.15, 0.18, 1.15]} />
            </mesh>
            {/* Security Lantern Box */}
            <mesh position={[0, 4.08, 0]} material={res.rustedIronMat}>
              <boxGeometry args={[0.38, 0.42, 0.38]} />
            </mesh>
            <mesh position={[0, 4.05, 0]}>
              <boxGeometry args={[0.26, 0.28, 0.26]} />
              <meshStandardMaterial color="#ffe4b5" emissive="#f59e0b" emissiveIntensity={1.9} />
            </mesh>
          </group>
        ))}

        {/* Warm Security Lantern Pool Lighting the Compound Gate Threshold */}
        <pointLight position={[0, 4.2, 1.2]} color="#ffd599" intensity={5.4} distance={15} decay={1.6} />

        {/* Double Swinging Rusted Iron Gate Doors */}
        <group ref={leftGateRef} position={[-gateHalf + 0.03, 0, 0]} onClick={handleGateClick}>
          <mesh position={[leafWidth / 2, 0.18, 0]} material={res.rustedIronMat} castShadow>
            <boxGeometry args={[leafWidth, 0.16, 0.09]} />
          </mesh>
          <mesh position={[leafWidth / 2, 1.52, 0]} material={res.rustedIronMat} castShadow>
            <boxGeometry args={[leafWidth, 0.1, 0.08]} />
          </mesh>
          <mesh position={[leafWidth / 2, 2.78, 0]} material={res.rustedIronMat} castShadow>
            <boxGeometry args={[leafWidth, 0.12, 0.08]} />
          </mesh>
          <mesh position={[0.06, 1.48, 0]} material={res.rustedIronMat} castShadow>
            <boxGeometry args={[0.1, 2.78, 0.1]} />
          </mesh>
          <mesh position={[leafWidth - 0.05, 1.48, 0]} material={res.rustedIronMat} castShadow>
            <boxGeometry args={[0.1, 2.78, 0.1]} />
          </mesh>
          {/* Diagonal truss & vertical bars */}
          <mesh
            position={[leafWidth / 2, 1.48, 0]}
            rotation={[0, 0, 0.72]}
            material={res.rustedIronMat}
          >
            <boxGeometry args={[0.06, 2.7, 0.05]} />
          </mesh>
          {[0.32, 0.62, 0.92, 1.22, 1.52, 1.82].map((bx, i) => (
            <mesh key={i} position={[bx, 1.58, 0]} material={res.rustedIronMat} castShadow>
              <boxGeometry args={[0.045, 2.95, 0.045]} />
            </mesh>
          ))}
        </group>

        <group ref={rightGateRef} position={[gateHalf - 0.03, 0, 0]} onClick={handleGateClick}>
          <mesh position={[-leafWidth / 2, 0.18, 0]} material={res.rustedIronMat} castShadow>
            <boxGeometry args={[leafWidth, 0.16, 0.09]} />
          </mesh>
          <mesh position={[-leafWidth / 2, 1.52, 0]} material={res.rustedIronMat} castShadow>
            <boxGeometry args={[leafWidth, 0.1, 0.08]} />
          </mesh>
          <mesh position={[-leafWidth / 2, 2.78, 0]} material={res.rustedIronMat} castShadow>
            <boxGeometry args={[leafWidth, 0.12, 0.08]} />
          </mesh>
          <mesh position={[-0.06, 1.48, 0]} material={res.rustedIronMat} castShadow>
            <boxGeometry args={[0.1, 2.78, 0.1]} />
          </mesh>
          <mesh position={[-leafWidth + 0.05, 1.48, 0]} material={res.rustedIronMat} castShadow>
            <boxGeometry args={[0.1, 2.78, 0.1]} />
          </mesh>
          <mesh
            position={[-leafWidth / 2, 1.48, 0]}
            rotation={[0, 0, -0.72]}
            material={res.rustedIronMat}
          >
            <boxGeometry args={[0.06, 2.7, 0.05]} />
          </mesh>
          {[0.32, 0.62, 0.92, 1.22, 1.52, 1.82].map((bx, i) => (
            <mesh key={i} position={[-bx, 1.58, 0]} material={res.rustedIronMat} castShadow>
              <boxGeometry args={[0.045, 2.95, 0.045]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* 5. Abandoned Compound Landscaping (Instanced Bushes, Grass Tufts, Wall Ivy & Rubble) */}
      <instancedMesh
        ref={bushRef}
        args={[bushGeo, res.foliageMat, layout.bushes.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh ref={grassRef} args={[grassGeo, res.foliageMat, layout.grass.length]} />
      <instancedMesh
        ref={wallIvyRef}
        args={[ivyGeo, res.foliageMat, layout.wallIvy.length]}
        castShadow
      />

      {/* Broken Stone Decorative Debris in Compound Corners */}
      {[
        [-25.4, 34.5, 0.4],
        [-15.4, 38.2, -0.7],
        [32.0, -34.0, 1.1],
      ].map(([rx, rz, rot], idx) => (
        <group key={`compound-rubble-${idx}`} position={[rx, 0, rz]} rotation={[0, rot, 0]}>
          <mesh position={[0, 0.16, 0]} material={res.stoneRubbleMat} castShadow receiveShadow>
            <boxGeometry args={[0.72, 0.32, 0.56]} />
          </mesh>
          <mesh position={[0.48, 0.11, 0.25]} rotation={[0.4, 0.8, 0.2]} material={res.stoneRubbleMat}>
            <dodecahedronGeometry args={[0.2, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
});
