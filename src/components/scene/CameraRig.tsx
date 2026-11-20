import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useGameStore } from '../../store/useGameStore';
import {
  escapeLocalToWorld,
  FLOOR_ELEVATIONS,
  getActiveMissionFrame,
  getActivePuzzleEscapeFrame,
  getActivePuzzleFrame,
  roomLocalToWorld,
} from '../../data/buildingLayout';
import { CameraPreset, CameraViewMode } from '../../types/game';

interface CameraTarget {
  position: [number, number, number];
  lookAt: [number, number, number];
}

function getCameraTarget(preset: CameraPreset, viewMode: CameraViewMode): CameraTarget {
  const missionFrame = getActiveMissionFrame();
  const puzzleFrame = getActivePuzzleFrame();
  const escapeFrame = getActivePuzzleEscapeFrame();

  if (viewMode === 'walkthrough') {
    switch (preset) {
      case 'floor-1':
        return { position: [-14.8, FLOOR_ELEVATIONS[1] + 1.8, -14.8], lookAt: [14.8, FLOOR_ELEVATIONS[1] + 1.6, -14.8] };
      case 'floor-2':
        return { position: [-14.8, FLOOR_ELEVATIONS[2] + 1.8, -14.8], lookAt: [14.8, FLOOR_ELEVATIONS[2] + 1.6, -14.8] };
      case 'floor-3':
        return { position: [-14.8, FLOOR_ELEVATIONS[3] + 1.8, -14.8], lookAt: [14.8, FLOOR_ELEVATIONS[3] + 1.6, -14.8] };
      case 'floor-4':
        return { position: [-14.8, FLOOR_ELEVATIONS[4] + 1.8, -14.8], lookAt: [14.8, FLOOR_ELEVATIONS[4] + 1.6, -14.8] };
      case 'mission-room': {
        const [px, pz] = roomLocalToWorld(0, 7.5, missionFrame);
        const [lx, lz] = roomLocalToWorld(0, -2.5, missionFrame);
        return { position: [px, missionFrame.elevation + 1.8, pz], lookAt: [lx, missionFrame.elevation + 1.5, lz] };
      }
      case 'puzzle-room': {
        const [px, pz] = roomLocalToWorld(0, 7.5, puzzleFrame);
        const [lx, lz] = roomLocalToWorld(0, -2.5, puzzleFrame);
        return { position: [px, puzzleFrame.elevation + 1.8, pz], lookAt: [lx, puzzleFrame.elevation + 1.5, lz] };
      }
      case 'exit-gate': {
        const [px, pz] = escapeLocalToWorld(1.3, 0, escapeFrame);
        const [lx, lz] = escapeLocalToWorld(-14.0, 0, escapeFrame);
        return { position: [px, escapeFrame.elevation + 1.8, pz], lookAt: [lx, escapeFrame.elevation + 1.5, lz] };
      }
      case 'overview':
      default:
        return { position: [-14.8, FLOOR_ELEVATIONS[2] + 1.8, -14.8], lookAt: [12.0, FLOOR_ELEVATIONS[1] + 1.2, 12.0] };
    }
  }

  switch (preset) {
    case 'floor-1':
      return { position: [0, FLOOR_ELEVATIONS[1] + 34, 42], lookAt: [0, FLOOR_ELEVATIONS[1] + 1.2, 0] };
    case 'floor-2':
      return { position: [0, FLOOR_ELEVATIONS[2] + 34, 42], lookAt: [0, FLOOR_ELEVATIONS[2] + 1.2, 0] };
    case 'floor-3':
      return { position: [0, FLOOR_ELEVATIONS[3] + 34, 42], lookAt: [0, FLOOR_ELEVATIONS[3] + 1.2, 0] };
    case 'floor-4':
      return { position: [0, FLOOR_ELEVATIONS[4] + 34, 42], lookAt: [0, FLOOR_ELEVATIONS[4] + 1.2, 0] };
    case 'mission-room': {
      const [px, pz] = roomLocalToWorld(10, 14, missionFrame);
      return {
        position: [px, missionFrame.elevation + 16, pz],
        lookAt: [missionFrame.centerX, missionFrame.elevation + 1.5, missionFrame.centerZ],
      };
    }
    case 'puzzle-room': {
      const [px, pz] = roomLocalToWorld(10, 14, puzzleFrame);
      return {
        position: [px, puzzleFrame.elevation + 16, pz],
        lookAt: [puzzleFrame.centerX, puzzleFrame.elevation + 1.5, puzzleFrame.centerZ],
      };
    }
    case 'exit-gate': {
      const [px, pz] = escapeLocalToWorld(-12, 16, escapeFrame);
      const [lx, lz] = escapeLocalToWorld(-8.5, 0, escapeFrame);
      return { position: [px, escapeFrame.elevation + 14, pz], lookAt: [lx, escapeFrame.elevation + 1.5, lz] };
    }
    case 'overview':
    default:
      return { position: [42, 42, 48], lookAt: [0, 7.0, 0] };
  }
}

const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();

export const CameraRig: React.FC<{ isSoftwareGl: boolean }> = ({ isSoftwareGl }) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();

  const controlMode = useGameStore((s) => s.controlMode);
  const cameraPreset = useGameStore((s) => s.cameraPreset);
  const cameraViewMode = useGameStore((s) => s.cameraViewMode);
  const presetVersion = useGameStore((s) => s.presetVersion);
  const layoutVersion = useGameStore((s) => s.layoutVersion);

  const isTransitioningRef = useRef(true);
  const targetRef = useRef<CameraTarget>(getCameraTarget('overview', 'orbit'));

  useEffect(() => {
    if (controlMode !== 'orbit') return;
    targetRef.current = getCameraTarget(cameraPreset, cameraViewMode);
    isTransitioningRef.current = true;
  }, [cameraPreset, cameraViewMode, controlMode, layoutVersion, presetVersion]);

  useFrame((_, rawDelta) => {
    if (controlMode !== 'orbit') return;
    const controls = controlsRef.current;
    if (!controls || !isTransitioningRef.current) return;

    const delta = Math.min(rawDelta, 0.1);
    const target = targetRef.current;

    _desiredPos.set(target.position[0], target.position[1], target.position[2]);
    _desiredLook.set(target.lookAt[0], target.lookAt[1], target.lookAt[2]);

    const lambda = 6.5;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredPos.x, lambda, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredPos.y, lambda, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredPos.z, lambda, delta);

    controls.target.x = THREE.MathUtils.damp(controls.target.x, _desiredLook.x, lambda, delta);
    controls.target.y = THREE.MathUtils.damp(controls.target.y, _desiredLook.y, lambda, delta);
    controls.target.z = THREE.MathUtils.damp(controls.target.z, _desiredLook.z, lambda, delta);

    controls.update();

    if (
      camera.position.distanceToSquared(_desiredPos) < 0.015 &&
      controls.target.distanceToSquared(_desiredLook) < 0.015
    ) {
      isTransitioningRef.current = false;
    }
  });

  if (controlMode !== 'orbit') return null;

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={!isSoftwareGl}
      dampingFactor={0.07}
      minDistance={3.5}
      maxDistance={120}
      maxPolarAngle={Math.PI * 0.495}
      onStart={() => {
        isTransitioningRef.current = false;
      }}
    />
  );
};
