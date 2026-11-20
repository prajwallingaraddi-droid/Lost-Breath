import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getActivePuzzleEscapeFrame } from '../../data/buildingLayout';
import { useIndustrialMaterials } from '../../three/MaterialContext';
import { useGameStore } from '../../store/useGameStore';
import { barrierFeedbackState } from '../../three/playerWorldState';

function createMonitorTexture(title: string, lines: string[], accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#07111e';
  ctx.fillRect(0, 0, 512, 320);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 320);
    ctx.stroke();
  }
  for (let y = 0; y < 320; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  ctx.fillStyle = accent;
  ctx.fillRect(18, 18, 476, 36);
  ctx.fillStyle = '#060c14';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(title, 30, 43);

  ctx.fillStyle = '#bae6fd';
  ctx.font = '18px monospace';
  lines.forEach((line, i) => {
    ctx.fillText(line, 24, 96 + i * 38);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export const PuzzleChamberInterior: React.FC = () => {
  const materials = useIndustrialMaterials();
  const layoutVersion = useGameStore((s) => s.layoutVersion);
  const puzzleRoomEntered = useGameStore((s) => s.puzzleRoomEntered);
  const beastAlerted = useGameStore((s) => s.beastAlerted);
  const puzzleProtectionActive = useGameStore((s) => s.puzzleProtectionActive);
  const puzzleTimerExpired = useGameStore((s) => s.puzzleTimerExpired);
  const completedPuzzles = useGameStore((s) => s.completedPuzzles);
  const allPuzzlesCompleted = useGameStore((s) => s.allPuzzlesCompleted);

  const beaconLightRef = useRef<THREE.PointLight>(null);
  const beaconCapRef = useRef<THREE.Mesh>(null);
  const barrierFieldMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const escapeFrame = useMemo(() => {
    void layoutVersion;
    return getActivePuzzleEscapeFrame();
  }, [layoutVersion]);

  const monitorTextures = useMemo(() => {
    const tLeft = createMonitorTexture(
      'SECURITY OVERRIDE',
      ['4 MINI-GAME PROTOCOLS', 'MATHEMATICS · CARDS', 'MEMORY · MECHANICAL', 'TIME LIMIT: 05:00'],
      '#38bdf8'
    );
    const tCenter = createMonitorTexture(
      'PUZZLE CHAMBER OS',
      ['SELECT ONE PROTOCOL', 'SOLVE ONE CHALLENGE', 'TO UNLOCK SAFE ROOM', '4 HUNTERS OUTSIDE'],
      '#eab308'
    );
    const tRight = createMonitorTexture(
      'SAFE ROOM ACCESS',
      ['CONTAINMENT SHIELD: ON', 'REAR DOOR: SAFE ROOM', 'EMERGENCY DESCENT TO', 'FLOOR 1 GROUND EXIT'],
      '#22c55e'
    );
    return { tLeft, tCenter, tRight };
  }, []);

  useEffect(() => {
    return () => {
      monitorTextures.tLeft.dispose();
      monitorTextures.tCenter.dispose();
      monitorTextures.tRight.dispose();
    };
  }, [monitorTextures]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beaconLightRef.current) {
      if (puzzleTimerExpired) {
        beaconLightRef.current.intensity = 7.0 + Math.sin(t * 11.0) * 4.0;
      } else if (beastAlerted && !allPuzzlesCompleted) {
        beaconLightRef.current.intensity = 5.5 + Math.sin(t * 7.0) * 3.5;
      } else {
        beaconLightRef.current.intensity = 4.2;
      }
    }
    if (beaconCapRef.current && beastAlerted) {
      beaconCapRef.current.rotation.y = t * 4.5;
    }
    if (barrierFieldMatRef.current) {
      const impactAgeMs = performance.now() - barrierFeedbackState.lastImpactMs;
      const impactBoost = impactAgeMs < 380 ? (1 - impactAgeMs / 380) * 2.4 : 0;
      barrierFieldMatRef.current.opacity = 0.24 + Math.sin(t * 4.5) * 0.05 + impactBoost * 0.16;
      barrierFieldMatRef.current.emissiveIntensity = 1.6 + impactBoost;
    }
  });

  const activeCircuitCount = allPuzzlesCompleted ? 3 : completedPuzzles.length;
  const circuitBreakers = [
    allPuzzlesCompleted || activeCircuitCount >= 1,
    allPuzzlesCompleted,
    allPuzzlesCompleted,
  ];
  const keypadSolved = allPuzzlesCompleted;

  return (
    <group
      position={[escapeFrame.centerX, escapeFrame.elevation, escapeFrame.centerZ]}
      rotation={[0, escapeFrame.rotY, 0]}
    >
      {/* 1. Metallic Diamond-Plate Floor & Threshold Hazard Stripe */}
      <mesh position={[0, 0.03, 0]} material={materials.diamondTread} receiveShadow>
        <boxGeometry args={[10.8, 0.04, 5.1]} />
      </mesh>
      <mesh position={[5.15, 0.036, 0]} material={materials.hazardStripe}>
        <boxGeometry args={[0.45, 0.045, 2.4]} />
      </mesh>

      {/* 2. Brushed Steel Flanking Panels around Rear Escape Doorway */}
      {[-1.95, 1.95].map((wz) => (
        <mesh key={`p-clad-${wz}`} position={[-5.46, 2.0, wz]} material={materials.brushedSteel}>
          <boxGeometry args={[0.08, 3.6, 1.1]} />
        </mesh>
      ))}

      {/* 3. Mainframe Desk + 3 Computer Monitors */}
      <group position={[1.7, 0, -1.75]}>
        <mesh position={[0, 0.52, 0]} material={materials.structuralSteel} castShadow receiveShadow>
          <boxGeometry args={[2.8, 1.04, 1.1]} />
        </mesh>
        <mesh position={[0, 1.07, 0.05]} material={materials.brushedSteel}>
          <boxGeometry args={[2.86, 0.08, 1.15]} />
        </mesh>

        <group position={[-0.95, 1.54, 0.14]} rotation={[0, 0.22, 0]}>
          <mesh material={materials.structuralSteel}>
            <boxGeometry args={[0.85, 0.62, 0.08]} />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[0.76, 0.52]} />
            <meshBasicMaterial map={monitorTextures.tLeft} />
          </mesh>
        </group>

        <group position={[0, 1.6, 0.22]}>
          <mesh material={materials.structuralSteel}>
            <boxGeometry args={[0.98, 0.72, 0.08]} />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[0.88, 0.6]} />
            <meshBasicMaterial map={monitorTextures.tCenter} />
          </mesh>
        </group>

        <group position={[0.95, 1.54, 0.14]} rotation={[0, -0.22, 0]}>
          <mesh material={materials.structuralSteel}>
            <boxGeometry args={[0.85, 0.62, 0.08]} />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[0.76, 0.52]} />
            <meshBasicMaterial map={monitorTextures.tRight} />
          </mesh>
        </group>
      </group>

      {/* 4. Electrical Circuit Breaker Panel (term-circuits) */}
      <group position={[-2.3, 0, -1.75]}>
        <mesh position={[0, 0.9, 0]} material={materials.structuralSteel} castShadow receiveShadow>
          <boxGeometry args={[1.45, 1.8, 1.1]} />
        </mesh>
        <mesh position={[0, 1.86, 0]} material={materials.hazardStripe}>
          <boxGeometry args={[1.5, 0.12, 1.14]} />
        </mesh>
        {[-0.4, 0, 0.4].map((bx, idx) => {
          const engaged = circuitBreakers[idx];
          const color = engaged ? '#22c55e' : '#f59e0b';
          return (
            <group key={`breaker-${idx}`} position={[bx, 1.2, 0.57]}>
              <mesh material={materials.brushedSteel}>
                <boxGeometry args={[0.28, 0.52, 0.06]} />
              </mesh>
              <mesh position={[0, engaged ? 0.1 : -0.1, 0.06]} material={materials.safetyYellow}>
                <boxGeometry args={[0.16, 0.12, 0.08]} />
              </mesh>
              <mesh position={[0, 0.36, 0.02]}>
                <boxGeometry args={[0.2, 0.07, 0.04]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* 5. Numeric Keypad Override Console (term-keypad) */}
      <group position={[-0.3, 0, 1.75]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.68, 0]} material={materials.structuralSteel} castShadow receiveShadow>
          <boxGeometry args={[1.4, 1.36, 1.05]} />
        </mesh>
        <group position={[0, 1.44, 0.1]} rotation={[-0.45, 0, 0]}>
          <mesh material={materials.brushedSteel}>
            <boxGeometry args={[1.05, 0.14, 0.8]} />
          </mesh>
          {[-0.26, 0, 0.26].map((kx) =>
            [-0.2, -0.04, 0.12, 0.26].map((kz) => (
              <mesh key={`${kx}-${kz}`} position={[kx, 0.09, kz]}>
                <boxGeometry args={[0.15, 0.04, 0.1]} />
                <meshStandardMaterial
                  color={keypadSolved ? '#22c55e' : '#38bdf8'}
                  emissive={keypadSolved ? '#22c55e' : '#0ea5e9'}
                  emissiveIntensity={1.2}
                />
              </mesh>
            ))
          )}
        </group>
        <mesh position={[0, 1.82, -0.28]}>
          <boxGeometry args={[0.65, 0.32, 0.12]} />
          <meshStandardMaterial
            color={keypadSolved ? '#22c55e' : '#eab308'}
            emissive={keypadSolved ? '#22c55e' : '#eab308'}
            emissiveIntensity={1.6}
          />
        </mesh>
      </group>

      {/* 6. Exposed Wall Electrical Circuit Busbars */}
      {[-2.9, -1.6, -0.3, 1.0, 2.3].map((bxOffset, i) => {
        const energized = activeCircuitCount > i || allPuzzlesCompleted;
        const conduitColor = energized ? '#22c55e' : '#38bdf8';
        return (
          <group key={`circuit-bus-${i}`} position={[bxOffset, 2.85, 2.55]}>
            <mesh material={materials.structuralSteel}>
              <boxGeometry args={[0.22, 1.45, 0.12]} />
            </mesh>
            <mesh position={[0, 0, -0.08]}>
              <cylinderGeometry args={[0.04, 0.04, 1.3, 10]} />
              <meshStandardMaterial
                color={conduitColor}
                emissive={conduitColor}
                emissiveIntensity={energized ? 2.1 : 0.7}
              />
            </mesh>
          </group>
        );
      })}

      {/* 7. Electromagnetic Puzzle Room Security Containment Barrier */}
      {puzzleProtectionActive && (
        <group position={[5.65, 0, 0]}>
          {[-0.92, 0.92].map((pz) => (
            <mesh key={`bar-pylon-${pz}`} position={[0, 1.35, pz]} material={materials.structuralSteel}>
              <boxGeometry args={[0.14, 2.7, 0.12]} />
            </mesh>
          ))}
          <mesh position={[0, 1.32, 0]} renderOrder={3}>
            <boxGeometry args={[0.06, 2.58, 1.72]} />
            <meshStandardMaterial
              ref={barrierFieldMatRef}
              color={allPuzzlesCompleted ? '#22c55e' : '#38bdf8'}
              emissive={allPuzzlesCompleted ? '#22c55e' : '#0ea5e9'}
              emissiveIntensity={1.6}
              transparent
              opacity={0.26}
              depthWrite={false}
            />
          </mesh>
          {[0.42, 0.98, 1.54, 2.1].map((by) => (
            <mesh key={`bar-beam-${by}`} position={[0, by, 0]}>
              <boxGeometry args={[0.04, 0.04, 1.72]} />
              <meshStandardMaterial
                color={allPuzzlesCompleted ? '#4ade80' : '#7dd3fc'}
                emissive={allPuzzlesCompleted ? '#22c55e' : '#38bdf8'}
                emissiveIntensity={2.8}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* 8. Overhead Blue Strip & Emergency Beacon */}
      <mesh position={[0, 4.1, 0]}>
        <boxGeometry args={[8.6, 0.08, 0.35]} />
        <meshStandardMaterial
          color={puzzleTimerExpired ? '#ef4444' : '#38bdf8'}
          emissive={puzzleTimerExpired ? '#ef4444' : '#38bdf8'}
          emissiveIntensity={1.8}
        />
      </mesh>
      <mesh ref={beaconCapRef} position={[2.8, 4.02, 0]}>
        <cylinderGeometry args={[0.2, 0.24, 0.26, 12]} />
        <meshStandardMaterial
          color={puzzleTimerExpired || beastAlerted ? '#ef4444' : '#f59e0b'}
          emissive={puzzleTimerExpired || beastAlerted ? '#ef4444' : '#f59e0b'}
          emissiveIntensity={puzzleRoomEntered ? 2.4 : 1.3}
        />
      </mesh>
      <pointLight
        ref={beaconLightRef}
        position={[0, 3.4, 0]}
        color={puzzleTimerExpired ? '#ef4444' : beastAlerted && !allPuzzlesCompleted ? '#f59e0b' : '#38bdf8'}
        intensity={4.2}
        distance={16}
        decay={1.4}
      />
    </group>
  );
};
