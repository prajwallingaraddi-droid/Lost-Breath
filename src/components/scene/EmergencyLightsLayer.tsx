import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { FLOOR_ELEVATIONS, WALL_HEIGHT } from '../../data/buildingLayout';
import { useGameStore } from '../../store/useGameStore';
import { useIndustrialMaterials } from '../../three/MaterialContext';
import { FloorNumber } from '../../types/game';

/**
 * 8 corridor & common-area emergency warning beacon positions per floor
 * (4 corridor corners + 4 mid-wing corridors = 32 synchronized building-wide strobes).
 */
const BEACON_RING_COORDS: readonly [number, number][] = [
  [-14.8, -14.8],
  [0, -14.8],
  [14.8, -14.8],
  [14.8, 0],
  [14.8, 14.8],
  [0, 14.8],
  [-14.8, 14.8],
  [-14.8, 0],
];

const _dummy = new THREE.Object3D();

export const EmergencyLightsLayer: React.FC = React.memo(() => {
  const materials = useIndustrialMaterials();
  const emergencyAlarmActive = useGameStore((s) => s.emergencyAlarmActive);
  const playerFloor = useGameStore((s) => s.playerFloor);
  const controlMode = useGameStore((s) => s.controlMode);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const cutawayMode = useGameStore((s) => s.cutawayMode);

  const housingGeo = useMemo(() => new THREE.CylinderGeometry(0.2, 0.24, 0.1, 10), []);
  const strobeGeo = useMemo(() => new THREE.CylinderGeometry(0.14, 0.12, 0.16, 10), []);

  const strobeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#450a0a',
        emissive: '#ef4444',
        emissiveIntensity: 0.08,
        roughness: 0.25,
        metalness: 0.1,
      }),
    []
  );

  useEffect(() => {
    return () => {
      housingGeo.dispose();
      strobeGeo.dispose();
      strobeMat.dispose();
    };
  }, [housingGeo, strobeGeo, strobeMat]);

  const housingInstRef = useRef<THREE.InstancedMesh>(null);
  const strobeInstRef = useRef<THREE.InstancedMesh>(null);
  const lightARef = useRef<THREE.PointLight>(null);
  const lightBRef = useRef<THREE.PointLight>(null);
  const wasActiveRef = useRef(false);

  const effectiveCutaway = controlMode === 'orbit' && cutawayMode;
  const visibleFloorCount =
    !effectiveCutaway || activeFloor === 'all' ? 4 : Math.min(4, activeFloor);

  useEffect(() => {
    const housingMesh = housingInstRef.current;
    const strobeMesh = strobeInstRef.current;
    if (!housingMesh || !strobeMesh) return;

    let idx = 0;
    for (let fl = 1 as FloorNumber; fl <= visibleFloorCount; fl = (fl + 1) as FloorNumber) {
      const y = FLOOR_ELEVATIONS[fl] + WALL_HEIGHT - 0.14;
      for (let i = 0; i < BEACON_RING_COORDS.length; i++) {
        const [bx, bz] = BEACON_RING_COORDS[i];
        _dummy.position.set(bx, y, bz);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        housingMesh.setMatrixAt(idx, _dummy.matrix);

        _dummy.position.set(bx, y - 0.1, bz);
        _dummy.updateMatrix();
        strobeMesh.setMatrixAt(idx, _dummy.matrix);
        idx++;
      }
    }

    housingMesh.count = idx;
    strobeMesh.count = idx;
    housingMesh.instanceMatrix.needsUpdate = true;
    strobeMesh.instanceMatrix.needsUpdate = true;
    housingMesh.computeBoundingSphere();
    strobeMesh.computeBoundingSphere();
  }, [visibleFloorCount]);

  useFrame(({ clock }) => {
    const active = useGameStore.getState().emergencyAlarmActive;
    if (!active) {
      if (wasActiveRef.current) {
        wasActiveRef.current = false;
        strobeMat.emissiveIntensity = 0.08;
        if (lightARef.current) lightARef.current.intensity = 0;
        if (lightBRef.current) lightBRef.current.intensity = 0;
      }
      return;
    }

    wasActiveRef.current = true;
    const t = clock.getElapsedTime();
    const pulse = Math.max(0, Math.sin(t * 7.2));
    const strobe = pulse * pulse;
    strobeMat.emissiveIntensity = 0.35 + strobe * 4.4;

    if (lightARef.current) {
      lightARef.current.intensity = 1.5 + strobe * 11.5;
    }
    if (lightBRef.current) {
      lightBRef.current.intensity = 1.5 + (1 - strobe) * 10.0;
    }
  });

  const playerY = FLOOR_ELEVATIONS[playerFloor] + WALL_HEIGHT - 0.55;

  return (
    <group>
      {/* 2 InstancedMeshes for all 32 emergency strobe housings & lamps across 4 floors */}
      <instancedMesh
        ref={housingInstRef}
        args={[housingGeo, materials.structuralSteel, 32]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={strobeInstRef}
        args={[strobeGeo, strobeMat, 32]}
        frustumCulled={false}
      />

      {/* Pooled red dynamic emergency point lights on the player's current floor */}
      {emergencyAlarmActive && (
        <>
          <pointLight
            ref={lightARef}
            position={[14.8, playerY, 0]}
            color="#ef4444"
            intensity={8}
            distance={28}
            decay={1.4}
          />
          <pointLight
            ref={lightBRef}
            position={[-14.8, playerY, 0]}
            color="#ef4444"
            intensity={8}
            distance={28}
            decay={1.4}
          />
        </>
      )}
    </group>
  );
});
