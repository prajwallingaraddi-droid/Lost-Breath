import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  getActiveMissionFrame,
  MISSION_KEY_CELLS,
} from '../../data/buildingLayout';
import { useIndustrialMaterials } from '../../three/MaterialContext';
import { useGameStore } from '../../store/useGameStore';
import { KeyCellDefinition } from '../../types/game';

function createKeyCellPlaqueTexture(shortCode: string, accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#08101a';
  ctx.fillRect(0, 0, 256, 96);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 246, 86);

  ctx.fillStyle = accentHex;
  ctx.fillRect(12, 12, 232, 24);

  ctx.fillStyle = '#08101a';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KEY VAULT', 128, 25);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 34px monospace';
  ctx.fillText(shortCode, 128, 65);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface KeyCellUnitProps {
  cell: KeyCellDefinition;
  unlocked: boolean;
  doorState: 'closed' | 'opening' | 'open';
  keyCollected: boolean;
  keyMaterial: THREE.MeshStandardMaterial;
  glassMaterial: THREE.MeshStandardMaterial;
  onDoorOpened: (id: KeyCellDefinition['id']) => void;
}

const KeyCellUnit: React.FC<KeyCellUnitProps> = ({
  cell,
  unlocked,
  doorState,
  keyCollected,
  keyMaterial,
  glassMaterial,
  onDoorOpened,
}) => {
  const materials = useIndustrialMaterials();
  const hingeRef = useRef<THREE.Group>(null);
  const keyGroupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(0);
  const openSentRef = useRef(false);
  const pickupScaleRef = useRef(1);
  const spinClockRef = useRef(cell.id === 'cell-a' ? 0 : 1.5);

  const isCellA = cell.id === 'cell-a';
  const accentHex = isCellA ? '#f59e0b' : '#38bdf8';
  const plaqueTex = useMemo(
    () => createKeyCellPlaqueTexture(cell.shortCode, accentHex),
    [accentHex, cell.shortCode]
  );

  useEffect(() => {
    return () => {
      plaqueTex.dispose();
    };
  }, [plaqueTex]);

  useEffect(() => {
    if (!unlocked) {
      angleRef.current = 0;
      openSentRef.current = false;
      pickupScaleRef.current = 1;
      if (hingeRef.current) {
        hingeRef.current.rotation.y = 0;
      }
      if (keyGroupRef.current) {
        keyGroupRef.current.visible = true;
        keyGroupRef.current.scale.setScalar(1);
        keyGroupRef.current.position.set(0, 1.15, 0.02);
      }
    }
  }, [unlocked]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const hinge = hingeRef.current;
    if (hinge) {
      const targetAngle = unlocked ? -Math.PI * 0.58 : 0;
      angleRef.current = THREE.MathUtils.damp(angleRef.current, targetAngle, 6.0, delta);
      hinge.rotation.y = angleRef.current;

      if (
        unlocked &&
        doorState === 'opening' &&
        !openSentRef.current &&
        Math.abs(angleRef.current - targetAngle) < 0.08
      ) {
        openSentRef.current = true;
        onDoorOpened(cell.id);
      }
    }

    const keyGroup = keyGroupRef.current;
    if (keyGroup) {
      if (keyCollected) {
        if (pickupScaleRef.current > 0.01) {
          pickupScaleRef.current = THREE.MathUtils.damp(pickupScaleRef.current, 0, 14, delta);
          keyGroup.scale.setScalar(pickupScaleRef.current);
          keyGroup.position.y += delta * 0.9;
          keyGroup.rotation.y += delta * 10;
        } else {
          keyGroup.visible = false;
        }
      } else {
        pickupScaleRef.current = 1;
        keyGroup.scale.setScalar(1);
        keyGroup.visible = true;
        spinClockRef.current += delta;
        keyGroup.rotation.y = spinClockRef.current * 0.95;
        keyGroup.position.y = 1.15 + Math.sin(spinClockRef.current * 2.2) * 0.022;
      }
    }
  });

  const lockLedColor = unlocked ? '#22c55e' : '#f59e0b';

  return (
    <group position={cell.position} rotation={[0, cell.rotationY, 0]}>
      {/* Base Grounded Plinth */}
      <mesh position={[0, 0.07, 0]} material={materials.structuralSteel} castShadow receiveShadow>
        <boxGeometry args={[1.24, 0.14, 0.9]} />
      </mesh>

      {/* Lower Solid Vault Cabinet Body */}
      <mesh position={[0, 0.55, 0]} material={materials.structuralSteel} castShadow receiveShadow>
        <boxGeometry args={[1.18, 0.82, 0.84]} />
      </mesh>
      <mesh position={[0, 0.55, 0.425]} material={isCellA ? materials.hazardStripe : materials.brushedSteel}>
        <boxGeometry args={[1.04, 0.12, 0.02]} />
      </mesh>

      {/* Upper Glass-Front Display Vault Frame (Side & Back Walls) */}
      <mesh position={[-0.54, 1.42, 0]} material={materials.brushedSteel} castShadow>
        <boxGeometry args={[0.1, 0.96, 0.84]} />
      </mesh>
      <mesh position={[0.54, 1.42, 0]} material={materials.brushedSteel} castShadow>
        <boxGeometry args={[0.1, 0.96, 0.84]} />
      </mesh>
      <mesh position={[0, 1.42, -0.37]} material={materials.structuralSteel} receiveShadow>
        <boxGeometry args={[1.02, 0.96, 0.1]} />
      </mesh>

      {/* Top Armored Header Housing */}
      <mesh position={[0, 1.99, 0]} material={materials.structuralSteel} castShadow>
        <boxGeometry args={[1.24, 0.2, 0.9]} />
      </mesh>

      {/* Distinct Cell Identification Plaque (CELL A / CELL B) */}
      <mesh position={[-0.1, 1.99, 0.456]}>
        <planeGeometry args={[0.88, 0.28]} />
        <meshBasicMaterial map={plaqueTex} />
      </mesh>

      {/* Interior Key Pedestal & Inspection Illumination Strip */}
      <mesh position={[0, 1.0, 0.02]} material={materials.brushedSteel} receiveShadow>
        <boxGeometry args={[0.48, 0.08, 0.42]} />
      </mesh>
      <mesh position={[0, 1.05, 0.02]} material={materials.structuralSteel}>
        <cylinderGeometry args={[0.14, 0.17, 0.04, 12]} />
      </mesh>
      <mesh position={[0, 1.87, 0.02]}>
        <boxGeometry args={[0.72, 0.03, 0.16]} />
        <meshStandardMaterial
          color={accentHex}
          emissive={accentHex}
          emissiveIntensity={1.6}
        />
      </mesh>

      {/* 3D Metallic Security Key (6-part composite Group) */}
      <group ref={keyGroupRef} position={[0, 1.15, 0.02]}>
        {/* 1. Key Bow Ring */}
        <mesh position={[0, 0.13, 0]} material={keyMaterial} castShadow>
          <torusGeometry args={[0.078, 0.02, 10, 20]} />
        </mesh>
        {/* 2. Hexagonal Grip Collar */}
        <mesh position={[0, 0.045, 0]} material={materials.structuralSteel}>
          <cylinderGeometry args={[0.038, 0.044, 0.042, 6]} />
        </mesh>
        {/* 3. Precision Turned Shaft */}
        <mesh position={[0, -0.09, 0]} material={keyMaterial} castShadow>
          <cylinderGeometry args={[0.017, 0.017, 0.24, 12]} />
        </mesh>
        {/* 4. Mid Shaft Collar Flange */}
        <mesh position={[0, -0.04, 0]} material={keyMaterial}>
          <cylinderGeometry args={[0.03, 0.03, 0.016, 12]} />
        </mesh>
        {/* 5. Primary Bit Tooth */}
        <mesh position={[0.034, -0.155, 0]} material={keyMaterial} castShadow>
          <boxGeometry args={[0.052, 0.044, 0.016]} />
        </mesh>
        {/* 6. Secondary Stepped Bit Tooth */}
        <mesh position={[0.028, -0.198, 0]} material={keyMaterial} castShadow>
          <boxGeometry args={[0.04, 0.032, 0.016]} />
        </mesh>
      </group>

      {/* Hinged Armored Glass Vault Door */}
      <group ref={hingeRef} position={[-0.48, 1.42, 0.41]}>
        {/* Outer Door Frame Rails */}
        <mesh position={[0.48, 0.44, 0]} material={materials.structuralSteel}>
          <boxGeometry args={[0.96, 0.07, 0.05]} />
        </mesh>
        <mesh position={[0.48, -0.44, 0]} material={materials.structuralSteel}>
          <boxGeometry args={[0.96, 0.07, 0.05]} />
        </mesh>
        <mesh position={[0.035, 0, 0]} material={materials.structuralSteel}>
          <boxGeometry args={[0.07, 0.82, 0.05]} />
        </mesh>
        <mesh position={[0.925, 0, 0]} material={materials.structuralSteel}>
          <boxGeometry args={[0.07, 0.82, 0.05]} />
        </mesh>
        {/* Tempered Glass Viewing Pane */}
        <mesh position={[0.48, 0, 0]} material={glassMaterial} renderOrder={2}>
          <boxGeometry args={[0.82, 0.81, 0.022]} />
        </mesh>
        {/* Door Latch Handle */}
        <mesh position={[0.88, -0.04, 0.04]} material={materials.brassTrim}>
          <boxGeometry args={[0.05, 0.14, 0.04]} />
        </mesh>
      </group>

      {/* Wall-Mounted Numeric Password Keypad on Front Pillar */}
      <group position={[0.48, 1.25, 0.45]}>
        <mesh material={materials.structuralSteel}>
          <boxGeometry args={[0.2, 0.34, 0.05]} />
        </mesh>
        {/* Status Indicator Light Strip */}
        <mesh position={[0, 0.125, 0.028]}>
          <boxGeometry args={[0.14, 0.036, 0.015]} />
          <meshStandardMaterial
            color={lockLedColor}
            emissive={lockLedColor}
            emissiveIntensity={2.0}
          />
        </mesh>
        {/* 3x4 Tactile Keypad Button Matrix */}
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2].map((col) => (
            <mesh
              key={`kbtn-${row}-${col}`}
              position={[-0.042 + col * 0.042, 0.055 - row * 0.045, 0.028]}
              material={materials.brushedSteel}
            >
              <boxGeometry args={[0.028, 0.028, 0.015]} />
            </mesh>
          ))
        )}
      </group>
    </group>
  );
};

export const MissionRoomInterior: React.FC = () => {
  const materials = useIndustrialMaterials();
  const layoutVersion = useGameStore((s) => s.layoutVersion);
  const hasPuzzleRoomKey = useGameStore((s) => s.hasPuzzleRoomKey);
  const missionRoomEntered = useGameStore((s) => s.missionRoomEntered);
  const emergencyAlarmActive = useGameStore((s) => s.emergencyAlarmActive);
  const keyCells = useGameStore((s) => s.keyCells);
  const markKeyCellDoorOpen = useGameStore((s) => s.markKeyCellDoorOpen);

  const alarmLightRef = useRef<THREE.PointLight>(null);
  const strobeMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const frame = useMemo(() => {
    void layoutVersion;
    return getActiveMissionFrame();
  }, [layoutVersion]);

  useFrame(({ clock }) => {
    const active = useGameStore.getState().emergencyAlarmActive;
    if (!active) {
      if (alarmLightRef.current) alarmLightRef.current.intensity = 0;
      if (strobeMatRef.current) strobeMatRef.current.emissiveIntensity = 0.08;
      return;
    }
    const pulse = Math.max(0, Math.sin(clock.getElapsedTime() * 7.8));
    const strobe = pulse * pulse;
    if (alarmLightRef.current) alarmLightRef.current.intensity = 2.0 + strobe * 10.5;
    if (strobeMatRef.current) strobeMatRef.current.emissiveIntensity = 0.4 + strobe * 4.5;
  });

  const cellSharedMaterials = useMemo(() => {
    const realKeyMat = new THREE.MeshStandardMaterial({
      color: '#e5b84b',
      metalness: 0.92,
      roughness: 0.18,
    });
    const falseKeyMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.9,
      roughness: 0.24,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#93c5fd',
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      roughness: 0.12,
      metalness: 0.2,
    });
    return { realKeyMat, falseKeyMat, glassMat };
  }, []);

  useEffect(() => {
    return () => {
      cellSharedMaterials.realKeyMat.dispose();
      cellSharedMaterials.falseKeyMat.dispose();
      cellSharedMaterials.glassMat.dispose();
    };
  }, [cellSharedMaterials]);

  return (
    <group>
      {/* Room-oriented structural cladding, floor plate, illumination & beacons */}
      <group
        position={[frame.centerX, frame.elevation, frame.centerZ]}
        rotation={[0, frame.rotY, 0]}
      >
        {/* 1. Metallic Diamond-Plate Mission Room Floor (local X: width 5.1, local Z: depth 10.8) */}
        <mesh position={[0, 0.03, 0]} material={materials.diamondTread} receiveShadow>
          <boxGeometry args={[5.1, 0.04, 10.8]} />
        </mesh>
        <mesh position={[0, 0.036, 5.15]} material={materials.hazardStripe}>
          <boxGeometry args={[2.4, 0.045, 0.45]} />
        </mesh>

        {/* 2. Brushed Steel Wall Cladding along Exterior Back Wall (local -Z) */}
        {[-1.65, 0.0, 1.65].map((wx) => (
          <mesh key={`m-clad-back-${wx}`} position={[wx, 2.0, -5.46]} material={materials.brushedSteel}>
            <boxGeometry args={[1.45, 3.6, 0.08]} />
          </mesh>
        ))}

        {/* 4. Overhead Illumination */}
        <mesh position={[0, 4.1, 0]}>
          <boxGeometry args={[0.35, 0.08, 8.6]} />
          <meshStandardMaterial
            color={emergencyAlarmActive ? '#ef4444' : hasPuzzleRoomKey ? '#22c55e' : '#f59e0b'}
            emissive={emergencyAlarmActive ? '#ef4444' : hasPuzzleRoomKey ? '#22c55e' : '#f59e0b'}
            emissiveIntensity={emergencyAlarmActive ? 2.4 : missionRoomEntered ? 1.9 : 1.1}
          />
        </mesh>

        {/* 5. Mission Room Red Emergency Warning Beacons (dormant until genuine key alarm activates) */}
        {[-3.1, 3.1].map((bz) => (
          <group key={`m-alarm-${bz}`} position={[0, 4.02, bz]}>
            <mesh material={materials.structuralSteel}>
              <cylinderGeometry args={[0.2, 0.24, 0.12, 10]} />
            </mesh>
            <mesh position={[0, -0.11, 0]}>
              <cylinderGeometry args={[0.14, 0.12, 0.18, 10]} />
              <meshStandardMaterial
                ref={bz === 3.1 ? strobeMatRef : undefined}
                color="#450a0a"
                emissive="#ef4444"
                emissiveIntensity={emergencyAlarmActive ? 3.6 : 0.08}
              />
            </mesh>
          </group>
        ))}
        {emergencyAlarmActive && (
          <pointLight
            ref={alarmLightRef}
            position={[0, 3.4, 0]}
            color="#ef4444"
            intensity={9}
            distance={16}
            decay={1.4}
          />
        )}
      </group>

      {/* 3. Two Physically Separate Secure Key Cells in World Space (Cell A = Real Key, Cell B = False Key) */}
      {MISSION_KEY_CELLS.map((cell) => {
        const st = keyCells[cell.id];
        return (
          <KeyCellUnit
            key={`${cell.id}-${layoutVersion}`}
            cell={cell}
            unlocked={st.unlocked}
            doorState={st.doorState}
            keyCollected={st.keyCollected}
            keyMaterial={
              cell.variant === 'real'
                ? cellSharedMaterials.realKeyMat
                : cellSharedMaterials.falseKeyMat
            }
            glassMaterial={cellSharedMaterials.glassMat}
            onDoorOpened={markKeyCellDoorOpen}
          />
        );
      })}
    </group>
  );
};
