import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PipeRun } from '../../types/game';
import { useIndustrialMaterials } from '../../three/MaterialContext';

export const OverheadPipeRun: React.FC<{ pipe: PipeRun }> = ({ pipe }) => {
  const materials = useIndustrialMaterials();

  const segments = useMemo(() => {
    const out: {
      mid: [number, number, number];
      length: number;
      quat: THREE.Quaternion;
    }[] = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < pipe.points.length - 1; i++) {
      const a = new THREE.Vector3(...pipe.points[i]);
      const b = new THREE.Vector3(...pipe.points[i + 1]);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      if (len < 0.01) continue;
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
      out.push({ mid: [mid.x, mid.y, mid.z], length: len, quat });
    }
    return out;
  }, [pipe.points]);

  const pipeMaterial =
    pipe.variant === 'coolant'
      ? materials.coolantPipe
      : pipe.variant === 'hazard'
      ? materials.safetyYellow
      : materials.steamPipe;

  return (
    <group>
      {segments.map((seg, idx) => (
        <mesh key={`${pipe.id}-seg-${idx}`} position={seg.mid} quaternion={seg.quat} material={pipeMaterial}>
          <cylinderGeometry args={[pipe.radius, pipe.radius, seg.length, 10]} />
        </mesh>
      ))}
      {pipe.points.map((pt, idx) => (
        <mesh key={`${pipe.id}-joint-${idx}`} position={pt} material={materials.structuralSteel}>
          <sphereGeometry args={[pipe.radius * 1.45, 10, 10]} />
        </mesh>
      ))}
    </group>
  );
};
