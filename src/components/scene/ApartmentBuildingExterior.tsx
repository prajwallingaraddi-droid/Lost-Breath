import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  BUILDING_DEPTH,
  BUILDING_WIDTH,
  FLOOR_ELEVATIONS,
  FLOOR_HEIGHT,
  getActivePuzzleEscapeFrame,
  MAIN_ENTRANCE_POS,
  MAIN_ENTRANCE_WIDTH,
} from '../../data/buildingLayout';
import { useGameStore } from '../../store/useGameStore';
import { playHeavyMainEntranceSound } from '../../three/soundEffects';

function makeSeededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createFacadeMaterialsAndTextures() {
  const rand = makeSeededRand(88421);

  // 1. Weathered Urban Brick & Masonry Facade Texture
  const brickCanvas = document.createElement('canvas');
  brickCanvas.width = 512;
  brickCanvas.height = 512;
  const bCtx = brickCanvas.getContext('2d')!;
  bCtx.fillStyle = '#5e564e';
  bCtx.fillRect(0, 0, 512, 512);

  const brickH = 16;
  const brickW = 36;
  for (let row = 0; row < 512 / brickH; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col < 512 / brickW + 1; col++) {
      const bx = col * brickW + offset;
      const by = row * brickH;
      const tone = 72 + Math.floor(rand() * 34);
      const warm = Math.floor(rand() * 14);
      bCtx.fillStyle = `rgb(${tone + warm}, ${tone + Math.floor(warm * 0.55)}, ${tone - 4})`;
      bCtx.fillRect(bx + 1.5, by + 1.5, brickW - 3, brickH - 3);
    }
  }
  // Vertical soot & damp weathering streaks
  for (let s = 0; s < 24; s++) {
    const sx = rand() * 512;
    const sw = 8 + rand() * 24;
    const sg = bCtx.createLinearGradient(sx, 0, sx, 512);
    sg.addColorStop(0, 'rgba(28, 26, 24, 0.36)');
    sg.addColorStop(0.5, 'rgba(38, 42, 34, 0.16)');
    sg.addColorStop(1, 'rgba(26, 24, 22, 0.28)');
    bCtx.fillStyle = sg;
    bCtx.fillRect(sx, 0, sw, 512);
  }

  const brickTex = new THREE.CanvasTexture(brickCanvas);
  brickTex.wrapS = THREE.RepeatWrapping;
  brickTex.wrapT = THREE.RepeatWrapping;
  brickTex.repeat.set(3.5, 2.2);
  brickTex.colorSpace = THREE.SRGBColorSpace;
  brickTex.anisotropy = 4;

  // 2. LAST BREATH Main Entrance Building Sign Texture
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 768;
  signCanvas.height = 192;
  const sCtx = signCanvas.getContext('2d')!;
  sCtx.fillStyle = '#181b1e';
  sCtx.fillRect(0, 0, 768, 192);

  // Subtle grime & brushed border
  for (let i = 0; i < 1600; i++) {
    const v = 24 + Math.floor(rand() * 28);
    sCtx.fillStyle = `rgba(${v}, ${v + 2}, ${v + 4}, 0.25)`;
    sCtx.fillRect(rand() * 768, rand() * 192, 2, 2);
  }
  sCtx.strokeStyle = '#8b6e44';
  sCtx.lineWidth = 6;
  sCtx.strokeRect(10, 10, 748, 172);
  sCtx.strokeStyle = '#5c2626';
  sCtx.lineWidth = 2;
  sCtx.strokeRect(20, 20, 728, 152);

  sCtx.textAlign = 'center';
  sCtx.fillStyle = '#f3d8a4';
  sCtx.font = 'bold 74px "Georgia", serif';
  sCtx.fillText('LAST BREATH', 384, 108);

  sCtx.fillStyle = '#9ca8a4';
  sCtx.font = 'bold 20px monospace';
  sCtx.fillText('RESIDENTIAL APARTMENTS · BLOCK 04 · AUTHORIZED ENTRY', 384, 150);

  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = 4;

  const brickMat = new THREE.MeshStandardMaterial({
    map: brickTex,
    roughness: 0.9,
    metalness: 0.04,
    color: '#9e978e',
  });

  const trimStoneMat = new THREE.MeshStandardMaterial({
    color: '#88857d',
    roughness: 0.88,
    metalness: 0.05,
  });

  const darkGlassMat = new THREE.MeshStandardMaterial({
    color: '#182128',
    roughness: 0.16,
    metalness: 0.45,
    envMapIntensity: 1.35,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    color: '#282c30',
    roughness: 0.56,
    metalness: 0.72,
  });

  const rustPipeMat = new THREE.MeshStandardMaterial({
    color: '#4c4640',
    roughness: 0.68,
    metalness: 0.62,
  });

  const mainDoorSteelMat = new THREE.MeshStandardMaterial({
    color: '#2c3034',
    roughness: 0.44,
    metalness: 0.76,
    envMapIntensity: 1.15,
  });

  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: '#f5cfa0',
    emissiveMap: signTex,
    emissiveIntensity: 0.55,
    roughness: 0.4,
    metalness: 0.35,
  });

  const ivyLeafMat = new THREE.MeshStandardMaterial({
    color: '#3e5e2e',
    roughness: 0.86,
    metalness: 0.02,
  });

  return {
    brickTex,
    signTex,
    brickMat,
    trimStoneMat,
    darkGlassMat,
    ironMat,
    rustPipeMat,
    mainDoorSteelMat,
    signMat,
    ivyLeafMat,
    dispose: () => {
      brickTex.dispose();
      signTex.dispose();
      brickMat.dispose();
      trimStoneMat.dispose();
      darkGlassMat.dispose();
      ironMat.dispose();
      rustPipeMat.dispose();
      mainDoorSteelMat.dispose();
      signMat.dispose();
      ivyLeafMat.dispose();
    },
  };
}

interface WindowSpec {
  pos: [number, number, number];
  rotY: number;
  hasBalcony: boolean;
}

export const ApartmentBuildingExterior: React.FC = React.memo(() => {
  const layoutVersion = useGameStore((s) => s.layoutVersion);
  const controlMode = useGameStore((s) => s.controlMode);
  const cutawayMode = useGameStore((s) => s.cutawayMode);
  const mainEntranceState = useGameStore((s) => s.mainEntranceState);
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const tryOpenMainEntrance = useGameStore((s) => s.tryOpenMainEntrance);
  const markMainEntranceOpen = useGameStore((s) => s.markMainEntranceOpen);

  const effectiveCutaway = controlMode === 'orbit' && cutawayMode;
  const leftLeafRef = useRef<THREE.Group>(null);
  const rightLeafRef = useRef<THREE.Group>(null);
  const ivyMeshRef = useRef<THREE.InstancedMesh>(null);
  const openedNotifiedRef = useRef(false);

  const mats = useMemo(() => createFacadeMaterialsAndTextures(), []);

  useEffect(() => {
    openedNotifiedRef.current = mainEntranceState === 'open';
  }, [mainEntranceState]);

  // Precompute facade window & balcony bays skipping the Main Entrance & active Safe Room exit wing bay
  const facadeData = useMemo(() => {
    void layoutVersion;
    const escapeFrame = getActivePuzzleEscapeFrame();
    const windows: WindowSpec[] = [];
    const bays = [-22.5, -16.2, -9.8, -3.4, 3.4, 9.8, 16.2, 22.5];

    const conflictsWithEscape = (wx: number, wz: number, fl: number) => {
      if (escapeFrame.wing === 'south' && wz > 27 && Math.abs(wx - escapeFrame.centerX) < 6.8 && fl <= escapeFrame.floor) return true;
      if (escapeFrame.wing === 'north' && wz < -27 && Math.abs(wx - escapeFrame.centerX) < 6.8 && fl <= escapeFrame.floor) return true;
      if (escapeFrame.wing === 'west' && wx < -27 && Math.abs(wz - escapeFrame.centerZ) < 6.8 && fl <= escapeFrame.floor) return true;
      if (escapeFrame.wing === 'east' && wx > 27 && Math.abs(wz - escapeFrame.centerZ) < 6.8 && fl <= escapeFrame.floor) return true;
      return false;
    };

    ([1, 2, 3, 4] as const).forEach((fl) => {
      const wy = FLOOR_ELEVATIONS[fl] + 2.25;
      bays.forEach((b, idx) => {
        const hasBalcony = fl >= 2 && (idx === 1 || idx === 3 || idx === 5 || idx === 6);

        // South facade (skip main entrance bay on Floor 1)
        const nearMainEntry = fl === 1 && Math.abs(b - MAIN_ENTRANCE_POS[0]) < 4.5;
        if (!nearMainEntry && !conflictsWithEscape(b, 28.18, fl)) {
          windows.push({ pos: [b, wy, 28.2], rotY: 0, hasBalcony });
        }
        // North facade
        if (!conflictsWithEscape(b, -28.18, fl)) {
          windows.push({ pos: [b, wy, -28.2], rotY: Math.PI, hasBalcony });
        }
        // West facade
        if (!conflictsWithEscape(-28.18, b, fl)) {
          windows.push({ pos: [-28.2, wy, b], rotY: -Math.PI / 2, hasBalcony });
        }
        // East facade
        if (!conflictsWithEscape(28.18, b, fl)) {
          windows.push({ pos: [28.2, wy, b], rotY: Math.PI / 2, hasBalcony });
        }
      });
    });

    // Instanced climbing green ivy clusters along exterior walls & corners (avoiding main entrance doorway)
    const rand = makeSeededRand(55902);
    const ivyInstances: { pos: [number, number, number]; scale: [number, number, number]; color: string }[] = [];
    const ivyColors = ['#355228', '#446833', '#2e4a23', '#51763a'];
    const addWallIvyColumn = (baseX: number, baseZ: number, maxH: number, count: number, spreadX: number, spreadZ: number) => {
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const ix = baseX + (rand() - 0.5) * spreadX;
        const iz = baseZ + (rand() - 0.5) * spreadZ;
        const iy = 0.35 + t * maxH + (rand() - 0.5) * 0.6;
        // Never cover the main entrance doors or sign
        if (Math.abs(ix - MAIN_ENTRANCE_POS[0]) < 3.4 && iz > 26.5 && iy < 5.2) continue;
        const sc = 0.28 + rand() * 0.36;
        ivyInstances.push({
          pos: [ix, iy, iz],
          scale: [sc * (0.9 + rand() * 0.4), sc * (0.8 + rand() * 0.5), sc * (0.9 + rand() * 0.4)],
          color: ivyColors[Math.floor(rand() * ivyColors.length)],
        });
      }
    };

    // Climbing ivy columns on South, West, East, and North exterior facades
    addWallIvyColumn(-27.6, 28.22, 16.5, 42, 2.2, 0.28);
    addWallIvyColumn(-13.6, 28.22, 14.5, 36, 2.4, 0.28);
    addWallIvyColumn(14.5, 28.22, 15.8, 38, 3.0, 0.28);
    addWallIvyColumn(27.2, 28.22, 13.0, 30, 2.0, 0.28);
    addWallIvyColumn(-28.22, 24.5, 16.0, 36, 0.28, 3.2);
    addWallIvyColumn(-28.22, -21.0, 15.2, 34, 0.28, 3.4);
    addWallIvyColumn(28.22, 20.0, 15.0, 32, 0.28, 3.2);
    addWallIvyColumn(28.22, -18.5, 16.2, 36, 0.28, 3.2);
    addWallIvyColumn(-18.0, -28.22, 14.8, 32, 3.4, 0.28);
    addWallIvyColumn(20.0, -28.22, 15.4, 34, 3.2, 0.28);

    return { windows, ivyInstances };
  }, [layoutVersion]);

  const ivyGeo = useMemo(() => new THREE.DodecahedronGeometry(0.65, 0), []);

  useEffect(() => {
    const mesh = ivyMeshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    facadeData.ivyInstances.forEach((item, idx) => {
      dummy.position.set(item.pos[0], item.pos[1], item.pos[2]);
      dummy.rotation.set(idx * 0.37, idx * 0.81, idx * 0.19);
      dummy.scale.set(item.scale[0], item.scale[1], item.scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      color.set(item.color);
      mesh.setColorAt(idx, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [facadeData.ivyInstances]);

  useEffect(() => {
    return () => {
      ivyGeo.dispose();
      mats.dispose();
    };
  }, [ivyGeo, mats]);

  // Smooth industrial double-door swing animation (0 -> ±Math.PI * 0.48)
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const targetAngle = mainEntranceState === 'closed' ? 0 : Math.PI * 0.48;
    const leftLeaf = leftLeafRef.current;
    const rightLeaf = rightLeafRef.current;
    if (!leftLeaf || !rightLeaf) return;

    leftLeaf.rotation.y = THREE.MathUtils.damp(leftLeaf.rotation.y, -targetAngle, 5.2, delta);
    rightLeaf.rotation.y = THREE.MathUtils.damp(rightLeaf.rotation.y, targetAngle, 5.2, delta);

    if (
      mainEntranceState === 'opening' &&
      !openedNotifiedRef.current &&
      Math.abs(leftLeaf.rotation.y + targetAngle) < 0.08
    ) {
      openedNotifiedRef.current = true;
      markMainEntranceOpen();
    }
  });

  const handleDoorClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (mainEntranceState === 'closed' && tryOpenMainEntrance()) {
      playHeavyMainEntranceSound(audioEnabled);
    }
  };

  const hw = BUILDING_WIDTH / 2;
  const hd = BUILDING_DEPTH / 2;
  const doorHalf = MAIN_ENTRANCE_WIDTH / 2;
  const leafWidth = doorHalf - 0.06;

  return (
    <group>
      {/* 1. Brick & Stone Architectural Pilasters, Horizontal Belt Courses & Rooftop Parapet */}
      {!effectiveCutaway && (
        <group>
          {/* Vertical brick corner & center facade pilasters on all 4 sides */}
          {[
            [-hw - 0.12, hd + 0.14],
            [-13.5, hd + 0.14],
            [0, hd + 0.14],
            [13.5, hd + 0.14],
            [hw + 0.12, hd + 0.14],
            [-hw - 0.12, -hd - 0.14],
            [0, -hd - 0.14],
            [hw + 0.12, -hd - 0.14],
            [-hw - 0.14, -13.5],
            [-hw - 0.14, 13.5],
            [hw + 0.14, -13.5],
            [hw + 0.14, 13.5],
          ].map(([px, pz], idx) => (
            <mesh
              key={`ext-pilaster-${idx}`}
              position={[px, (FLOOR_HEIGHT * 4) / 2, pz]}
              material={mats.brickMat}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.72, FLOOR_HEIGHT * 4, 0.32]} />
            </mesh>
          ))}

          {/* Horizontal concrete belt courses between floors (South, North, East, West) */}
          {([1, 2, 3, 4] as const).map((fl) => {
            const bandY = FLOOR_ELEVATIONS[fl] + FLOOR_HEIGHT - 0.12;
            return (
              <group key={`belt-${fl}`}>
                <mesh position={[0, bandY, hd + 0.16]} material={mats.trimStoneMat} receiveShadow>
                  <boxGeometry args={[BUILDING_WIDTH + 0.56, 0.24, 0.24]} />
                </mesh>
                <mesh position={[0, bandY, -hd - 0.16]} material={mats.trimStoneMat} receiveShadow>
                  <boxGeometry args={[BUILDING_WIDTH + 0.56, 0.24, 0.24]} />
                </mesh>
                <mesh position={[-hw - 0.16, bandY, 0]} material={mats.trimStoneMat} receiveShadow>
                  <boxGeometry args={[0.24, 0.24, BUILDING_DEPTH + 0.56]} />
                </mesh>
                <mesh position={[hw + 0.16, bandY, 0]} material={mats.trimStoneMat} receiveShadow>
                  <boxGeometry args={[0.24, 0.24, BUILDING_DEPTH + 0.56]} />
                </mesh>
              </group>
            );
          })}

          {/* Ornate Rooftop Parapet Crown */}
          {[
            [0, hd + 0.16, BUILDING_WIDTH + 0.8, 0.5],
            [0, -hd - 0.16, BUILDING_WIDTH + 0.8, 0.5],
            [-hw - 0.16, 0, 0.5, BUILDING_DEPTH + 0.8],
            [hw + 0.16, 0, 0.5, BUILDING_DEPTH + 0.8],
          ].map(([cx, cz, w, d], idx) => (
            <mesh
              key={`parapet-${idx}`}
              position={[cx, FLOOR_HEIGHT * 4 + 0.35, cz]}
              material={mats.trimStoneMat}
              castShadow
            >
              <boxGeometry args={[w, 0.72, d]} />
            </mesh>
          ))}
        </group>
      )}

      {/* 2. Multi-Floor Recessed Windows & Projecting Balconies */}
      {!effectiveCutaway &&
        facadeData.windows.map((win, idx) => (
          <group key={`ext-win-${idx}`} position={win.pos} rotation={[0, win.rotY, 0]}>
            {/* Stone sill & lintel */}
            <mesh position={[0, 0.94, 0.06]} material={mats.trimStoneMat}>
              <boxGeometry args={[1.66, 0.14, 0.2]} />
            </mesh>
            <mesh position={[0, -0.92, 0.08]} material={mats.trimStoneMat}>
              <boxGeometry args={[1.68, 0.12, 0.24]} />
            </mesh>
            {/* Dark iron window frame & mullion cross */}
            <mesh position={[0, 0, 0.02]} material={mats.ironMat}>
              <boxGeometry args={[1.48, 1.72, 0.08]} />
            </mesh>
            <mesh position={[0, 0, 0.055]} material={mats.darkGlassMat}>
              <boxGeometry args={[1.34, 1.56, 0.04]} />
            </mesh>
            <mesh position={[0, 0.12, 0.08]} material={mats.ironMat}>
              <boxGeometry args={[1.36, 0.05, 0.04]} />
            </mesh>
            <mesh position={[0, 0, 0.08]} material={mats.ironMat}>
              <boxGeometry args={[0.05, 1.58, 0.04]} />
            </mesh>

            {/* Projecting Metal-Railed Exterior Balcony */}
            {win.hasBalcony && (
              <group position={[0, -1.04, 0.52]}>
                <mesh position={[0, 0, 0]} material={mats.trimStoneMat} castShadow receiveShadow>
                  <boxGeometry args={[2.1, 0.14, 0.98]} />
                </mesh>
                <mesh position={[0, 0.88, 0.44]} material={mats.ironMat}>
                  <boxGeometry args={[2.08, 0.06, 0.06]} />
                </mesh>
                <mesh position={[-1.0, 0.88, 0]} material={mats.ironMat}>
                  <boxGeometry args={[0.06, 0.06, 0.92]} />
                </mesh>
                <mesh position={[1.0, 0.88, 0]} material={mats.ironMat}>
                  <boxGeometry args={[0.06, 0.06, 0.92]} />
                </mesh>
                {[-0.95, -0.48, 0, 0.48, 0.95].map((bx, bIdx) => (
                  <mesh key={bIdx} position={[bx, 0.44, 0.44]} material={mats.ironMat}>
                    <boxGeometry args={[0.045, 0.82, 0.045]} />
                  </mesh>
                ))}
              </group>
            )}
          </group>
        ))}

      {/* 3. Exterior Industrial Pipes, Electrical Conduits & Junction Boxes */}
      <group>
        {[-25.4, -15.6, 15.4, 25.4].map((px, i) => (
          <group key={`ext-pipe-s-${i}`} position={[px, 0, hd + 0.24]}>
            <mesh position={[0, 8.8, 0]} material={mats.rustPipeMat} castShadow>
              <cylinderGeometry args={[0.08, 0.08, 17.6, 8]} />
            </mesh>
            {[2.2, 6.8, 11.4, 15.8].map((by, j) => (
              <mesh key={j} position={[0, by, 0]} material={mats.ironMat}>
                <boxGeometry args={[0.26, 0.09, 0.22]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* Exterior electrical meter & junction box flanking Main Entrance */}
        <group position={[-17.4, 1.45, hd + 0.22]}>
          <mesh material={mats.ironMat} castShadow>
            <boxGeometry args={[0.68, 0.92, 0.22]} />
          </mesh>
          <mesh position={[0.16, 0.22, 0.12]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.6} />
          </mesh>
        </group>
      </group>

      {/* 4. Instanced Climbing Green Ivy Across Exterior Walls */}
      {!effectiveCutaway && (
        <instancedMesh
          ref={ivyMeshRef}
          args={[ivyGeo, mats.ivyLeafMat, facadeData.ivyInstances.length]}
          castShadow
          receiveShadow
        />
      )}

      {/* 5. MAIN INDUSTRIAL DOUBLE ENTRANCE DOORS & "LAST BREATH" BUILDING SIGN (X = -20.5, Z = 28.0) */}
      <group position={MAIN_ENTRANCE_POS}>
        {/* Heavy Concrete & Aged Steel Portal Surround */}
        <mesh position={[-doorHalf - 0.24, 1.55, 0.06]} material={mats.trimStoneMat} castShadow receiveShadow>
          <boxGeometry args={[0.48, 3.1, 0.56]} />
        </mesh>
        <mesh position={[doorHalf + 0.24, 1.55, 0.06]} material={mats.trimStoneMat} castShadow receiveShadow>
          <boxGeometry args={[0.48, 3.1, 0.56]} />
        </mesh>
        {/* Solid transom masonry header closing top of 4.26m floor wall above the 2.88m door */}
        <mesh position={[0, 3.57, 0.02]} material={mats.trimStoneMat} castShadow receiveShadow>
          <boxGeometry args={[MAIN_ENTRANCE_WIDTH + 0.96, 1.38, 0.42]} />
        </mesh>

        {/* Exterior Entrance Awning Canopy & Support Tie-Rods */}
        <mesh position={[0, 3.16, 1.05]} material={mats.ironMat} castShadow receiveShadow>
          <boxGeometry args={[MAIN_ENTRANCE_WIDTH + 1.2, 0.16, 2.05]} />
        </mesh>
        <mesh position={[-doorHalf - 0.35, 3.55, 0.95]} rotation={[0.58, 0, 0]} material={mats.ironMat}>
          <cylinderGeometry args={[0.03, 0.03, 1.45, 6]} />
        </mesh>
        <mesh position={[doorHalf + 0.35, 3.55, 0.95]} rotation={[0.58, 0, 0]} material={mats.ironMat}>
          <cylinderGeometry args={[0.03, 0.03, 1.45, 6]} />
        </mesh>

        {/* Visible Lit Building Sign: "LAST BREATH" */}
        <mesh position={[0, 3.74, 0.36]} material={mats.signMat} castShadow>
          <boxGeometry args={[3.8, 0.92, 0.14]} />
        </mesh>

        {/* Stone Entry Threshold Step */}
        <mesh position={[0, 0.02, 0.8]} material={mats.trimStoneMat} receiveShadow>
          <boxGeometry args={[MAIN_ENTRANCE_WIDTH + 1.1, 0.06, 1.8]} />
        </mesh>

        {/* Warm Entrance Sconce Lamps Left & Right */}
        {[-doorHalf - 0.3, doorHalf + 0.3].map((lx, idx) => (
          <group key={`entry-sconce-${idx}`} position={[lx, 2.45, 0.38]}>
            <mesh material={mats.ironMat}>
              <boxGeometry args={[0.2, 0.34, 0.16]} />
            </mesh>
            <mesh position={[0, -0.02, 0.07]}>
              <boxGeometry args={[0.14, 0.22, 0.08]} />
              <meshStandardMaterial color="#ffdfb0" emissive="#f59e0b" emissiveIntensity={2.0} />
            </mesh>
          </group>
        ))}
        <pointLight
          position={[0, 2.8, 1.55]}
          color="#ffd599"
          intensity={6.8}
          distance={12}
          decay={1.55}
        />

        {/* Animated Double Industrial Steel Entrance Doors */}
        <group
          ref={leftLeafRef}
          position={[-doorHalf + 0.02, 0, 0]}
          onClick={handleDoorClick}
        >
          <mesh position={[leafWidth / 2, 1.44, 0]} material={mats.mainDoorSteelMat} castShadow receiveShadow>
            <boxGeometry args={[leafWidth, 2.86, 0.1]} />
          </mesh>
          <mesh position={[leafWidth * 0.62, 1.85, 0]} material={mats.darkGlassMat}>
            <boxGeometry args={[0.38, 0.85, 0.12]} />
          </mesh>
          <mesh position={[leafWidth - 0.28, 1.15, 0.08]} material={mats.trimStoneMat}>
            <boxGeometry args={[0.85, 0.07, 0.06]} />
          </mesh>
        </group>

        <group
          ref={rightLeafRef}
          position={[doorHalf - 0.02, 0, 0]}
          onClick={handleDoorClick}
        >
          <mesh position={[-leafWidth / 2, 1.44, 0]} material={mats.mainDoorSteelMat} castShadow receiveShadow>
            <boxGeometry args={[leafWidth, 2.86, 0.1]} />
          </mesh>
          <mesh position={[-leafWidth * 0.62, 1.85, 0]} material={mats.darkGlassMat}>
            <boxGeometry args={[0.38, 0.85, 0.12]} />
          </mesh>
          <mesh position={[-leafWidth + 0.28, 1.15, 0.08]} material={mats.trimStoneMat}>
            <boxGeometry args={[0.85, 0.07, 0.06]} />
          </mesh>
        </group>
      </group>
    </group>
  );
});
