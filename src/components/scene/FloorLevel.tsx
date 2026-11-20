import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FloorDefinition, RoomDefinition, WallSegment } from '../../types/game';
import {
  BUILDING_DEPTH,
  BUILDING_WIDTH,
  COURTYARD_HALF,
  SLAB_THICKNESS,
  WALL_HEIGHT,
  WING_SPAN_HALF,
} from '../../data/buildingLayout';
import { useIndustrialMaterials } from '../../three/MaterialContext';
import { useGameStore } from '../../store/useGameStore';
import {
  getSpecialKeyForDoor,
  IndustrialDoor,
  StaticApartmentDoorsBatch,
} from './IndustrialDoor';
import { OverheadPipeRun } from './IndustrialProps';
import { ApartmentFurnitureBatch } from './ApartmentFurnitureBatch';
import { MissionRoomInterior } from './MissionRoomInterior';
import { PuzzleChamberInterior } from './PuzzleChamberInterior';
import { CorridorDetailsLayer } from './CorridorDetailsLayer';

interface FloorLevelProps {
  floorData: FloorDefinition;
}

/**
 * Builds a square floor slab geometry with the 26x26m hollow courtyard cutout
 * and stairwell cutouts on upper floors.
 */
function createFloorSlabGeometry(cutouts: FloorDefinition['cutouts']): THREE.BufferGeometry {
  const hw = BUILDING_WIDTH / 2;
  const hd = BUILDING_DEPTH / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hd);
  shape.lineTo(hw, -hd);
  shape.lineTo(hw, hd);
  shape.lineTo(-hw, hd);
  shape.closePath();

  cutouts.forEach((hole) => {
    const holePath = new THREE.Path();
    const yMin = -hole.maxZ;
    const yMax = -hole.minZ;
    holePath.moveTo(hole.minX, yMin);
    holePath.lineTo(hole.maxX, yMin);
    holePath.lineTo(hole.maxX, yMax);
    holePath.lineTo(hole.minX, yMax);
    holePath.closePath();
    shape.holes.push(holePath);
  });

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: SLAB_THICKNESS,
    bevelEnabled: false,
    curveSegments: 1,
  });

  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -SLAB_THICKNESS, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Merges static wall segments into a single BufferGeometry to minimize draw calls across 80 rooms.
 */
function mergeWallSegments(walls: WallSegment[], elevation: number): THREE.BufferGeometry | null {
  if (walls.length === 0) return null;
  const parts: THREE.BufferGeometry[] = [];
  for (const wall of walls) {
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.02) continue;
    const angle = Math.atan2(dz, dx);
    const cx = (wall.x1 + wall.x2) / 2;
    const cz = (wall.z1 + wall.z2) / 2;
    const thickness = wall.thickness ?? 0.26;

    const box = new THREE.BoxGeometry(length, WALL_HEIGHT, thickness);
    box.rotateY(-angle);
    box.translate(cx, elevation + WALL_HEIGHT / 2, cz);
    parts.push(box);
  }
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function createFloorSignTexture(floorNum: number, subtitle: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#141d20';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = '#5a726d';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 148);

  ctx.fillStyle = '#e2f0ec';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(`FLOOR 0${floorNum}`, 30, 74);

  ctx.fillStyle = '#9bbdb5';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(subtitle, 30, 124);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const FrontFacadeWallMesh: React.FC<{
  wall: WallSegment;
  elevation: number;
  cutawayMode: boolean;
}> = React.memo(({ wall, elevation, cutawayMode }) => {
  const materials = useIndustrialMaterials();
  const dx = wall.x2 - wall.x1;
  const dz = wall.z2 - wall.z1;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const cx = (wall.x1 + wall.x2) / 2;
  const cz = (wall.z1 + wall.z2) / 2;
  const height = cutawayMode ? 0.45 : WALL_HEIGHT;
  const thickness = wall.thickness ?? 0.34;

  return (
    <mesh
      position={[cx, elevation + height / 2, cz]}
      rotation={[0, -angle, 0]}
      material={materials.concreteExterior}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length, height, thickness]} />
    </mesh>
  );
});

const RoomFloorHighlight: React.FC<{
  room: RoomDefinition;
  elevation: number;
}> = React.memo(({ room, elevation }) => {
  const materials = useIndustrialMaterials();
  const isSelected = useGameStore((s) => s.selectedRoomId === room.id);
  const selectRoom = useGameStore((s) => s.selectRoom);
  const missionDoorOpen = useGameStore((s) => s.doorStates.mission !== 'closed');
  const puzzleDoorOpen = useGameStore((s) => s.doorStates.puzzle !== 'closed');

  const width = room.bounds.maxX - room.bounds.minX;
  const depth = room.bounds.maxZ - room.bounds.minZ;
  const cx = (room.bounds.minX + room.bounds.maxX) / 2;
  const cz = (room.bounds.minZ + room.bounds.maxZ) / 2;

  const zoneMat =
    room.category === 'mission' && missionDoorOpen
      ? materials.escapeZoneFloor
      : room.category === 'puzzle' && puzzleDoorOpen
      ? materials.puzzleZoneFloor
      : materials.corridorDeck;

  return (
    <group position={[cx, elevation + 0.018, cz]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          selectRoom(isSelected ? null : room.id);
        }}
      >
        <planeGeometry args={[width - 0.32, depth - 0.32]} />
        <primitive object={zoneMat} attach="material" />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.0, 2.35, 4]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      )}
    </group>
  );
});

export const FloorLevel: React.FC<FloorLevelProps> = React.memo(({ floorData }) => {
  const materials = useIndustrialMaterials();
  const layoutVersion = useGameStore((s) => s.layoutVersion);
  const missionFloor = useGameStore((s) => s.missionFloor);
  const puzzleFloor = useGameStore((s) => s.puzzleFloor);
  const controlMode = useGameStore((s) => s.controlMode);
  const cutawayMode = useGameStore((s) => s.cutawayMode);

  const effectiveCutaway = controlMode === 'orbit' && cutawayMode;
  const y = floorData.elevation;

  const slabGeometry = useMemo(() => createFloorSlabGeometry(floorData.cutouts), [floorData.cutouts]);

  const { interiorWallsGeo, exteriorWallsGeo, frontWalls } = useMemo(() => {
    void layoutVersion;
    const front = floorData.walls.filter((w) => w.isFrontFacade);
    const ext = floorData.walls.filter((w) => w.isExterior && !w.isFrontFacade);
    const interior = floorData.walls.filter((w) => !w.isExterior && !w.isFrontFacade);
    return {
      frontWalls: front,
      exteriorWallsGeo: mergeWallSegments(ext, y),
      interiorWallsGeo: mergeWallSegments(interior, y),
    };
  }, [floorData.walls, layoutVersion, y]);

  // Split doors into permanently locked static doors (batched) vs the 0-2 animated special doors on this floor
  const { staticDoors, animatedSpecialDoors } = useMemo(() => {
    void layoutVersion;
    const statics = [];
    const specials = [];
    for (let i = 0; i < floorData.doors.length; i++) {
      const door = floorData.doors[i];
      if (getSpecialKeyForDoor(door) !== null || door.isInteriorEscape) {
        specials.push(door);
      } else {
        statics.push(door);
      }
    }
    return { staticDoors: statics, animatedSpecialDoors: specials };
  }, [floorData.doors, layoutVersion]);

  const floorSignTex = useMemo(
    () =>
      createFloorSignTexture(
        floorData.floor,
        `APARTMENTS ${floorData.floor}01–${floorData.floor}20`
      ),
    [floorData.floor]
  );

  useEffect(() => {
    return () => {
      slabGeometry.dispose();
      interiorWallsGeo?.dispose();
      exteriorWallsGeo?.dispose();
      floorSignTex.dispose();
    };
  }, [exteriorWallsGeo, floorSignTex, interiorWallsGeo, slabGeometry]);

  const stairwellCutouts = useMemo(
    () => floorData.cutouts.filter((c) => c.kind === 'stairwell'),
    [floorData.cutouts]
  );

  return (
    <group>
      {/* 1. Square Concrete Slab with Hollow Central Courtyard & Stairwell Cutouts */}
      <mesh position={[0, y, 0]} geometry={slabGeometry} material={materials.concreteFloor} receiveShadow castShadow />

      {/* 2. Apartment Interior Flooring */}
      {floorData.rooms.map((room) => (
        <RoomFloorHighlight key={room.id} room={room} elevation={y} />
      ))}

      {/* 3. Hollow Central Courtyard Safety Railings & Concrete Curb (All 4 Sides, All 4 Floors) */}
      <group position={[0, y, 0]}>
        {[-COURTYARD_HALF, COURTYARD_HALF].map((cz) => (
          <group key={`cy-ns-${cz}`} position={[0, 0, cz]}>
            <mesh position={[0, 0.08, 0]} material={materials.concreteExterior} receiveShadow>
              <boxGeometry args={[COURTYARD_HALF * 2 + 0.16, 0.16, 0.22]} />
            </mesh>
            <mesh position={[0, 1.04, 0]} material={materials.brushedSteel}>
              <boxGeometry args={[COURTYARD_HALF * 2 + 0.16, 0.06, 0.08]} />
            </mesh>
            <mesh position={[0, 0.56, 0]} material={materials.railingSteel}>
              <boxGeometry args={[COURTYARD_HALF * 2 + 0.08, 0.04, 0.04]} />
            </mesh>
          </group>
        ))}

        {[-COURTYARD_HALF, COURTYARD_HALF].map((cx) => (
          <group key={`cy-we-${cx}`} position={[cx, 0, 0]}>
            <mesh position={[0, 0.08, 0]} material={materials.concreteExterior} receiveShadow>
              <boxGeometry args={[0.22, 0.16, COURTYARD_HALF * 2 + 0.16]} />
            </mesh>
            <mesh position={[0, 1.04, 0]} material={materials.brushedSteel}>
              <boxGeometry args={[0.08, 0.06, COURTYARD_HALF * 2 + 0.16]} />
            </mesh>
            <mesh position={[0, 0.56, 0]} material={materials.railingSteel}>
              <boxGeometry args={[0.04, 0.04, COURTYARD_HALF * 2 + 0.08]} />
            </mesh>
          </group>
        ))}

        <mesh position={[0, -0.12, -COURTYARD_HALF + 0.06]} material={materials.concreteExterior}>
          <boxGeometry args={[COURTYARD_HALF * 2 + 0.2, 0.26, 0.14]} />
        </mesh>
        <mesh position={[0, -0.12, COURTYARD_HALF - 0.06]} material={materials.concreteExterior}>
          <boxGeometry args={[COURTYARD_HALF * 2 + 0.2, 0.26, 0.14]} />
        </mesh>
      </group>

      {/* 4. Stairwell Cutout Safety Curbs & Floor 4 Drop-Off Guards */}
      {stairwellCutouts.map((hole, idx) => {
        const cz = (hole.minZ + hole.maxZ) / 2;
        const cx = (hole.minX + hole.maxX) / 2;
        const d = hole.maxZ - hole.minZ;
        const w = hole.maxX - hole.minX;
        const isWestShaft = hole.minX < 0;
        const guardX = isWestShaft ? hole.minX + 1.1 : hole.maxX - 1.1;
        const guardZ = isWestShaft ? hole.maxZ : hole.minZ;
        const backZ = isWestShaft ? hole.minZ : hole.maxZ;
        return (
          <group key={`stair-guard-${floorData.floor}-${idx}`}>
            <mesh position={[hole.minX, y + 0.055, cz]} material={materials.stairNosing}>
              <boxGeometry args={[0.12, 0.11, d]} />
            </mesh>
            <mesh position={[hole.maxX, y + 0.055, cz]} material={materials.stairNosing}>
              <boxGeometry args={[0.12, 0.11, d]} />
            </mesh>
            <mesh position={[cx, y + 0.94, backZ]} material={materials.brushedSteel}>
              <boxGeometry args={[w, 0.05, 0.05]} />
            </mesh>
            <mesh position={[cx, y + 0.48, backZ]} material={materials.stairGlass}>
              <boxGeometry args={[w - 0.1, 0.72, 0.016]} />
            </mesh>
            {floorData.floor === 4 && (
              <group position={[guardX, y, guardZ]}>
                <mesh position={[0, 0.94, 0]} material={materials.brushedSteel}>
                  <boxGeometry args={[2.2, 0.05, 0.05]} />
                </mesh>
                <mesh position={[0, 0.48, 0]} material={materials.stairGlass}>
                  <boxGeometry args={[2.1, 0.72, 0.016]} />
                </mesh>
                {[-1.0, 0, 1.0].map((px) => (
                  <mesh key={px} position={[px, 0.47, 0]} material={materials.brushedSteel}>
                    <cylinderGeometry args={[0.02, 0.02, 0.94, 8]} />
                  </mesh>
                ))}
              </group>
            )}
          </group>
        );
      })}

      {/* 5. Merged Interior & Exterior Apartment Walls + Cutaway Front Facade */}
      {interiorWallsGeo && (
        <mesh geometry={interiorWallsGeo} material={materials.concreteWall} castShadow receiveShadow />
      )}
      {exteriorWallsGeo && (
        <mesh geometry={exteriorWallsGeo} material={materials.concreteExterior} castShadow receiveShadow />
      )}
      {frontWalls.map((wall) => (
        <FrontFacadeWallMesh key={wall.id} wall={wall} elevation={y} cutawayMode={effectiveCutaway} />
      ))}

      {/* 6. Apartment Floor Signage mounted flush on wing end walls facing NW & SE Stairwell Lobbies */}
      <mesh position={[-WING_SPAN_HALF - 0.16, y + 2.4, -20.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.4, 0.75]} />
        <meshBasicMaterial map={floorSignTex} />
      </mesh>
      <mesh position={[WING_SPAN_HALF + 0.16, y + 2.4, 20.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.4, 0.75]} />
        <meshBasicMaterial map={floorSignTex} />
      </mesh>

      {/* 7. Batched Ordinary Apartment Doors + Individual Animated Special Doors */}
      <StaticApartmentDoorsBatch key={`static-doors-${floorData.floor}-${layoutVersion}`} doors={staticDoors} />
      {animatedSpecialDoors.map((door) => (
        <IndustrialDoor key={`${door.id}-${layoutVersion}`} door={door} />
      ))}

      {/* 8. Instanced Balcony Balusters & 80-Room Furniture */}
      <ApartmentFurnitureBatch key={`${floorData.floor}-${layoutVersion}`} floorData={floorData} />

      {/* 8B. Instanced Abandoned Institutional Corridor Details, Runner Tiles & Suspended Ceilings */}
      <CorridorDetailsLayer floorData={floorData} effectiveCutaway={effectiveCutaway} />

      {/* 9. Dynamically Assigned Mission Room & Puzzle Room */}
      {floorData.floor === missionFloor && <MissionRoomInterior />}
      {floorData.floor === puzzleFloor && <PuzzleChamberInterior />}

      {/* 10. Overhead Utility Conduit Loop */}
      {floorData.pipes.map((pipe) => (
        <OverheadPipeRun key={pipe.id} pipe={pipe} />
      ))}
    </group>
  );
});
