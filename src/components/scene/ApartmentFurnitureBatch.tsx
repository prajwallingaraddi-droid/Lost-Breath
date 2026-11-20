import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FloorDefinition } from '../../types/game';
import { COURTYARD_HALF } from '../../data/buildingLayout';
import { useIndustrialMaterials } from '../../three/MaterialContext';

interface ApartmentFurnitureBatchProps {
  floorData: FloorDefinition;
}

const _dummy = new THREE.Object3D();

/**
 * InstancedMesh batch renderer for repeated apartment furnishings, courtyard balcony
 * balusters, and corridor utility breaker boxes (keeps 80 rooms silky smooth on M4).
 */
export const ApartmentFurnitureBatch: React.FC<ApartmentFurnitureBatchProps> = ({ floorData }) => {
  const materials = useIndustrialMaterials();

  const y = floorData.elevation;

  // Group props by archetype
  const groupedProps = useMemo(() => {
    const sofas = floorData.props.filter((p) => p.type === 'sofa');
    const beds = floorData.props.filter((p) => p.type === 'bed');
    const tables = floorData.props.filter((p) => p.type === 'table');
    const kitchens = floorData.props.filter((p) => p.type === 'kitchen');
    const wardrobes = floorData.props.filter((p) => p.type === 'wardrobe');
    const benches = floorData.props.filter((p) => p.type === 'bench');
    const elecBoxes = floorData.props.filter((p) => p.type === 'elec-box');
    return { sofas, beds, tables, kitchens, wardrobes, benches, elecBoxes };
  }, [floorData.props]);

  // Courtyard safety railing baluster positions (every 1.3m along 4 sides of ±13.0m atrium)
  const balusterPositions = useMemo(() => {
    const list: [number, number, number][] = [];
    for (let p = -COURTYARD_HALF + 0.65; p <= COURTYARD_HALF - 0.65; p += 1.3) {
      list.push([p, y + 0.54, -COURTYARD_HALF]);
      list.push([p, y + 0.54, COURTYARD_HALF]);
    }
    for (let p = -COURTYARD_HALF + 1.3; p <= COURTYARD_HALF - 1.3; p += 1.3) {
      list.push([-COURTYARD_HALF, y + 0.54, p]);
      list.push([COURTYARD_HALF, y + 0.54, p]);
    }
    return list;
  }, [y]);

  // Refs for InstancedMeshes
  const balusterRef = useRef<THREE.InstancedMesh>(null);
  const sofaBaseRef = useRef<THREE.InstancedMesh>(null);
  const sofaBackRef = useRef<THREE.InstancedMesh>(null);
  const bedFrameRef = useRef<THREE.InstancedMesh>(null);
  const bedMattressRef = useRef<THREE.InstancedMesh>(null);
  const tableTopRef = useRef<THREE.InstancedMesh>(null);
  const tableLegRef = useRef<THREE.InstancedMesh>(null);
  const kitchenCabRef = useRef<THREE.InstancedMesh>(null);
  const kitchenTopRef = useRef<THREE.InstancedMesh>(null);
  const wardrobeRef = useRef<THREE.InstancedMesh>(null);
  const benchRef = useRef<THREE.InstancedMesh>(null);
  const elecBoxRef = useRef<THREE.InstancedMesh>(null);

  // Shared geometries
  const geos = useMemo(() => {
    return {
      baluster: new THREE.CylinderGeometry(0.022, 0.022, 0.96, 8),
      sofaBase: new THREE.BoxGeometry(1.85, 0.42, 0.85),
      sofaBack: new THREE.BoxGeometry(1.85, 0.48, 0.2),
      bedFrame: new THREE.BoxGeometry(1.9, 0.28, 1.35),
      bedMattress: new THREE.BoxGeometry(1.8, 0.24, 1.25),
      tableTop: new THREE.BoxGeometry(1.3, 0.07, 0.85),
      tableLeg: new THREE.BoxGeometry(1.12, 0.7, 0.68),
      kitchenCab: new THREE.BoxGeometry(1.65, 0.88, 0.68),
      kitchenTop: new THREE.BoxGeometry(1.72, 0.06, 0.72),
      wardrobe: new THREE.BoxGeometry(1.5, 2.05, 0.65),
      bench: new THREE.BoxGeometry(1.45, 0.46, 0.52),
      elecBox: new THREE.BoxGeometry(0.55, 0.82, 0.16),
    };
  }, []);

  useLayoutEffect(() => {
    return () => {
      Object.values(geos).forEach((g) => g.dispose());
    };
  }, [geos]);

  // Populate Courtyard Balusters
  useLayoutEffect(() => {
    const mesh = balusterRef.current;
    if (!mesh) return;
    balusterPositions.forEach((pos, idx) => {
      _dummy.position.set(pos[0], pos[1], pos[2]);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(idx, _dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [balusterPositions]);

  // Populate Apartment Furnishings
  useLayoutEffect(() => {
    const placePart = (
      mesh: THREE.InstancedMesh | null,
      items: typeof floorData.props,
      localY: number,
      localZ = 0
    ) => {
      if (!mesh || items.length === 0) return;
      items.forEach((item, idx) => {
        const sin = Math.sin(item.rotationY);
        const cos = Math.cos(item.rotationY);
        _dummy.position.set(
          item.position[0] + localZ * sin,
          item.position[1] + localY,
          item.position[2] + localZ * cos
        );
        _dummy.rotation.set(0, item.rotationY, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        mesh.setMatrixAt(idx, _dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };

    placePart(sofaBaseRef.current, groupedProps.sofas, 0.21, 0);
    placePart(sofaBackRef.current, groupedProps.sofas, 0.62, -0.32);

    placePart(bedFrameRef.current, groupedProps.beds, 0.14, 0);
    placePart(bedMattressRef.current, groupedProps.beds, 0.4, 0);

    placePart(tableTopRef.current, groupedProps.tables, 0.74, 0);
    placePart(tableLegRef.current, groupedProps.tables, 0.35, 0);

    placePart(kitchenCabRef.current, groupedProps.kitchens, 0.44, 0);
    placePart(kitchenTopRef.current, groupedProps.kitchens, 0.91, 0);

    placePart(wardrobeRef.current, groupedProps.wardrobes, 1.025, 0);
    placePart(benchRef.current, groupedProps.benches, 0.23, 0);
    placePart(elecBoxRef.current, groupedProps.elecBoxes, 1.5, 0);
  }, [floorData.props, groupedProps]);

  return (
    <group>
      {/* Courtyard Safety Railings (Brushed Steel Tubular Balusters) */}
      <instancedMesh
        ref={balusterRef}
        args={[geos.baluster, materials.brushedSteel, balusterPositions.length]}
        castShadow
      />

      {/* Apartment Sofas */}
      {groupedProps.sofas.length > 0 && (
        <>
          <instancedMesh
            ref={sofaBaseRef}
            args={[geos.sofaBase, materials.fabricSlate, groupedProps.sofas.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={sofaBackRef}
            args={[geos.sofaBack, materials.fabricSlate, groupedProps.sofas.length]}
            castShadow
          />
        </>
      )}

      {/* Apartment Beds */}
      {groupedProps.beds.length > 0 && (
        <>
          <instancedMesh
            ref={bedFrameRef}
            args={[geos.bedFrame, materials.cabinetWood, groupedProps.beds.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={bedMattressRef}
            args={[geos.bedMattress, materials.counterTop, groupedProps.beds.length]}
            castShadow
          />
        </>
      )}

      {/* Apartment Tables */}
      {groupedProps.tables.length > 0 && (
        <>
          <instancedMesh
            ref={tableTopRef}
            args={[geos.tableTop, materials.apartmentWood, groupedProps.tables.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={tableLegRef}
            args={[geos.tableLeg, materials.railingSteel, groupedProps.tables.length]}
          />
        </>
      )}

      {/* Kitchenette Counters */}
      {groupedProps.kitchens.length > 0 && (
        <>
          <instancedMesh
            ref={kitchenCabRef}
            args={[geos.kitchenCab, materials.cabinetWood, groupedProps.kitchens.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={kitchenTopRef}
            args={[geos.kitchenTop, materials.counterTop, groupedProps.kitchens.length]}
          />
        </>
      )}

      {/* Wardrobes */}
      {groupedProps.wardrobes.length > 0 && (
        <instancedMesh
          ref={wardrobeRef}
          args={[geos.wardrobe, materials.cabinetWood, groupedProps.wardrobes.length]}
          castShadow
          receiveShadow
        />
      )}

      {/* Corridor Corner Benches */}
      {groupedProps.benches.length > 0 && (
        <instancedMesh
          ref={benchRef}
          args={[geos.bench, materials.cabinetWood, groupedProps.benches.length]}
          castShadow
          receiveShadow
        />
      )}

      {/* Corridor Electrical Breaker Boxes */}
      {groupedProps.elecBoxes.length > 0 && (
        <instancedMesh
          ref={elecBoxRef}
          args={[geos.elecBox, materials.brushedSteel, groupedProps.elecBoxes.length]}
        />
      )}
    </group>
  );
};
