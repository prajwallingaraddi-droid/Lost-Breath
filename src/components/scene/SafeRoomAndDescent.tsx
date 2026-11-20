import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  EMERGENCY_DESCENT_STAIRCASES,
  FLOOR_ELEVATIONS,
  FLOOR_HEIGHT,
  getActivePuzzleEscapeFrame,
} from '../../data/buildingLayout';
import { useGameStore } from '../../store/useGameStore';
import { useIndustrialMaterials } from '../../three/MaterialContext';
import { FloorNumber } from '../../types/game';
import { Staircase } from './Staircase';

function createSignTexture(title: string, subtitle: string, bg: string, border: string, fg: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = border;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = fg;
  ctx.font = 'bold 42px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 62);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 24px "JetBrains Mono", monospace';
  ctx.fillText(subtitle, 256, 114);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export const SafeRoomAndDescent: React.FC = () => {
  const materials = useIndustrialMaterials();
  const layoutVersion = useGameStore((s) => s.layoutVersion);
  const safeRoomUnlocked = useGameStore((s) => s.safeRoomUnlocked);
  const controlMode = useGameStore((s) => s.controlMode);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const cutawayMode = useGameStore((s) => s.cutawayMode);

  const exitBeaconRef = useRef<THREE.PointLight>(null);

  const escapeFrame = useMemo(() => {
    void layoutVersion;
    return getActivePuzzleEscapeFrame();
  }, [layoutVersion]);

  const puzzleFloor = escapeFrame.floor;
  const yTop = FLOOR_ELEVATIONS[puzzleFloor];
  const y1 = FLOOR_ELEVATIONS[1];

  const signs = useMemo(() => {
    const safeRoomPlaque = createSignTexture(
      'SAFE ROOM',
      'BEASTS CANNOT ENTER',
      '#052e16',
      '#22c55e',
      '#86efac'
    );
    const descentPlaque = createSignTexture(
      puzzleFloor === 1 ? 'GROUND EXIT ROUTE →' : 'EMERGENCY DESCENT ↓',
      puzzleFloor === 1 ? 'PROCEED TO GROUND EXIT' : `FLOOR ${puzzleFloor} → FLOOR 1 GROUND EXIT`,
      '#082f49',
      '#38bdf8',
      '#bae6fd'
    );
    const groundExitPlaque = createSignTexture(
      'GROUND EXIT',
      'STEP FORWARD TO ESCAPE',
      '#052e16',
      '#4ade80',
      '#bbf7d0'
    );
    return { safeRoomPlaque, descentPlaque, groundExitPlaque };
  }, [puzzleFloor]);

  useEffect(() => {
    return () => {
      signs.safeRoomPlaque.dispose();
      signs.descentPlaque.dispose();
      signs.groundExitPlaque.dispose();
    };
  }, [signs]);

  useFrame(({ clock }) => {
    if (exitBeaconRef.current) {
      const t = clock.getElapsedTime();
      exitBeaconRef.current.intensity = safeRoomUnlocked ? 6.5 + Math.sin(t * 4.0) * 1.8 : 1.2;
    }
  });

  const effectiveCutaway = controlMode === 'orbit' && cutawayMode;
  const maxVisibleFloor = !effectiveCutaway || activeFloor === 'all' ? 4 : activeFloor;
  const accentColor = safeRoomUnlocked ? '#22c55e' : '#f59e0b';

  const intermediateFloors: FloorNumber[] = [];
  for (let fl = 2; fl < puzzleFloor; fl += 1) {
    intermediateFloors.push(fl as FloorNumber);
  }

  return (
    <group>
      {/* Dynamic Emergency Descent Staircases (world-space coordinates from buildingLayout) */}
      {EMERGENCY_DESCENT_STAIRCASES.filter((s) => s.fromFloor < maxVisibleFloor).map((stair) => (
        <Staircase key={`${stair.id}-${layoutVersion}`} staircase={stair} />
      ))}

      {/* Rotated Safe Room, Stairwell Tower & Ground Extraction Bay aligned to active Puzzle Room */}
      <group
        position={[escapeFrame.centerX, 0, escapeFrame.centerZ]}
        rotation={[0, escapeFrame.rotY, 0]}
      >
        {/* 1. SAFE ROOM ATTACHED TO REAR WALL OF PUZZLE ROOM */}
        {maxVisibleFloor >= puzzleFloor && (
          <group>
            {/* Reinforced Diamond-Plate Safe Room Floor Slab */}
            <mesh position={[-8.7, yTop - 0.14, 0]} material={materials.diamondTread} castShadow receiveShadow>
              <boxGeometry args={[6.1, 0.28, 5.0]} />
            </mesh>
            {/* Cantilever Support Struts underneath Safe Room (only on upper floors) */}
            {puzzleFloor > 1 &&
              [-1.9, 1.9].map((sz) => (
                <mesh
                  key={`sr-strut-${sz}`}
                  position={[-7.5, yTop - 1.4, sz]}
                  rotation={[0, 0, 0.58]}
                  material={materials.structuralSteel}
                  castShadow
                >
                  <boxGeometry args={[0.26, 3.2, 0.26]} />
                </mesh>
              ))}

            {/* North & South Armored Concrete Safe Room Walls */}
            <mesh position={[-8.7, yTop + 2.1, -2.5]} material={materials.concreteExterior} castShadow receiveShadow>
              <boxGeometry args={[6.1, 4.2, 0.2]} />
            </mesh>
            {/* On Floor 1, keep South wall clear above Extraction Bay opening (X: -11.7..-8.15) */}
            {puzzleFloor > 1 ? (
              <mesh position={[-8.7, yTop + 2.1, 2.5]} material={materials.concreteExterior} castShadow receiveShadow>
                <boxGeometry args={[6.1, 4.2, 0.2]} />
              </mesh>
            ) : (
              <mesh position={[-6.9, yTop + 2.1, 2.5]} material={materials.concreteExterior} castShadow receiveShadow>
                <boxGeometry args={[2.5, 4.2, 0.2]} />
              </mesh>
            )}

            {/* Safe Room Ceiling Deck */}
            <mesh position={[-8.7, yTop + 4.25, 0]} material={materials.structuralSteel} castShadow>
              <boxGeometry args={[6.2, 0.22, 5.2]} />
            </mesh>

            {/* Interior Brushed Steel Bulkhead Ribs */}
            {[-7.3, -9.5, -11.3].map((rx) => (
              <group key={`sr-rib-${rx}`}>
                <mesh position={[rx, yTop + 2.1, -2.34]} material={materials.brushedSteel}>
                  <boxGeometry args={[0.24, 4.1, 0.14]} />
                </mesh>
                {puzzleFloor > 1 && (
                  <mesh position={[rx, yTop + 2.1, 2.34]} material={materials.brushedSteel}>
                    <boxGeometry args={[0.24, 4.1, 0.14]} />
                  </mesh>
                )}
              </group>
            ))}

            {/* Safe Room Threshold Hazard Stripe & Green Overhead Clearance Strip */}
            <mesh position={[-6.15, yTop + 0.02, 0]} material={materials.hazardStripe}>
              <boxGeometry args={[0.45, 0.03, 3.2]} />
            </mesh>
            <mesh position={[-8.7, yTop + 4.08, 0]}>
              <boxGeometry args={[4.6, 0.08, 0.35]} />
              <meshStandardMaterial
                color={accentColor}
                emissive={accentColor}
                emissiveIntensity={safeRoomUnlocked ? 2.1 : 0.7}
              />
            </mesh>

            {/* Wall Signage: SAFE ROOM + EMERGENCY DESCENT */}
            <mesh position={[-8.7, yTop + 2.75, -2.35]}>
              <planeGeometry args={[2.5, 0.8]} />
              <meshBasicMaterial map={signs.safeRoomPlaque} />
            </mesh>
            <mesh position={[-11.55, yTop + 2.85, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[2.6, 0.82]} />
              <meshBasicMaterial map={signs.descentPlaque} />
            </mesh>

            {/* Safe Room Green Illumination */}
            <pointLight
              position={[-8.9, yTop + 3.4, 0]}
              color="#22c55e"
              intensity={safeRoomUnlocked ? 5.5 : 1.2}
              distance={14}
              decay={1.4}
            />
          </group>
        )}

        {/* 2. ENCLOSED MULTI-LEVEL EMERGENCY DESCENT STAIRWELL TOWER (when puzzleFloor >= 2) */}
        {puzzleFloor >= 2 && (
          <>
            {/* Top Entry Landing Deck at Puzzle Floor */}
            {maxVisibleFloor >= puzzleFloor && (
              <mesh position={[-13.9, yTop - 0.14, 0.8]} material={materials.diamondTread} castShadow receiveShadow>
                <boxGeometry args={[4.5, 0.28, 3.4]} />
              </mesh>
            )}

            {/* Intermediate Switchback Landing Decks (F2 for F3; F2 & F3 for F4) */}
            {intermediateFloors.map((fl) => {
              if (maxVisibleFloor < fl) return null;
              const yFl = FLOOR_ELEVATIONS[fl];
              return (
                <group key={`descent-landing-${fl}`}>
                  <mesh position={[-13.9, yFl - 0.14, 0.8]} material={materials.diamondTread} castShadow receiveShadow>
                    <boxGeometry args={[4.5, 0.28, 3.4]} />
                  </mesh>
                  <mesh position={[-13.9, yFl + 2.65, 2.34]} rotation={[0, Math.PI, 0]}>
                    <planeGeometry args={[2.4, 0.76]} />
                    <meshBasicMaterial map={signs.descentPlaque} />
                  </mesh>
                  <mesh position={[-13.9, yFl + 4.1, 0.8]}>
                    <boxGeometry args={[2.8, 0.08, 0.28]} />
                    <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} />
                  </mesh>
                </group>
              );
            })}

            {/* Stairwell Tower Structural Enclosure Walls */}
            {(() => {
              const clampedMaxFloor = Math.min(maxVisibleFloor, puzzleFloor);
              const towerH = clampedMaxFloor * FLOOR_HEIGHT + (maxVisibleFloor >= puzzleFloor ? 4.3 : 0);
              const towerMidY = towerH / 2;
              const lowerEastH = Math.max(0, yTop);
              return (
                <group>
                  {/* Outer West Wall (local X = -16.15) */}
                  <mesh position={[-16.15, towerMidY, -1.0]} material={materials.concreteExterior} castShadow receiveShadow>
                    <boxGeometry args={[0.24, towerH, 11.4]} />
                  </mesh>
                  {/* Outer North Wall (local Z = -6.6) */}
                  <mesh position={[-13.9, towerMidY, -6.6]} material={materials.concreteExterior} castShadow receiveShadow>
                    <boxGeometry args={[4.7, towerH, 0.24]} />
                  </mesh>
                  {/* East Shaft Wall separating stairwell from Building exterior */}
                  <mesh position={[-11.68, towerMidY, -4.5]} material={materials.concreteExterior} castShadow receiveShadow>
                    <boxGeometry args={[0.24, towerH, 4.2]} />
                  </mesh>
                  {/* East Wall Closing Floors below Safe Room */}
                  {lowerEastH > 0.5 && (
                    <mesh
                      position={[-11.68, lowerEastH / 2, -0.4]}
                      material={materials.concreteExterior}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[0.24, lowerEastH, 4.2]} />
                    </mesh>
                  )}
                  {/* South Wall Closing Upper Floors above Ground Extraction Bay */}
                  {towerH > 4.5 && (
                    <mesh
                      position={[-13.9, 4.3 + (towerH - 4.3) / 2, 2.5]}
                      material={materials.concreteExterior}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[4.7, towerH - 4.3, 0.24]} />
                    </mesh>
                  )}
                  {/* Tower Roof Cap */}
                  {maxVisibleFloor >= puzzleFloor && (
                    <mesh position={[-13.9, yTop + 4.28, -2.05]} material={materials.structuralSteel} castShadow>
                      <boxGeometry args={[4.8, 0.24, 9.3]} />
                    </mesh>
                  )}
                </group>
              );
            })()}
          </>
        )}

        {/* Floor 1 West/North enclosure for Direct Ground Extraction Bay when puzzleFloor === 1 */}
        {puzzleFloor === 1 && (
          <group>
            <mesh position={[-16.15, y1 + 2.15, 1.1]} material={materials.concreteExterior} castShadow receiveShadow>
              <boxGeometry args={[0.24, 4.3, 7.2]} />
            </mesh>
            <mesh position={[-13.9, y1 + 2.15, -2.5]} material={materials.concreteExterior} castShadow receiveShadow>
              <boxGeometry args={[4.7, 4.3, 0.24]} />
            </mesh>
            <mesh position={[-13.9, y1 + 4.28, 0.0]} material={materials.structuralSteel} castShadow>
              <boxGeometry args={[4.8, 0.22, 5.2]} />
            </mesh>
            <mesh position={[-13.9, y1 - 0.14, 0.0]} material={materials.diamondTread} receiveShadow>
              <boxGeometry args={[4.6, 0.28, 5.0]} />
            </mesh>
          </group>
        )}

        {/* 3. FLOOR 1 GROUND-LEVEL EMERGENCY EXTRACTION BAY (Y = 0.0) */}
        <group>
          {/* Ground Floor Concrete & Diamond-Plate Extraction Platform */}
          <mesh position={[-12.1, y1 - 0.14, 1.8]} material={materials.diamondTread} receiveShadow>
            <boxGeometry args={[8.1, 0.28, 5.8]} />
          </mesh>
          {/* Ground Extraction Bay Enclosure Walls & Roof */}
          <mesh position={[-12.1, y1 + 2.15, 4.65]} material={materials.concreteExterior} castShadow receiveShadow>
            <boxGeometry args={[8.1, 4.3, 0.24]} />
          </mesh>
          <mesh position={[-8.15, y1 + 2.15, 3.05]} material={materials.concreteExterior} castShadow receiveShadow>
            <boxGeometry args={[0.24, 4.3, 3.2]} />
          </mesh>
          <mesh position={[-12.1, y1 + 4.3, 3.05]} material={materials.structuralSteel} castShadow>
            <boxGeometry args={[8.1, 0.22, 3.3]} />
          </mesh>

          {/* Glowing Ground-Floor Extraction Zone Floor Pad & Hazard Border */}
          <mesh position={[-12.15, y1 + 0.025, 3.0]} material={materials.hazardStripe}>
            <boxGeometry args={[7.1, 0.04, 2.4]} />
          </mesh>

          {/* Glowing Green Ground Extraction Gate Signage */}
          <mesh position={[-12.1, y1 + 2.7, 4.46]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[3.4, 1.05]} />
            <meshBasicMaterial map={signs.groundExitPlaque} />
          </mesh>

          {/* Flanking Green Extraction Beacons */}
          {[-14.9, -9.3].map((bx) => (
            <mesh key={`g-beacon-${bx}`} position={[bx, y1 + 2.5, 4.2]}>
              <cylinderGeometry args={[0.16, 0.16, 0.44, 12]} />
              <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2.6} />
            </mesh>
          ))}

          {/* Overhead Extraction Light */}
          <pointLight
            ref={exitBeaconRef}
            position={[-12.1, y1 + 3.4, 3.0]}
            color="#4ade80"
            intensity={6.5}
            distance={16}
            decay={1.4}
          />
        </group>
      </group>
    </group>
  );
};
