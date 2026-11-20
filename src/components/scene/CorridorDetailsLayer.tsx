import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { FloorDefinition } from '../../types/game';
import {
  CORRIDOR_OUTER,
  COURTYARD_HALF,
  WALL_HEIGHT,
  WING_SPAN_HALF,
} from '../../data/buildingLayout';
import { HIDING_SPOTS } from '../../data/hidingSpots';
import { useIndustrialMaterials } from '../../three/MaterialContext';
import { useGameStore } from '../../store/useGameStore';

interface CorridorDetailsLayerProps {
  floorData: FloorDefinition;
  effectiveCutaway: boolean;
}

interface Placement {
  pos: [number, number, number];
  rotY: number;
  scale?: [number, number, number];
  rotX?: number;
  rotZ?: number;
}

const _dummy = new THREE.Object3D();

/**
 * High-performance instanced architectural detailing for every apartment corridor floor:
 * - Alternating dark charcoal-slate ceramic center runner tiles
 * - Suspended acoustic T-bar grid ceilings & recessed cool-white fluorescent troffers
 * - Occasional flickering/damaged fluorescent ceiling panels + soft additive haze cones
 * - Ceiling smoke detectors, dark skirting baseboards, wall switches, fire safety gear,
 *   HVAC ventilation grilles, and wall-hugging abandoned cardboard archive boxes & papers.
 */
export const CorridorDetailsLayer: React.FC<CorridorDetailsLayerProps> = ({
  floorData,
  effectiveCutaway,
}) => {
  const materials = useIndustrialMaterials();
  const ceilingLightsOn = useGameStore((s) => s.ceilingLightsOn);

  const y = floorData.elevation;
  const mid = (COURTYARD_HALF + CORRIDOR_OUTER) / 2; // 14.8m corridor centerline
  const corridorWidth = CORRIDOR_OUTER - COURTYARD_HALF; // 3.6m
  const ceilingY = y + WALL_HEIGHT - 0.03;
  const trofferY = y + WALL_HEIGHT - 0.048;

  const floorHidingSpots = useMemo(
    () => HIDING_SPOTS.filter((h) => h.floor === floorData.floor),
    [floorData.floor]
  );

  // 1. Alternating dark charcoal rectangular floor runner tiles along all 4 wings
  const darkRunnerTiles = useMemo(() => {
    const tiles: Placement[] = [];
    // North & South wings (X runs along -15.4 to +15.4)
    for (let x = -14.8; x <= 14.81; x += 2.68) {
      tiles.push({ pos: [x, y + 0.008, -mid], rotY: 0 });
      tiles.push({ pos: [x, y + 0.008, mid], rotY: 0 });
    }
    // West & East wings (Z runs along -12.1 to +12.1 so corners don't double-overlap)
    for (let z = -12.12; z <= 12.13; z += 2.68) {
      tiles.push({ pos: [-mid, y + 0.008, z], rotY: Math.PI / 2 });
      tiles.push({ pos: [mid, y + 0.008, z], rotY: Math.PI / 2 });
    }
    return tiles;
  }, [mid, y]);

  // 2. Recessed fluorescent troffers & ceiling smoke detectors along all 4 wings
  const { steadyTroffers, flickerTroffers, smokeDetectors } = useMemo(() => {
    const all: Placement[] = [];
    const detectors: Placement[] = [];

    // North & South wings
    for (let x = -14.8; x <= 14.81; x += 3.7) {
      all.push({ pos: [x, trofferY, -mid], rotY: 0 });
      all.push({ pos: [x, trofferY, mid], rotY: 0 });
      if (x + 1.85 <= 14.8) {
        detectors.push({ pos: [x + 1.85, ceilingY - 0.025, -mid], rotY: 0 });
        detectors.push({ pos: [x + 1.85, ceilingY - 0.025, mid], rotY: 0 });
      }
    }
    // West & East wings
    for (let z = -11.1; z <= 11.11; z += 3.7) {
      all.push({ pos: [-mid, trofferY, z], rotY: Math.PI / 2 });
      all.push({ pos: [mid, trofferY, z], rotY: Math.PI / 2 });
      if (z + 1.85 <= 11.1) {
        detectors.push({ pos: [-mid, ceilingY - 0.025, z + 1.85], rotY: 0 });
        detectors.push({ pos: [mid, ceilingY - 0.025, z + 1.85], rotY: 0 });
      }
    }

    // Pick 3 deterministic flickering/damaged fixtures per floor
    const fIdxSet = new Set<number>([
      (floorData.floor * 7 + 3) % all.length,
      (floorData.floor * 11 + 14) % all.length,
      (floorData.floor * 5 + 23) % all.length,
    ]);

    const steady: Placement[] = [];
    const flicker: (Placement & { seed: number })[] = [];
    all.forEach((item, idx) => {
      if (fIdxSet.has(idx)) {
        flicker.push({ ...item, seed: idx * 3.17 + floorData.floor * 5.41 });
      } else {
        steady.push(item);
      }
    });

    return {
      steadyTroffers: steady,
      flickerTroffers: flicker,
      smokeDetectors: detectors,
    };
  }, [ceilingY, floorData.floor, mid, trofferY]);

  // 3. Corridor Baseboards, Door Switches, HVAC Vents, Fire Stations, and Abandoned Paper Boxes
  const {
    baseboards,
    lightSwitches,
    hvacVents,
    firePulls,
    extinguishers,
    archiveBoxes,
    boxPapers,
    floorPapers,
  } = useMemo(() => {
    const bBoards: Placement[] = [];
    const switches: Placement[] = [];
    const vents: Placement[] = [];
    const pulls: Placement[] = [];
    const exts: Placement[] = [];
    const boxes: Placement[] = [];
    const inBoxPapers: Placement[] = [];
    const loosePapers: Placement[] = [];

    const isClearOfHiding = (wx: number, wz: number) =>
      floorHidingSpots.every((h) => Math.hypot(wx - h.position[0], wz - h.position[2]) > 1.85);

    const isClearOfDoors = (wx: number, wz: number) =>
      floorData.doors.every((d) => Math.hypot(wx - d.position[0], wz - d.position[2]) > 1.35);

    // Wall-mounted light switch beside every corridor apartment door
    floorData.doors.forEach((door) => {
      if (door.isInteriorEscape) return;
      const cos = Math.cos(door.rotationY);
      const sin = Math.sin(door.rotationY);
      // Offset right of door jamb (+0.88m local X) and flush on corridor face (+0.155m local Z)
      const sx = door.position[0] + 0.88 * cos + 0.155 * sin;
      const sz = door.position[2] - 0.88 * sin + 0.155 * cos;
      switches.push({ pos: [sx, y + 1.26, sz], rotY: door.rotationY });
    });

    // Corridor outer walls (4 wings, 5 apartments per wing spanning -13.5..+13.5, walls between doors)
    // Door centers along each wing sit at -10.8, -5.4, 0, +5.4, +10.8 (door width ~1.18m + frame 0.28m -> +-0.75m)
    const pierCenters = [-12.55, -8.1, -2.7, 2.7, 8.1, 12.55];
    const pierLengths = [1.85, 3.85, 3.85, 3.85, 3.85, 1.85];

    const wingConfigs = [
      // North wall at Z = -16.45, facing +Z (rotY = 0)
      { axis: 'x' as const, fixed: -(CORRIDOR_OUTER - 0.15), normalSign: 1, rotY: 0 },
      // South wall at Z = +16.45, facing -Z (rotY = Math.PI)
      { axis: 'x' as const, fixed: CORRIDOR_OUTER - 0.15, normalSign: -1, rotY: Math.PI },
      // West wall at X = -16.45, facing +X (rotY = Math.PI/2)
      { axis: 'z' as const, fixed: -(CORRIDOR_OUTER - 0.15), normalSign: 1, rotY: Math.PI / 2 },
      // East wall at X = +16.45, facing -X (rotY = -Math.PI/2)
      { axis: 'z' as const, fixed: CORRIDOR_OUTER - 0.15, normalSign: -1, rotY: -Math.PI / 2 },
    ];

    wingConfigs.forEach((wing, wIdx) => {
      // Baseboards along corridor wall piers
      pierCenters.forEach((c, pIdx) => {
        const len = pierLengths[pIdx];
        const bx = wing.axis === 'x' ? c : wing.fixed;
        const bz = wing.axis === 'x' ? wing.fixed : c;
        bBoards.push({
          pos: [bx, y + 0.068, bz],
          rotY: wing.rotY,
          scale: [len, 1, 1],
        });
      });

      // Upper-wall HVAC ventilation grilles (2 per wing)
      [-8.1, 8.1].forEach((vc) => {
        const vx = wing.axis === 'x' ? vc : wing.fixed + wing.normalSign * 0.025;
        const vz = wing.axis === 'x' ? wing.fixed + wing.normalSign * 0.025 : vc;
        vents.push({ pos: [vx, y + 3.62, vz], rotY: wing.rotY });
      });

      // Fire alarm pull station + fire extinguisher on alternating wing piers
      const firePier = wIdx % 2 === 0 ? -2.7 : 2.7;
      const fx = wing.axis === 'x' ? firePier : wing.fixed + wing.normalSign * 0.05;
      const fz = wing.axis === 'x' ? wing.fixed + wing.normalSign * 0.05 : firePier;
      if (isClearOfHiding(fx, fz)) {
        pulls.push({ pos: [fx, y + 1.42, fz], rotY: wing.rotY });
        const exOffset = 0.48;
        const exX =
          wing.axis === 'x'
            ? firePier + exOffset
            : wing.fixed + wing.normalSign * 0.13;
        const exZ =
          wing.axis === 'x'
            ? wing.fixed + wing.normalSign * 0.13
            : firePier + exOffset;
        exts.push({ pos: [exX, y + 0.88, exZ], rotY: wing.rotY });
      }

      // Abandoned cardboard archive boxes overflowing with documents + scattered papers on floor
      // 1-2 per wing tucked right against the wall pier (reference photo signature detail!)
      const boxCandidates = wIdx % 2 === 0 ? [-8.1, 2.7] : [-2.7, 8.1];
      boxCandidates.forEach((bc, bIdx) => {
        const offsetAlong = ((floorData.floor + wIdx + bIdx) % 2 === 0 ? 1 : -1) * 0.72;
        const coord = bc + offsetAlong;
        const wx = wing.axis === 'x' ? coord : wing.fixed + wing.normalSign * 0.24;
        const wz = wing.axis === 'x' ? wing.fixed + wing.normalSign * 0.24 : coord;

        if (!isClearOfHiding(wx, wz) || !isClearOfDoors(wx, wz)) return;

        const yawJitter = ((floorData.floor * 13 + wIdx * 7 + bIdx * 5) % 9 - 4) * 0.05;
        boxes.push({ pos: [wx, y + 0.175, wz], rotY: wing.rotY + yawJitter });

        // 3 slightly angled protruding document sheets inside the open box
        for (let ip = 0; ip < 3; ip++) {
          inBoxPapers.push({
            pos: [
              wx + (ip - 1) * 0.075 * Math.cos(wing.rotY),
              y + 0.35 + ip * 0.014,
              wz - (ip - 1) * 0.075 * Math.sin(wing.rotY),
            ],
            rotY: wing.rotY + (ip - 1) * 0.32,
            rotX: 0.22 + ip * 0.12,
            rotZ: (ip - 1) * 0.18,
          });
        }

        // 4 scattered flat newspaper / document sheets resting on floor tiles right beside the box
        const paperOffsets: [number, number, number][] = [
          [0.34, 0.16, 0.24],
          [0.42, 0.22, -0.58],
          [0.24, 0.28, 0.85],
          [-0.32, 0.18, -0.35],
        ];
        paperOffsets.forEach(([along, out, rot], pIdx) => {
          const px =
            wing.axis === 'x'
              ? coord + along
              : wing.fixed + wing.normalSign * (0.28 + out);
          const pz =
            wing.axis === 'x'
              ? wing.fixed + wing.normalSign * (0.28 + out)
              : coord + along;
          loosePapers.push({
            pos: [px, y + 0.008 + pIdx * 0.0025, pz],
            rotY: wing.rotY + rot,
          });
        });
      });
    });

    return {
      baseboards: bBoards,
      lightSwitches: switches,
      hvacVents: vents,
      firePulls: pulls,
      extinguishers: exts,
      archiveBoxes: boxes,
      boxPapers: inBoxPapers,
      floorPapers: loosePapers,
    };
  }, [floorData.doors, floorData.floor, floorHidingSpots, y]);

  // Refs for InstancedMeshes
  const darkTileRef = useRef<THREE.InstancedMesh>(null);
  const steadyBezelRef = useRef<THREE.InstancedMesh>(null);
  const steadyDiffuserRef = useRef<THREE.InstancedMesh>(null);
  const steadyGlowRef = useRef<THREE.InstancedMesh>(null);
  const detectorRef = useRef<THREE.InstancedMesh>(null);
  const baseboardRef = useRef<THREE.InstancedMesh>(null);
  const switchRef = useRef<THREE.InstancedMesh>(null);
  const ventRef = useRef<THREE.InstancedMesh>(null);
  const firePullRef = useRef<THREE.InstancedMesh>(null);
  const extBodyRef = useRef<THREE.InstancedMesh>(null);
  const extHeadRef = useRef<THREE.InstancedMesh>(null);
  const boxRef = useRef<THREE.InstancedMesh>(null);
  const boxPaperRef = useRef<THREE.InstancedMesh>(null);
  const loosePaperRef = useRef<THREE.InstancedMesh>(null);

  // Dedicated refs for flickering fluorescent diffuser materials (3 per floor)
  const flickerMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const flickerGlowRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  // Shared geometries
  const geos = useMemo(
    () => ({
      darkTile: new THREE.BoxGeometry(1.24, 0.008, 1.18),
      trofferBezel: new THREE.BoxGeometry(1.3, 0.045, 0.7),
      trofferDiffuser: new THREE.BoxGeometry(1.16, 0.022, 0.56),
      trofferGlow: new THREE.ConeGeometry(1.08, 2.05, 12, 1, true),
      detector: new THREE.CylinderGeometry(0.085, 0.095, 0.045, 12),
      baseboard: new THREE.BoxGeometry(1, 0.135, 0.032),
      wallSwitch: new THREE.BoxGeometry(0.11, 0.16, 0.025),
      hvacVent: new THREE.BoxGeometry(0.76, 0.28, 0.045),
      firePull: new THREE.BoxGeometry(0.16, 0.21, 0.075),
      extBody: new THREE.CylinderGeometry(0.08, 0.08, 0.46, 10),
      extHead: new THREE.CylinderGeometry(0.035, 0.055, 0.11, 8),
      archiveBox: new THREE.BoxGeometry(0.42, 0.34, 0.34),
      paperSheet: new THREE.PlaneGeometry(0.28, 0.34),
    }),
    []
  );

  useLayoutEffect(() => {
    return () => {
      Object.values(geos).forEach((g) => g.dispose());
    };
  }, [geos]);

  const applyInstances = (
    mesh: THREE.InstancedMesh | null,
    items: Placement[],
    yOffset = 0,
    extraRotX = 0
  ) => {
    if (!mesh || items.length === 0) return;
    items.forEach((item, idx) => {
      _dummy.position.set(item.pos[0], item.pos[1] + yOffset, item.pos[2]);
      _dummy.rotation.set(
        (item.rotX ?? 0) + extraRotX,
        item.rotY,
        item.rotZ ?? 0
      );
      if (item.scale) {
        _dummy.scale.set(item.scale[0], item.scale[1], item.scale[2]);
      } else {
        _dummy.scale.set(1, 1, 1);
      }
      _dummy.updateMatrix();
      mesh.setMatrixAt(idx, _dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  useLayoutEffect(() => {
    applyInstances(darkTileRef.current, darkRunnerTiles);
    applyInstances(baseboardRef.current, baseboards);
    applyInstances(switchRef.current, lightSwitches);
    applyInstances(ventRef.current, hvacVents);
    applyInstances(firePullRef.current, firePulls);
    applyInstances(extBodyRef.current, extinguishers);
    applyInstances(extHeadRef.current, extinguishers, 0.28);
    applyInstances(boxRef.current, archiveBoxes);
    applyInstances(boxPaperRef.current, boxPapers);
    applyInstances(loosePaperRef.current, floorPapers, 0, -Math.PI / 2);
  }, [
    archiveBoxes,
    baseboards,
    boxPapers,
    darkRunnerTiles,
    extinguishers,
    firePulls,
    floorPapers,
    hvacVents,
    lightSwitches,
  ]);

  useLayoutEffect(() => {
    if (effectiveCutaway) return;
    applyInstances(steadyBezelRef.current, steadyTroffers);
    applyInstances(steadyDiffuserRef.current, steadyTroffers, -0.015);
    applyInstances(steadyGlowRef.current, steadyTroffers, -1.04, 0);
    applyInstances(detectorRef.current, smokeDetectors);
  }, [effectiveCutaway, smokeDetectors, steadyTroffers]);

  // Subtle realistic fluorescent ballast flicker on 3 damaged ceiling fixtures per floor (zero GC)
  useFrame(({ clock }) => {
    if (effectiveCutaway || !ceilingLightsOn) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < flickerTroffers.length; i++) {
      const mat = flickerMatRefs.current[i];
      const glow = flickerGlowRefs.current[i];
      if (!mat) continue;
      const seed = flickerTroffers[i].seed;
      // Organic uneven ballast flutter
      const w1 = Math.sin(t * 9.5 + seed);
      const w2 = Math.sin(t * 23.7 + seed * 1.9);
      const w3 = Math.sin(t * 3.1 + seed * 0.6);
      const isStutterWindow = w3 > 0.42;
      const drop = isStutterWindow && w1 * w2 > 0.22;
      const intensity = drop ? 0.16 : 1.2 + 0.18 * Math.max(0, w1);
      mat.emissiveIntensity = intensity;
      if (glow) {
        glow.opacity = drop ? 0.008 : 0.042;
      }
    }
  });

  // Suspended acoustic ceiling wing lengths
  const nsCeilingLength = CORRIDOR_OUTER * 2; // 33.2m (spans -16.6 to +16.6)
  const weCeilingLength = COURTYARD_HALF * 2; // 26.0m (spans -13.0 to +13.0 between N/S)

  return (
    <group>
      {/* 1. Signature Alternating Dark Ceramic Center Runner Tiles */}
      <instancedMesh
        ref={darkTileRef}
        args={[geos.darkTile, materials.darkAccentTile, darkRunnerTiles.length]}
        receiveShadow
      />

      {/* 2. Dark Corridor Skirting Baseboards */}
      <instancedMesh
        ref={baseboardRef}
        args={[geos.baseboard, materials.baseboardDark, baseboards.length]}
        receiveShadow
      />

      {/* 3. Wall-Mounted Door Light Switches */}
      <instancedMesh
        ref={switchRef}
        args={[geos.wallSwitch, materials.brushedSteel, lightSwitches.length]}
      />

      {/* 4. Upper-Wall HVAC Ventilation Grilles */}
      <instancedMesh
        ref={ventRef}
        args={[geos.hvacVent, materials.ventGrille, hvacVents.length]}
      />

      {/* 5. Fire Alarm Pull Stations & Wall-Mounted Extinguishers */}
      {firePulls.length > 0 && (
        <instancedMesh
          ref={firePullRef}
          args={[geos.firePull, materials.fireRed, firePulls.length]}
        />
      )}
      {extinguishers.length > 0 && (
        <>
          <instancedMesh
            ref={extBodyRef}
            args={[geos.extBody, materials.fireRed, extinguishers.length]}
            castShadow
          />
          <instancedMesh
            ref={extHeadRef}
            args={[geos.extHead, materials.structuralSteel, extinguishers.length]}
          />
        </>
      )}

      {/* 6. Wall-Hugging Abandoned Cardboard Archive Boxes & Scattered Documents */}
      {archiveBoxes.length > 0 && (
        <instancedMesh
          ref={boxRef}
          args={[geos.archiveBox, materials.cardboardBox, archiveBoxes.length]}
          castShadow
          receiveShadow
        />
      )}
      {boxPapers.length > 0 && (
        <instancedMesh
          ref={boxPaperRef}
          args={[geos.paperSheet, materials.paperSheet, boxPapers.length]}
        />
      )}
      {floorPapers.length > 0 && (
        <instancedMesh
          ref={loosePaperRef}
          args={[geos.paperSheet, materials.paperSheet, floorPapers.length]}
          receiveShadow
        />
      )}

      {/* 7. Suspended Acoustic T-Bar Ceilings + Recessed Cool-White Fluorescent Troffers */}
      {!effectiveCutaway && (
        <group>
          {/* North & South Suspended Corridor Ceilings */}
          {[-mid, mid].map((cz) => (
            <mesh
              key={`ceil-ns-${cz}`}
              position={[0, ceilingY, cz]}
              rotation={[Math.PI / 2, 0, 0]}
              material={materials.suspendedCeiling}
            >
              <planeGeometry args={[nsCeilingLength, corridorWidth]} />
            </mesh>
          ))}

          {/* West & East Suspended Corridor Ceilings */}
          {[-mid, mid].map((cx) => (
            <mesh
              key={`ceil-we-${cx}`}
              position={[cx, ceilingY, 0]}
              rotation={[Math.PI / 2, 0, Math.PI / 2]}
              material={materials.suspendedCeiling}
            >
              <planeGeometry args={[weCeilingLength, corridorWidth]} />
            </mesh>
          ))}

          {/* Wing End-Cap Cornice Beams (crisp ceiling shadow framing) */}
          {[-WING_SPAN_HALF, WING_SPAN_HALF].map((edge) => (
            <React.Fragment key={`cornice-${edge}`}>
              <mesh position={[edge, ceilingY - 0.08, -mid]} material={materials.concreteExterior}>
                <boxGeometry args={[0.16, 0.16, corridorWidth]} />
              </mesh>
              <mesh position={[edge, ceilingY - 0.08, mid]} material={materials.concreteExterior}>
                <boxGeometry args={[0.16, 0.16, corridorWidth]} />
              </mesh>
            </React.Fragment>
          ))}

          {/* Steady Recessed Fluorescent Troffers (Instanced) */}
          <instancedMesh
            ref={steadyBezelRef}
            args={[geos.trofferBezel, materials.structuralSteel, steadyTroffers.length]}
          />
          <instancedMesh
            ref={steadyDiffuserRef}
            args={[
              geos.trofferDiffuser,
              ceilingLightsOn ? materials.fluorescentOn : materials.fluorescentOff,
              steadyTroffers.length,
            ]}
          />
          {ceilingLightsOn && (
            <instancedMesh
              ref={steadyGlowRef}
              args={[geos.trofferGlow, materials.fluorescentGlow, steadyTroffers.length]}
            />
          )}

          {/* Flickering / Damaged Fluorescent Troffers (3 per floor) */}
          {flickerTroffers.map((item, idx) => (
            <group key={`flicker-${floorData.floor}-${idx}`} position={item.pos} rotation={[0, item.rotY, 0]}>
              <mesh geometry={geos.trofferBezel} material={materials.structuralSteel} />
              <mesh position={[0, -0.015, 0]} geometry={geos.trofferDiffuser}>
                <meshStandardMaterial
                  ref={(el) => {
                    flickerMatRefs.current[idx] = el;
                  }}
                  color={ceilingLightsOn ? '#ffefd4' : '#3a3d42'}
                  emissive={ceilingLightsOn ? '#f0c68c' : '#14161a'}
                  emissiveIntensity={ceilingLightsOn ? 1.2 : 0.06}
                  roughness={0.28}
                />
              </mesh>
              {ceilingLightsOn && (
                <mesh position={[0, -1.04, 0]} geometry={geos.trofferGlow}>
                  <meshBasicMaterial
                    ref={(el) => {
                      flickerGlowRefs.current[idx] = el;
                    }}
                    color="#f2cf9e"
                    alphaMap={materials.fluorescentGlow.alphaMap}
                    transparent
                    opacity={0.045}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              )}
            </group>
          ))}

          {/* Ceiling Smoke Detectors */}
          <instancedMesh
            ref={detectorRef}
            args={[geos.detector, materials.smokeDetector, smokeDetectors.length]}
          />
        </group>
      )}
    </group>
  );
};
