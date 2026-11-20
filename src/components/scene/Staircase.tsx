import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { StaircaseDefinition } from '../../types/game';
import { FLOOR_HEIGHT } from '../../data/buildingLayout';
import { useIndustrialMaterials } from '../../three/MaterialContext';
import { useGameStore } from '../../store/useGameStore';

interface StaircaseProps {
  staircase: StaircaseDefinition;
}

const STEPS_PER_FLIGHT = 8;
const POST_FRACTIONS = [0.06, 0.36, 0.66, 0.96] as const;

function xform(
  geo: THREE.BufferGeometry,
  pos: [number, number, number],
  rot?: [number, number, number]
): THREE.BufferGeometry {
  if (rot) {
    if (rot[0]) geo.rotateX(rot[0]);
    if (rot[1]) geo.rotateY(rot[1]);
    if (rot[2]) geo.rotateZ(rot[2]);
  }
  geo.translate(pos[0], pos[1], pos[2]);
  return geo;
}

function mergeGroup(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  return merged;
}

/**
 * Realistic institutional concrete switchback staircase with brushed stainless-steel
 * tubular handrails, vertical stanchions, smoked glass balustrade panels, and subtle
 * cool-white landing downlights — merged per material (6 draw calls instead of ~90 per staircase!).
 */
export const Staircase: React.FC<StaircaseProps> = React.memo(({ staircase }) => {
  const materials = useIndustrialMaterials();
  const ceilingLightsOn = useGameStore((s) => s.ceilingLightsOn);

  const halfRise = FLOOR_HEIGHT / 2; // 2.25m per flight
  const flightRun = 3.2; // horizontal run per flight
  const laneWidth = staircase.width * 0.45; // 1.62m per flight lane
  const laneOffset = staircase.width * 0.26; // +-0.93m from center

  const mergedGeos = useMemo(() => {
    const stepDepth = flightRun / STEPS_PER_FLIGHT;
    const stepRise = halfRise / STEPS_PER_FLIGHT;
    const stringerLength = Math.hypot(flightRun, halfRise);
    const stringerAngle = Math.atan2(halfRise, flightRun);

    const concreteParts: THREE.BufferGeometry[] = [];
    const nosingParts: THREE.BufferGeometry[] = [];
    const steelParts: THREE.BufferGeometry[] = [];
    const railParts: THREE.BufferGeometry[] = [];
    const glassParts: THREE.BufferGeometry[] = [];

    // FLIGHT 1 (Lower -> Mid-Landing) centered at x = -laneOffset, y = 0
    for (let idx = 0; idx < STEPS_PER_FLIGHT; idx++) {
      const sy = (idx + 0.5) * stepRise;
      const sz = 2.2 - (idx + 0.5) * stepDepth;
      concreteParts.push(
        xform(new THREE.BoxGeometry(laneWidth, stepRise * 0.96, stepDepth * 1.04), [
          -laneOffset,
          sy,
          sz,
        ])
      );
      nosingParts.push(
        xform(new THREE.BoxGeometry(laneWidth - 0.02, 0.018, 0.045), [
          -laneOffset,
          sy + stepRise * 0.48,
          sz + stepDepth * 0.44,
        ])
      );
    }

    // Flight 1 entry bridge plate
    concreteParts.push(
      xform(new THREE.BoxGeometry(laneWidth, 0.14, 1.15), [-laneOffset, -0.04, 2.75])
    );

    // Flight 1 stringers, rails, stanchions, glass
    for (const sx of [-laneWidth / 2 - 0.04, laneWidth / 2 + 0.04]) {
      const wx = -laneOffset + sx;
      steelParts.push(
        xform(
          new THREE.BoxGeometry(0.07, 0.24, stringerLength + 0.2),
          [wx, halfRise / 2 - 0.06, 2.2 - flightRun / 2],
          [stringerAngle, 0, 0]
        )
      );
      railParts.push(
        xform(
          new THREE.CylinderGeometry(0.024, 0.024, stringerLength + 0.18, 8),
          [wx, halfRise / 2 + 0.92, 2.2 - flightRun / 2],
          [stringerAngle + Math.PI / 2, 0, 0]
        )
      );
      glassParts.push(
        xform(
          new THREE.BoxGeometry(0.016, 0.68, stringerLength - 0.08),
          [wx, halfRise / 2 + 0.47, 2.2 - flightRun / 2],
          [stringerAngle, 0, 0]
        )
      );
      for (const frac of POST_FRACTIONS) {
        railParts.push(
          xform(new THREE.CylinderGeometry(0.016, 0.016, 0.92, 8), [
            wx,
            frac * halfRise + 0.45,
            2.2 - frac * flightRun,
          ])
        );
      }
    }

    // INTERMEDIATE CONCRETE LANDING PLATFORM (Y = +halfRise, Z = -1.75)
    concreteParts.push(
      xform(new THREE.BoxGeometry(staircase.width + 0.2, 0.18, 1.5), [0, halfRise, -1.75])
    );
    steelParts.push(
      xform(new THREE.BoxGeometry(staircase.width + 0.24, 0.18, 0.22), [0, halfRise - 0.17, -1.75]),
      xform(new THREE.BoxGeometry(0.92, 0.08, 0.09), [0, halfRise + 2.02, -2.43])
    );
    railParts.push(
      xform(
        new THREE.CylinderGeometry(0.024, 0.024, staircase.width + 0.15, 8),
        [0, halfRise + 0.95, -2.45],
        [0, 0, Math.PI / 2]
      )
    );
    glassParts.push(
      xform(new THREE.BoxGeometry(staircase.width + 0.04, 0.72, 0.016), [0, halfRise + 0.5, -2.45])
    );
    for (const px of [-1.6, 0, 1.6]) {
      railParts.push(
        xform(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 8), [px, halfRise + 0.48, -2.45])
      );
    }

    // FLIGHT 2 (Mid-Landing -> Upper Floor) centered at x = +laneOffset, y = halfRise
    for (let idx = 0; idx < STEPS_PER_FLIGHT; idx++) {
      const sy = halfRise + (idx + 0.5) * stepRise;
      const sz = -1.0 + (idx + 0.5) * stepDepth;
      concreteParts.push(
        xform(new THREE.BoxGeometry(laneWidth, stepRise * 0.96, stepDepth * 1.04), [
          laneOffset,
          sy,
          sz,
        ])
      );
      nosingParts.push(
        xform(new THREE.BoxGeometry(laneWidth - 0.02, 0.018, 0.045), [
          laneOffset,
          sy + stepRise * 0.48,
          sz - stepDepth * 0.44,
        ])
      );
    }

    // Flight 2 upper bridge plate
    concreteParts.push(
      xform(new THREE.BoxGeometry(laneWidth, 0.14, 1.15), [laneOffset, halfRise * 2 - 0.06, 2.75])
    );

    // Flight 2 stringers, rails, stanchions, glass
    for (const sx of [-laneWidth / 2 - 0.04, laneWidth / 2 + 0.04]) {
      const wx = laneOffset + sx;
      steelParts.push(
        xform(
          new THREE.BoxGeometry(0.07, 0.24, stringerLength + 0.2),
          [wx, halfRise + halfRise / 2 - 0.06, -1.0 + flightRun / 2],
          [-stringerAngle, 0, 0]
        )
      );
      railParts.push(
        xform(
          new THREE.CylinderGeometry(0.024, 0.024, stringerLength + 0.18, 8),
          [wx, halfRise + halfRise / 2 + 0.92, -1.0 + flightRun / 2],
          [-stringerAngle + Math.PI / 2, 0, 0]
        )
      );
      glassParts.push(
        xform(
          new THREE.BoxGeometry(0.016, 0.68, stringerLength - 0.08),
          [wx, halfRise + halfRise / 2 + 0.47, -1.0 + flightRun / 2],
          [-stringerAngle, 0, 0]
        )
      );
      for (const frac of POST_FRACTIONS) {
        railParts.push(
          xform(new THREE.CylinderGeometry(0.016, 0.016, 0.92, 8), [
            wx,
            halfRise + frac * halfRise + 0.45,
            -1.0 + frac * flightRun,
          ])
        );
      }
    }

    return {
      concreteGeo: mergeGroup(concreteParts),
      nosingGeo: mergeGroup(nosingParts),
      steelGeo: mergeGroup(steelParts),
      railGeo: mergeGroup(railParts),
      glassGeo: mergeGroup(glassParts),
    };
  }, [flightRun, halfRise, laneOffset, laneWidth, staircase.width]);

  useEffect(() => {
    return () => {
      mergedGeos.concreteGeo?.dispose();
      mergedGeos.nosingGeo?.dispose();
      mergedGeos.steelGeo?.dispose();
      mergedGeos.railGeo?.dispose();
      mergedGeos.glassGeo?.dispose();
    };
  }, [mergedGeos]);

  return (
    <group position={staircase.origin} rotation={[0, staircase.rotationY, 0]}>
      {mergedGeos.concreteGeo && (
        <mesh
          geometry={mergedGeos.concreteGeo}
          material={materials.stairConcrete}
          castShadow
          receiveShadow
        />
      )}
      {mergedGeos.nosingGeo && (
        <mesh geometry={mergedGeos.nosingGeo} material={materials.stairNosing} />
      )}
      {mergedGeos.steelGeo && (
        <mesh geometry={mergedGeos.steelGeo} material={materials.structuralSteel} castShadow />
      )}
      {mergedGeos.railGeo && (
        <mesh geometry={mergedGeos.railGeo} material={materials.brushedSteel} />
      )}
      {mergedGeos.glassGeo && (
        <mesh geometry={mergedGeos.glassGeo} material={materials.stairGlass} />
      )}

      {/* Cool-white architectural wall-wash LED bar above landing */}
      <mesh
        position={[0, halfRise + 1.98, -2.39]}
        material={ceilingLightsOn ? materials.fluorescentOn : materials.fluorescentOff}
      >
        <boxGeometry args={[0.82, 0.03, 0.045]} />
      </mesh>
    </group>
  );
});
