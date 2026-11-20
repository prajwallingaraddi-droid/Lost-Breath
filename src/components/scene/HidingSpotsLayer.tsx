import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { HIDING_SPOTS } from '../../data/hidingSpots';
import { useGameStore } from '../../store/useGameStore';
import { useIndustrialMaterials } from '../../three/MaterialContext';
import { HidingSpotDefinition } from '../../types/game';

interface HidingSpotMaterials {
  woodDark: THREE.MeshStandardMaterial;
  woodTrim: THREE.MeshStandardMaterial;
  cabinetSlate: THREE.MeshStandardMaterial;
  cabinetDoor: THREE.MeshStandardMaterial;
  crateWood: THREE.MeshStandardMaterial;
  laundrySteel: THREE.MeshStandardMaterial;
  highlightTrim: THREE.MeshStandardMaterial;
  dispose: () => void;
}

function createHidingSpotMaterials(): HidingSpotMaterials {
  const woodDark = new THREE.MeshStandardMaterial({
    color: '#3f2a1d',
    roughness: 0.78,
    metalness: 0.06,
  });
  const woodTrim = new THREE.MeshStandardMaterial({
    color: '#5a3d2a',
    roughness: 0.72,
    metalness: 0.08,
  });
  const cabinetSlate = new THREE.MeshStandardMaterial({
    color: '#2c3846',
    roughness: 0.56,
    metalness: 0.48,
  });
  const cabinetDoor = new THREE.MeshStandardMaterial({
    color: '#384758',
    roughness: 0.5,
    metalness: 0.52,
  });
  const crateWood = new THREE.MeshStandardMaterial({
    color: '#6e5235',
    roughness: 0.86,
    metalness: 0.04,
  });
  const laundrySteel = new THREE.MeshStandardMaterial({
    color: '#3a4654',
    roughness: 0.45,
    metalness: 0.55,
  });
  const highlightTrim = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    emissive: '#f59e0b',
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });

  return {
    woodDark,
    woodTrim,
    cabinetSlate,
    cabinetDoor,
    crateWood,
    laundrySteel,
    highlightTrim,
    dispose: () => {
      woodDark.dispose();
      woodTrim.dispose();
      cabinetSlate.dispose();
      cabinetDoor.dispose();
      crateWood.dispose();
      laundrySteel.dispose();
      highlightTrim.dispose();
    },
  };
}

interface HidingSpotUnitProps {
  spot: HidingSpotDefinition;
  isNearby: boolean;
  isPlayerInside: boolean;
  mats: HidingSpotMaterials;
  unitBoxGeo: THREE.BoxGeometry;
}

const HidingSpotUnit: React.FC<HidingSpotUnitProps> = React.memo(({
  spot,
  isNearby,
  isPlayerInside,
  mats,
  unitBoxGeo,
}) => {
  const indMats = useIndustrialMaterials();

  if (spot.type === 'wardrobe') {
    return (
      <group position={spot.position} rotation={[0, spot.rotationY, 0]}>
        {/* Solid plinth & rear/side wooden wardrobe carcass */}
        <mesh position={[0, 0.06, 0]} scale={[1.72, 0.12, 0.98]} geometry={unitBoxGeo} material={mats.woodDark} receiveShadow />
        <mesh position={[0, 1.18, -0.44]} scale={[1.68, 2.12, 0.1]} geometry={unitBoxGeo} material={mats.woodDark} castShadow receiveShadow />
        <mesh position={[-0.79, 1.18, 0]} scale={[0.1, 2.12, 0.94]} geometry={unitBoxGeo} material={mats.woodDark} castShadow receiveShadow />
        <mesh position={[0.79, 1.18, 0]} scale={[0.1, 2.12, 0.94]} geometry={unitBoxGeo} material={mats.woodDark} castShadow receiveShadow />
        {/* Crown cornice */}
        <mesh position={[0, 2.29, 0.02]} scale={[1.8, 0.12, 1.04]} geometry={unitBoxGeo} material={mats.woodTrim} castShadow />
        {/* Twin slatted wardrobe doors (slightly ajar when player hides inside) */}
        <mesh
          position={[-0.38, 1.18, 0.45]}
          rotation={[0, isPlayerInside ? 0.14 : 0, 0]}
          scale={[0.74, 2.04, 0.05]}
          geometry={unitBoxGeo}
          material={mats.woodTrim}
        />
        <mesh
          position={[0.38, 1.18, 0.45]}
          rotation={[0, isPlayerInside ? -0.14 : 0, 0]}
          scale={[0.74, 2.04, 0.05]}
          geometry={unitBoxGeo}
          material={mats.woodTrim}
        />
        {/* Brass door handles */}
        <mesh position={[-0.08, 1.12, 0.49]} scale={[0.035, 0.16, 0.035]} geometry={unitBoxGeo} material={indMats.brassTrim} />
        <mesh position={[0.08, 1.12, 0.49]} scale={[0.035, 0.16, 0.035]} geometry={unitBoxGeo} material={indMats.brassTrim} />
        {/* Subtle interactive edge indicator when player stands nearby */}
        {isNearby && !isPlayerInside && (
          <mesh position={[0, 2.22, 0.5]} scale={[0.68, 0.03, 0.03]} geometry={unitBoxGeo} material={mats.highlightTrim} />
        )}
      </group>
    );
  }

  if (spot.type === 'crate-stack') {
    return (
      <group position={spot.position} rotation={[0, spot.rotationY, 0]}>
        {/* Heavy stacked cargo crates forming a believable recessed shelter bay */}
        <mesh position={[0, 0.95, -0.22]} scale={[1.64, 1.9, 0.56]} geometry={unitBoxGeo} material={mats.crateWood} castShadow receiveShadow />
        <mesh position={[-0.68, 0.82, 0.24]} scale={[0.42, 1.64, 0.62]} geometry={unitBoxGeo} material={mats.crateWood} castShadow receiveShadow />
        <mesh position={[0.68, 0.82, 0.24]} scale={[0.42, 1.64, 0.62]} geometry={unitBoxGeo} material={mats.crateWood} castShadow receiveShadow />
        <mesh position={[0, 1.96, 0.12]} scale={[1.76, 0.12, 0.96]} geometry={unitBoxGeo} material={indMats.structuralSteel} castShadow />
        <mesh position={[-0.2, 2.28, 0.05]} scale={[0.92, 0.54, 0.72]} geometry={unitBoxGeo} material={mats.crateWood} castShadow />
        <mesh position={[0, 0.64, 0.5]} scale={[1.18, 1.28, 0.08]} geometry={unitBoxGeo} material={mats.woodDark} />
        <mesh position={[0, 0.64, 0.55]} scale={[1.22, 0.06, 0.02]} geometry={unitBoxGeo} material={indMats.brushedSteel} />
        {isNearby && !isPlayerInside && (
          <mesh position={[0, 1.88, 0.55]} scale={[0.64, 0.03, 0.03]} geometry={unitBoxGeo} material={mats.highlightTrim} />
        )}
      </group>
    );
  }

  // 'storage-cabinet' | 'utility-cupboard' | 'laundry-locker'
  const bodyMat = spot.type === 'laundry-locker' ? mats.laundrySteel : mats.cabinetSlate;
  const doorMat = spot.type === 'utility-cupboard' ? indMats.brushedSteel : mats.cabinetDoor;
  const width = spot.type === 'storage-cabinet' ? 1.68 : 1.54;

  return (
    <group position={spot.position} rotation={[0, spot.rotationY, 0]}>
      <mesh position={[0, 0.06, 0]} scale={[width + 0.06, 0.12, 1.0]} geometry={unitBoxGeo} material={indMats.structuralSteel} receiveShadow />
      <mesh position={[0, 1.15, -0.44]} scale={[width, 2.08, 0.1]} geometry={unitBoxGeo} material={bodyMat} castShadow receiveShadow />
      <mesh position={[-width / 2 + 0.05, 1.15, 0]} scale={[0.1, 2.08, 0.94]} geometry={unitBoxGeo} material={bodyMat} castShadow receiveShadow />
      <mesh position={[width / 2 - 0.05, 1.15, 0]} scale={[0.1, 2.08, 0.94]} geometry={unitBoxGeo} material={bodyMat} castShadow receiveShadow />
      <mesh position={[0, 2.24, 0]} scale={[width + 0.06, 0.1, 1.0]} geometry={unitBoxGeo} material={indMats.structuralSteel} castShadow />
      {/* Twin louvered metal locker doors */}
      <mesh
        position={[-width * 0.23, 1.15, 0.45]}
        rotation={[0, isPlayerInside ? 0.16 : 0, 0]}
        scale={[width * 0.44, 1.98, 0.045]}
        geometry={unitBoxGeo}
        material={doorMat}
      />
      <mesh
        position={[width * 0.23, 1.15, 0.45]}
        rotation={[0, isPlayerInside ? -0.16 : 0, 0]}
        scale={[width * 0.44, 1.98, 0.045]}
        geometry={unitBoxGeo}
        material={doorMat}
      />
      {/* Vent louver slots (sight slits when player hides inside) */}
      {[1.72, 1.6, 1.48].map((vy) => (
        <mesh key={vy} position={[0, vy, 0.48]} scale={[width * 0.72, 0.032, 0.02]} geometry={unitBoxGeo} material={indMats.structuralSteel} />
      ))}
      {/* Chrome locker handles */}
      <mesh position={[-0.07, 1.1, 0.49]} scale={[0.03, 0.16, 0.035]} geometry={unitBoxGeo} material={indMats.brushedSteel} />
      <mesh position={[0.07, 1.1, 0.49]} scale={[0.03, 0.16, 0.035]} geometry={unitBoxGeo} material={indMats.brushedSteel} />
      {/* Subtle utility hazard stripe on lower kickpanel */}
      <mesh position={[0, 0.24, 0.48]} scale={[width * 0.84, 0.08, 0.015]} geometry={unitBoxGeo} material={indMats.hazardStripe} />
      {isNearby && !isPlayerInside && (
        <mesh position={[0, 2.18, 0.5]} scale={[0.64, 0.03, 0.03]} geometry={unitBoxGeo} material={mats.highlightTrim} />
      )}
    </group>
  );
});

export const HidingSpotsLayer: React.FC = React.memo(() => {
  const controlMode = useGameStore((s) => s.controlMode);
  const activeFloor = useGameStore((s) => s.activeFloor);
  const cutawayMode = useGameStore((s) => s.cutawayMode);
  const nearbyHidingSpotId = useGameStore((s) => s.nearbyHidingSpotId);
  const playerHiddenSpotId = useGameStore((s) => s.playerHiddenSpotId);

  const mats = useMemo(() => createHidingSpotMaterials(), []);
  const unitBoxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useEffect(() => {
    return () => {
      mats.dispose();
      unitBoxGeo.dispose();
    };
  }, [mats, unitBoxGeo]);

  const effectiveCutaway = controlMode === 'orbit' && cutawayMode;
  const visibleSpots = useMemo(
    () =>
      HIDING_SPOTS.filter((s) => {
        if (!effectiveCutaway || activeFloor === 'all') return true;
        return s.floor <= activeFloor;
      }),
    [effectiveCutaway, activeFloor]
  );

  return (
    <group>
      {visibleSpots.map((spot) => (
        <HidingSpotUnit
          key={spot.id}
          spot={spot}
          isNearby={nearbyHidingSpotId === spot.id}
          isPlayerInside={playerHiddenSpotId === spot.id}
          mats={mats}
          unitBoxGeo={unitBoxGeo}
        />
      ))}
    </group>
  );
});
