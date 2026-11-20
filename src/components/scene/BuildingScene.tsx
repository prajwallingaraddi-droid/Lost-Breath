import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  BUILDING_DEPTH,
  BUILDING_FLOORS,
  BUILDING_STAIRCASES,
  BUILDING_WIDTH,
  COURTYARD_HALF,
  FINAL_EXIT_PASSAGE,
  FLOOR_HEIGHT,
  SLAB_THICKNESS,
} from '../../data/buildingLayout';
import { useGameStore } from '../../store/useGameStore';
import { useIndustrialMaterials } from '../../three/MaterialContext';
import { FloorLevel } from './FloorLevel';
import { Staircase } from './Staircase';
import { BeastActor } from './BeastActor';
import { PlayerCharacter } from './PlayerCharacter';
import { HidingSpotsLayer } from './HidingSpotsLayer';
import { EmergencyLightsLayer } from './EmergencyLightsLayer';
import { SafeRoomAndDescent } from './SafeRoomAndDescent';
import { CourtyardFountainGarden } from './CourtyardFountainGarden';
import { AbandonedCityExterior } from './AbandonedCityExterior';
import { CompoundEnclosure } from './CompoundEnclosure';
import { ApartmentBuildingExterior } from './ApartmentBuildingExterior';

function createHollowRoofGeometry(): THREE.BufferGeometry {
  const hw = BUILDING_WIDTH / 2 + 0.25;
  const hd = BUILDING_DEPTH / 2 + 0.25;

  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hd);
  shape.lineTo(hw, -hd);
  shape.lineTo(hw, hd);
  shape.lineTo(-hw, hd);
  shape.closePath();

  // Open skylight atrium cutout matching the hollow central courtyard
  const hole = new THREE.Path();
  hole.moveTo(-COURTYARD_HALF, -COURTYARD_HALF);
  hole.lineTo(COURTYARD_HALF, -COURTYARD_HALF);
  hole.lineTo(COURTYARD_HALF, COURTYARD_HALF);
  hole.lineTo(-COURTYARD_HALF, COURTYARD_HALF);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: SLAB_THICKNESS,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export const BuildingScene: React.FC = () => {
  const materials = useIndustrialMaterials();
  const layoutVersion = useGameStore((s) => s.layoutVersion);
  const controlMode = useGameStore((s) => s.controlMode);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const cutawayMode = useGameStore((s) => s.cutawayMode);
  void layoutVersion;

  const effectiveCutaway = controlMode === 'orbit' && cutawayMode;

  const visibleFloors = BUILDING_FLOORS.filter((f) => {
    if (!effectiveCutaway || activeFloor === 'all') return true;
    return f.floor <= activeFloor;
  });

  const maxVisibleFloor = visibleFloors[visibleFloors.length - 1]?.floor ?? 4;
  const visibleStaircases = BUILDING_STAIRCASES.filter(
    (s) => s.fromFloor < maxVisibleFloor || activeFloor === 'all' || controlMode !== 'orbit'
  );

  const totalColumnHeight = maxVisibleFloor * FLOOR_HEIGHT;
  const roofGeometry = useMemo(() => createHollowRoofGeometry(), []);

  useEffect(() => {
    return () => {
      roofGeometry.dispose();
    };
  }, [roofGeometry]);

  return (
    <group>
      {/* 1. Deep Ground Apron Below Building & Open Hollow Courtyard Void */}
      <mesh position={[0, -2.6, 0]} receiveShadow>
        <boxGeometry args={[96, 0.3, 96]} />
        <meshStandardMaterial color="#0c1413" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Outer Ring Foundation Plinth (leaves central [-13, 13] courtyard open for the centerpiece garden & fountain) */}
      {[
        [0, -20.6, BUILDING_WIDTH + 1.2, 15.2],
        [0, 20.6, BUILDING_WIDTH + 1.2, 15.2],
        [-20.6, 0, 15.2, COURTYARD_HALF * 2],
        [20.6, 0, 15.2, COURTYARD_HALF * 2],
      ].map(([fx, fz, fw, fd], idx) => (
        <mesh key={`plinth-${idx}`} position={[fx, -0.36, fz]} material={materials.concreteExterior} receiveShadow>
          <boxGeometry args={[fw, 0.24, fd]} />
        </mesh>
      ))}

      {/* 1B. Central Courtyard Working Fountain & Lush Garden Ambience */}
      <CourtyardFountainGarden />

      {/* 1C. Abandoned City Exterior, Complete Compound & Playable Apartment Exterior */}
      <AbandonedCityExterior />
      <CompoundEnclosure />
      <ApartmentBuildingExterior />

      {/* 2. Exterior Perimeter & Inner Courtyard Structural Columns */}
      {[
        [-28, -28],
        [0, -28],
        [28, -28],
        [-28, 0],
        [28, 0],
        [-28, 28],
        [0, 28],
        [28, 28],
        [-COURTYARD_HALF, -COURTYARD_HALF],
        [COURTYARD_HALF, -COURTYARD_HALF],
        [-COURTYARD_HALF, COURTYARD_HALF],
        [COURTYARD_HALF, COURTYARD_HALF],
      ]
        .filter(([cx, cz]) => Math.hypot(cx - FINAL_EXIT_PASSAGE.doorX, cz - FINAL_EXIT_PASSAGE.doorZ) > 1.6)
        .map(([cx, cz], idx) => (
          <mesh
            key={`col-${idx}`}
            position={[cx, totalColumnHeight / 2 - 0.1, cz]}
            material={materials.structuralSteel}
            castShadow
          >
            <boxGeometry args={[0.48, totalColumnHeight + 0.2, 0.48]} />
          </mesh>
        ))}

      {/* 3. Four Connected Apartment Floors (20 Rooms / Floor = 80 Rooms) */}
      {visibleFloors.map((floorData) => (
        <FloorLevel key={floorData.floor} floorData={floorData} />
      ))}

      {/* 4. Multi-Floor Switchback Staircases (NW & SE Corners) */}
      {visibleStaircases.map((stair) => (
        <Staircase key={stair.id} staircase={stair} />
      ))}

      {/* 5. Main Playable 3D Human Survivor Character (Third-Person) */}
      <PlayerCharacter />

      {/* 6. Four Independent Warrior Beasts */}
      <BeastActor />

      {/* 6. 20 Corridor-Safe Hiding Structures Across All 4 Floors */}
      <HidingSpotsLayer />

      {/* 7. Building-Wide Flashing Red Emergency Lights (Active on Genuine Key Pickup Alarm) */}
      <EmergencyLightsLayer />

      {/* 8. Floor 3 Safe Room + Physical 2-Level Emergency Descent Tower + Floor 1 Ground Exit */}
      <SafeRoomAndDescent />

      {/* 7. Hollow Roof Slab with Open Atrium Parapet & Rooftop HVAC Units */}
      {!effectiveCutaway && (
        <group position={[0, FLOOR_HEIGHT * 4 - SLAB_THICKNESS, 0]}>
          <mesh geometry={roofGeometry} material={materials.concreteExterior} castShadow receiveShadow />
          {[-18, 18].map((hx) => (
            <mesh key={hx} position={[hx, 0.9, -22]} material={materials.brushedSteel} castShadow>
              <boxGeometry args={[5.8, 1.4, 3.2]} />
            </mesh>
          ))}
          <mesh position={[22, 2.6, -22]} material={materials.structuralSteel}>
            <cylinderGeometry args={[0.14, 0.24, 5.0, 10]} />
          </mesh>
          <mesh position={[22, 5.1, -22]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2.2} />
          </mesh>
        </group>
      )}
    </group>
  );
};
