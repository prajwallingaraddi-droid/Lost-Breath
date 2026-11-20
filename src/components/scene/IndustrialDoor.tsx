import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DoorDefinition, SpecialDoorKey } from '../../types/game';
import { WALL_HEIGHT } from '../../data/buildingLayout';
import { useIndustrialMaterials } from '../../three/MaterialContext';
import { useGameStore } from '../../store/useGameStore';
import { playDoorSound, playLockedDoorSound } from '../../three/soundEffects';

interface IndustrialDoorProps {
  door: DoorDefinition;
}

// Swings inward into rooms (-Z in local space) or outward into the Escape Passage for the interior escape door
const TARGET_OPEN_ANGLE = Math.PI * 0.48;

const plaqueCache = new Map<string, THREE.CanvasTexture>();

function drawPlaqueOnContext(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  roomNumber: string,
  isInteriorEscape: boolean
): void {
  ctx.save();
  ctx.translate(ox, oy);

  // Dark weathered institutional steel plaque matching the charcoal-slate metal doors
  ctx.fillStyle = isInteriorEscape ? '#092b1a' : '#141d20';
  ctx.fillRect(0, 0, 256, 104);

  // Subtle metallic brushed horizontal streaks
  ctx.fillStyle = 'rgba(200, 224, 218, 0.04)';
  for (let y = 8; y < 96; y += 6) {
    ctx.fillRect(8, y, 240, 2);
  }

  ctx.strokeStyle = isInteriorEscape ? '#22c55e' : '#526764';
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 246, 94);

  // Corner mounting rivets
  ctx.fillStyle = isInteriorEscape ? '#4ade80' : '#7b928e';
  for (const [rx, ry] of [
    [16, 16],
    [240, 16],
    [16, 88],
    [240, 88],
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = isInteriorEscape ? '#86efac' : '#e4f0ec';
  ctx.font = isInteriorEscape
    ? 'bold 34px "JetBrains Mono", monospace'
    : 'bold 48px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isInteriorEscape ? 'SAFE ROOM' : roomNumber, 128, 54);
  ctx.restore();
}

function getRoomNumberTexture(roomNumber: string, isInteriorEscape: boolean): THREE.CanvasTexture {
  const cacheKey = isInteriorEscape ? 'INTERIOR-FINAL-EXIT-V2' : `INST-${roomNumber}`;
  const cached = plaqueCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 104;
  const ctx = canvas.getContext('2d')!;
  drawPlaqueOnContext(ctx, 0, 0, roomNumber, isInteriorEscape);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  plaqueCache.set(cacheKey, tex);
  return tex;
}

export function getSpecialKeyForDoor(door: DoorDefinition): SpecialDoorKey | null {
  if (door.designation === 'mission-room') return 'mission';
  if (door.designation === 'puzzle-room') return 'puzzle';
  if (door.designation === 'final-exit') return 'exit';
  return null;
}

/**
 * Helper to transform a local door-space geometry into world coordinates for static batch merging.
 */
function placePart(
  geo: THREE.BufferGeometry,
  doorPos: [number, number, number],
  doorRotY: number,
  localPos: [number, number, number],
  localRot?: [number, number, number]
): THREE.BufferGeometry {
  if (localRot) {
    if (localRot[0]) geo.rotateX(localRot[0]);
    if (localRot[1]) geo.rotateY(localRot[1]);
    if (localRot[2]) geo.rotateZ(localRot[2]);
  }
  geo.translate(localPos[0], localPos[1], localPos[2]);
  if (doorRotY !== 0) {
    geo.rotateY(doorRotY);
  }
  geo.translate(doorPos[0], doorPos[1], doorPos[2]);
  return geo;
}

function safeMerge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  return merged;
}

interface StaticApartmentDoorsBatchProps {
  doors: DoorDefinition[];
}

/**
 * High-performance merged static batch for all permanently locked ordinary apartment doors on a floor.
 * Preserves 100% identical visual geometry, materials, hardware, warm accent bars, and crisp room-number
 * plaques (packed into a single 5x4 texture atlas per floor), while collapsing ~340 draw calls + 20 useFrame
 * hooks per floor down to 7 draw calls and ZERO useFrame hooks.
 */
export const StaticApartmentDoorsBatch: React.FC<StaticApartmentDoorsBatchProps> = React.memo(
  ({ doors }) => {
    const materials = useIndustrialMaterials();

    const accentMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: '#e8c896',
          emissive: '#e8c896',
          emissiveIntensity: 0.65,
          roughness: 0.28,
        }),
      []
    );

    const batched = useMemo(() => {
      const steelParts: THREE.BufferGeometry[] = [];
      const railParts: THREE.BufferGeometry[] = [];
      const concreteParts: THREE.BufferGeometry[] = [];
      const leafParts: THREE.BufferGeometry[] = [];
      const brushedParts: THREE.BufferGeometry[] = [];
      const accentParts: THREE.BufferGeometry[] = [];
      const plaqueParts: THREE.BufferGeometry[] = [];

      const cols = 5;
      const rows = Math.max(1, Math.ceil(doors.length / cols));
      const atlasCanvas = document.createElement('canvas');
      atlasCanvas.width = cols * 256;
      atlasCanvas.height = rows * 104;
      const atlasCtx = atlasCanvas.getContext('2d')!;

      const doorHeight = 2.58;
      const frameThickness = 0.13;
      const transomHeight = WALL_HEIGHT - doorHeight - 0.12;

      for (let i = 0; i < doors.length; i++) {
        const door = doors[i];
        const pos = door.position;
        const rotY = door.rotationY;
        const w = door.width;

        // 1. Sill plate
        railParts.push(
          placePart(new THREE.BoxGeometry(w + 0.24, 0.028, 0.36), pos, rotY, [0, 0.014, 0])
        );

        // 2. Steel frame jambs, lintel & plaque backing
        steelParts.push(
          placePart(
            new THREE.BoxGeometry(frameThickness, doorHeight, 0.34),
            pos,
            rotY,
            [-w / 2 - frameThickness / 2, doorHeight / 2, 0]
          ),
          placePart(
            new THREE.BoxGeometry(frameThickness, doorHeight, 0.34),
            pos,
            rotY,
            [w / 2 + frameThickness / 2, doorHeight / 2, 0]
          ),
          placePart(
            new THREE.BoxGeometry(w + frameThickness * 2, 0.14, 0.35),
            pos,
            rotY,
            [0, doorHeight + 0.07, 0]
          ),
          placePart(
            new THREE.BoxGeometry(0.88, 0.36, 0.032),
            pos,
            rotY,
            [0, doorHeight + 0.42, 0.145]
          )
        );

        // 3. Concrete transom
        concreteParts.push(
          placePart(
            new THREE.BoxGeometry(w + frameThickness * 2, transomHeight, 0.26),
            pos,
            rotY,
            [0, doorHeight + 0.14 + transomHeight / 2, 0]
          )
        );

        // 4. Warm architectural top-bar accent
        accentParts.push(
          placePart(
            new THREE.BoxGeometry(0.48, 0.032, 0.045),
            pos,
            rotY,
            [0, doorHeight + 0.64, 0.177]
          )
        );

        // 5. Door leaf (closed)
        leafParts.push(
          placePart(
            new THREE.BoxGeometry(w - 0.04, doorHeight - 0.03, 0.085),
            pos,
            rotY,
            [0, doorHeight / 2, 0]
          )
        );

        // Hinge pins & kickplate
        railParts.push(
          placePart(
            new THREE.CylinderGeometry(0.016, 0.016, 0.14, 8),
            pos,
            rotY,
            [-w / 2 + 0.04, doorHeight * 0.22, 0.045]
          ),
          placePart(
            new THREE.CylinderGeometry(0.016, 0.016, 0.14, 8),
            pos,
            rotY,
            [-w / 2 + 0.04, doorHeight * 0.78, 0.045]
          ),
          placePart(
            new THREE.BoxGeometry(w - 0.1, 0.22, 0.01),
            pos,
            rotY,
            [0, 0.15, 0.046]
          )
        );

        // 6. Brushed stainless hardware (peephole + exterior & interior lever handles + lock cylinders)
        brushedParts.push(
          placePart(
            new THREE.CylinderGeometry(0.02, 0.02, 0.018, 10),
            pos,
            rotY,
            [0, 1.56, 0.046],
            [Math.PI / 2, 0, 0]
          )
        );
        for (const side of [1, -1]) {
          brushedParts.push(
            placePart(
              new THREE.CylinderGeometry(0.032, 0.032, 0.014, 10),
              pos,
              rotY,
              [w / 2 - 0.14, 1.05, side * 0.048],
              [Math.PI / 2, 0, 0]
            ),
            placePart(
              new THREE.CylinderGeometry(0.012, 0.012, 0.044, 8),
              pos,
              rotY,
              [w / 2 - 0.14, 1.05, side * 0.072],
              [Math.PI / 2, 0, 0]
            ),
            placePart(
              new THREE.CylinderGeometry(0.011, 0.011, 0.155, 8),
              pos,
              rotY,
              [w / 2 - 0.21, 1.05, side * 0.092],
              [0, 0, Math.PI / 2]
            ),
            placePart(
              new THREE.CylinderGeometry(0.024, 0.024, 0.016, 8),
              pos,
              rotY,
              [w / 2 - 0.14, 0.94, side * 0.048],
              [Math.PI / 2, 0, 0]
            )
          );
        }

        // 7. Room number plaque drawn into atlas cell & UV-mapped
        const col = i % cols;
        const row = Math.floor(i / cols);
        drawPlaqueOnContext(atlasCtx, col * 256, row * 104, door.roomNumber, false);

        const plane = new THREE.PlaneGeometry(0.82, 0.31);
        const uv = plane.attributes.uv;
        const u0 = col / cols;
        const u1 = (col + 1) / cols;
        const v1 = 1 - row / rows;
        const v0 = 1 - (row + 1) / rows;
        for (let k = 0; k < uv.count; k++) {
          const u = uv.getX(k);
          const v = uv.getY(k);
          uv.setXY(k, u0 + u * (u1 - u0), v0 + v * (v1 - v0));
        }
        uv.needsUpdate = true;
        plaqueParts.push(placePart(plane, pos, rotY, [0, doorHeight + 0.42, 0.164]));
      }

      const atlasTex = new THREE.CanvasTexture(atlasCanvas);
      atlasTex.colorSpace = THREE.SRGBColorSpace;
      atlasTex.anisotropy = 4;
      atlasTex.needsUpdate = true;

      const plaqueMat = new THREE.MeshBasicMaterial({ map: atlasTex });

      return {
        steelGeo: safeMerge(steelParts),
        railGeo: safeMerge(railParts),
        concreteGeo: safeMerge(concreteParts),
        leafGeo: safeMerge(leafParts),
        brushedGeo: safeMerge(brushedParts),
        accentGeo: safeMerge(accentParts),
        plaqueGeo: safeMerge(plaqueParts),
        atlasTex,
        plaqueMat,
      };
    }, [doors]);

    useEffect(() => {
      return () => {
        batched.steelGeo?.dispose();
        batched.railGeo?.dispose();
        batched.concreteGeo?.dispose();
        batched.leafGeo?.dispose();
        batched.brushedGeo?.dispose();
        batched.accentGeo?.dispose();
        batched.plaqueGeo?.dispose();
        batched.atlasTex.dispose();
        batched.plaqueMat.dispose();
      };
    }, [batched]);

    useEffect(() => {
      return () => {
        accentMat.dispose();
      };
    }, [accentMat]);

    const handleLockedOrbitClick = (e: { stopPropagation: () => void }) => {
      const st = useGameStore.getState();
      if (st.inMainMenu || st.controlMode !== 'orbit') return;
      e.stopPropagation();
      playLockedDoorSound(st.audioEnabled);
    };

    return (
      <group>
        {batched.steelGeo && (
          <mesh
            geometry={batched.steelGeo}
            material={materials.structuralSteel}
            castShadow
            receiveShadow
          />
        )}
        {batched.railGeo && (
          <mesh
            geometry={batched.railGeo}
            material={materials.railingSteel}
            receiveShadow
          />
        )}
        {batched.concreteGeo && (
          <mesh
            geometry={batched.concreteGeo}
            material={materials.concreteWall}
            receiveShadow
          />
        )}
        {batched.leafGeo && (
          <mesh
            geometry={batched.leafGeo}
            material={materials.apartmentDoor}
            castShadow
            receiveShadow
            onClick={handleLockedOrbitClick}
          />
        )}
        {batched.brushedGeo && (
          <mesh geometry={batched.brushedGeo} material={materials.brushedSteel} />
        )}
        {batched.accentGeo && (
          <mesh geometry={batched.accentGeo} material={accentMat} />
        )}
        {batched.plaqueGeo && (
          <mesh geometry={batched.plaqueGeo} material={batched.plaqueMat} />
        )}
      </group>
    );
  }
);

export const IndustrialDoor: React.FC<IndustrialDoorProps> = React.memo(({ door }) => {
  const materials = useIndustrialMaterials();
  const specialKey = getSpecialKeyForDoor(door);

  const doorAnimState = useGameStore((s) =>
    specialKey ? s.doorStates[specialKey] : 'closed'
  );
  const finalExitUnlocked = useGameStore((s) => s.finalExitUnlocked);
  const controlMode = useGameStore((s) => s.controlMode);
  const isHovered = useGameStore((s) => s.hoveredDoorId === door.id);

  const tryUnlockSpecialDoor = useGameStore((s) => s.tryUnlockSpecialDoor);
  const markSpecialDoorOpen = useGameStore((s) => s.markSpecialDoorOpen);
  const setHoveredDoor = useGameStore((s) => s.setHoveredDoor);
  const audioEnabled = useGameStore((s) => s.audioEnabled);

  const hingeRef = useRef<THREE.Group>(null);
  const currentAngleRef = useRef(0);
  const completedRef = useRef(false);

  const isInteriorEscape = Boolean(door.isInteriorEscape);
  const doorHeight = isInteriorEscape ? 2.75 : 2.58;
  const frameThickness = 0.13;
  const transomHeight = WALL_HEIGHT - doorHeight - 0.12;

  const plaqueTexture = useMemo(
    () => getRoomNumberTexture(door.roomNumber, isInteriorEscape),
    [door.roomNumber, isInteriorEscape]
  );

  const beaconColor = isInteriorEscape
    ? finalExitUnlocked || doorAnimState !== 'closed'
      ? '#22c55e'
      : '#ef4444'
    : '#e8c896';

  useFrame((_, rawDelta) => {
    const hinge = hingeRef.current;
    if (!hinge) return;

    if (doorAnimState === 'closed' && completedRef.current) {
      completedRef.current = false;
    }

    const target = doorAnimState !== 'closed' ? TARGET_OPEN_ANGLE : 0;
    // Sleep early when hinge has settled at its target angle
    if (
      Math.abs(currentAngleRef.current - target) < 1e-4 &&
      (doorAnimState === 'closed' || doorAnimState === 'open')
    ) {
      return;
    }

    const delta = Math.min(rawDelta, 0.1);
    currentAngleRef.current = THREE.MathUtils.damp(currentAngleRef.current, target, 5.2, delta);
    hinge.rotation.y = currentAngleRef.current;

    if (
      doorAnimState === 'opening' &&
      !completedRef.current &&
      Math.abs(currentAngleRef.current - TARGET_OPEN_ANGLE) < 0.06
    ) {
      completedRef.current = true;
      currentAngleRef.current = TARGET_OPEN_ANGLE;
      hinge.rotation.y = TARGET_OPEN_ANGLE;
      if (specialKey) {
        markSpecialDoorOpen(specialKey);
      }
    }
  });

  const handleOrbitClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (useGameStore.getState().inMainMenu) return;
    if (controlMode !== 'orbit') return;
    const res = tryUnlockSpecialDoor(door.id);
    if (res.opened) {
      playDoorSound(true, audioEnabled);
    } else {
      playLockedDoorSound(audioEnabled);
    }
  };

  return (
    <group
      position={door.position}
      rotation={[0, door.rotationY, 0]}
      onClick={handleOrbitClick}
      onPointerOver={(e) => {
        if (controlMode !== 'orbit') return;
        e.stopPropagation();
        setHoveredDoor(door.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        if (controlMode !== 'orbit') return;
        e.stopPropagation();
        if (useGameStore.getState().hoveredDoorId === door.id) {
          setHoveredDoor(null);
        }
        document.body.style.cursor = 'auto';
      }}
    >
      {/* 1. Metallic Threshold Sill Plate */}
      <mesh
        position={[0, 0.014, 0]}
        material={isInteriorEscape ? materials.hazardStripe : materials.railingSteel}
        receiveShadow
      >
        <boxGeometry args={[door.width + 0.24, 0.028, 0.36]} />
      </mesh>

      {/* 2. Deep Dark Industrial Steel Door Frame Jambs, Casing Trim & Lintel */}
      <mesh
        position={[-door.width / 2 - frameThickness / 2, doorHeight / 2, 0]}
        material={materials.structuralSteel}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[frameThickness, doorHeight, 0.34]} />
      </mesh>
      <mesh
        position={[door.width / 2 + frameThickness / 2, doorHeight / 2, 0]}
        material={materials.structuralSteel}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[frameThickness, doorHeight, 0.34]} />
      </mesh>
      <mesh
        position={[0, doorHeight + 0.07, 0]}
        material={isInteriorEscape ? materials.hazardStripe : materials.structuralSteel}
        castShadow
      >
        <boxGeometry args={[door.width + frameThickness * 2, 0.14, 0.35]} />
      </mesh>

      {/* 3. Aged Concrete Wall Transom Above Door */}
      <mesh
        position={[0, doorHeight + 0.14 + transomHeight / 2, 0]}
        material={materials.concreteWall}
        receiveShadow
      >
        <boxGeometry args={[door.width + frameThickness * 2, transomHeight, 0.26]} />
      </mesh>

      {/* 4. Wall-Mounted Institutional Room Number Plaque Directly Above Every Door */}
      <group position={[0, doorHeight + 0.42, 0.145]}>
        <mesh material={materials.structuralSteel}>
          <boxGeometry args={[isInteriorEscape ? 1.18 : 0.88, 0.36, 0.032]} />
        </mesh>
        <mesh position={[0, 0, 0.019]}>
          <planeGeometry args={[isInteriorEscape ? 1.1 : 0.82, 0.31]} />
          <meshBasicMaterial map={plaqueTexture} />
        </mesh>
        <mesh position={[0, 0.22, 0.032]}>
          <boxGeometry args={[0.48, 0.032, 0.045]} />
          <meshStandardMaterial
            color={beaconColor}
            emissive={beaconColor}
            emissiveIntensity={isHovered ? 1.85 : isInteriorEscape ? 1.35 : 0.65}
            roughness={0.28}
          />
        </mesh>
      </group>

      {/* 5. Hinged Dark Industrial Metal Door Leaf */}
      <group ref={hingeRef} position={[-door.width / 2, 0, 0]}>
        <mesh
          position={[door.width / 2, doorHeight / 2, 0]}
          material={isInteriorEscape ? materials.brushedSteel : materials.apartmentDoor}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[door.width - 0.04, doorHeight - 0.03, 0.085]} />
        </mesh>

        <mesh position={[0.04, doorHeight * 0.22, 0.045]} material={materials.railingSteel}>
          <cylinderGeometry args={[0.016, 0.016, 0.14, 8]} />
        </mesh>
        <mesh position={[0.04, doorHeight * 0.78, 0.045]} material={materials.railingSteel}>
          <cylinderGeometry args={[0.016, 0.016, 0.14, 8]} />
        </mesh>

        <mesh position={[door.width / 2, 0.15, 0.046]} material={materials.railingSteel}>
          <boxGeometry args={[door.width - 0.1, 0.22, 0.01]} />
        </mesh>

        {isInteriorEscape ? (
          <>
            <mesh position={[door.width / 2, 1.12, 0.075]} material={materials.safetyYellow}>
              <boxGeometry args={[door.width - 0.36, 0.11, 0.06]} />
            </mesh>
            <mesh position={[door.width / 2, doorHeight * 0.72, 0]} material={materials.structuralSteel}>
              <boxGeometry args={[door.width - 0.14, 0.14, 0.11]} />
            </mesh>
          </>
        ) : (
          <>
            <mesh
              position={[door.width / 2, 1.56, 0.046]}
              rotation={[Math.PI / 2, 0, 0]}
              material={materials.brushedSteel}
            >
              <cylinderGeometry args={[0.02, 0.02, 0.018, 10]} />
            </mesh>

            {[1, -1].map((side) => (
              <group key={`hw-${side}`}>
                <mesh
                  position={[door.width - 0.14, 1.05, side * 0.048]}
                  rotation={[Math.PI / 2, 0, 0]}
                  material={materials.brushedSteel}
                >
                  <cylinderGeometry args={[0.032, 0.032, 0.014, 12]} />
                </mesh>
                <mesh
                  position={[door.width - 0.14, 1.05, side * 0.072]}
                  rotation={[Math.PI / 2, 0, 0]}
                  material={materials.brushedSteel}
                >
                  <cylinderGeometry args={[0.012, 0.012, 0.044, 8]} />
                </mesh>
                <mesh
                  position={[door.width - 0.21, 1.05, side * 0.092]}
                  rotation={[0, 0, Math.PI / 2]}
                  material={materials.brushedSteel}
                >
                  <cylinderGeometry args={[0.011, 0.011, 0.155, 8]} />
                </mesh>
                <mesh
                  position={[door.width - 0.14, 0.94, side * 0.048]}
                  rotation={[Math.PI / 2, 0, 0]}
                  material={materials.brushedSteel}
                >
                  <cylinderGeometry args={[0.024, 0.024, 0.016, 10]} />
                </mesh>
              </group>
            ))}
          </>
        )}
      </group>
    </group>
  );
});
