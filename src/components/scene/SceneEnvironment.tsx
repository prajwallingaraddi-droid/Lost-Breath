import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useGameStore } from '../../store/useGameStore';
import { playerWorldPos } from '../../three/playerWorldState';
import {
  CORRIDOR_OUTER,
  COURTYARD_HALF,
  FLOOR_ELEVATIONS,
  MISSION_ROOM_BOUNDS,
  PUZZLE_CHAMBER_BOUNDS,
  SAFE_ROOM_BOUNDS,
} from '../../data/buildingLayout';

interface SceneEnvironmentProps {
  isSoftwareGl: boolean;
}

const DUST_COUNT = 240;

const NIGHT_BG = new THREE.Color('#0d1218');
const DAY_BG = new THREE.Color('#b7c8d6');
const HEMI_NIGHT_SKY = new THREE.Color('#cfd6df');
const HEMI_DAY_SKY = new THREE.Color('#dceaf7');
const HEMI_NIGHT_GND = new THREE.Color('#22262b');
const HEMI_DAY_GND = new THREE.Color('#524d41');
const SUN_NIGHT_COL = new THREE.Color('#a8c3df');
const SUN_DAY_COL = new THREE.Color('#fff1d6');

/**
 * Lightweight single-draw-call ambient dust motes drifting lazily through
 * the 4-floor corridors to add atmospheric depth without GPU cost.
 */
const CorridorDustMotes: React.FC = React.memo(() => {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3);
    const mid = (COURTYARD_HALF + CORRIDOR_OUTER) / 2;
    let seed = 918273;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < DUST_COUNT; i++) {
      const floorIdx = i % 4;
      const wing = (i >> 2) % 4;
      const along = (nextRand() - 0.5) * 30.0;
      const across = (nextRand() - 0.5) * 3.1;
      const height = FLOOR_ELEVATIONS[(floorIdx + 1) as 1 | 2 | 3 | 4] + 0.5 + nextRand() * 3.3;

      let x = 0;
      let z = 0;
      if (wing === 0) {
        x = along;
        z = -mid + across;
      } else if (wing === 1) {
        x = along;
        z = mid + across;
      } else if (wing === 2) {
        x = -mid + across;
        z = along;
      } else {
        x = mid + across;
        z = along;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: '#e6dcc8',
      size: 0.042,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const t = clock.getElapsedTime();
    pts.position.y = Math.sin(t * 0.22) * 0.14;
    pts.rotation.y = Math.sin(t * 0.04) * 0.008;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
});

export const SceneEnvironment: React.FC<SceneEnvironmentProps> = React.memo(({ isSoftwareGl }) => {
  const { gl, scene, camera } = useThree();
  const ceilingLightsOn = useGameStore((s) => s.ceilingLightsOn);
  const controlMode = useGameStore((s) => s.controlMode);
  const layoutVersion = useGameStore((s) => s.layoutVersion);
  void layoutVersion;

  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const fogRef = useRef<THREE.FogExp2>(null);
  const bgRef = useRef<THREE.Color>(null);
  const dayMixRef = useRef(1.0);

  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uDaylight: { value: 1.0 },
        uSunDir: { value: new THREE.Vector3(0.42, 0.72, 0.56).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(worldPos.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uDaylight;
        uniform vec3 uSunDir;
        varying vec3 vWorldDir;
        void main() {
          float h = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);
          float skyCurve = pow(clamp(vWorldDir.y, 0.0, 1.0), 0.52);

          vec3 dayHorizon = vec3(0.79, 0.85, 0.89);
          vec3 dayZenith = vec3(0.36, 0.56, 0.76);
          vec3 dayCol = mix(dayHorizon, dayZenith, skyCurve);

          float sunDot = max(dot(normalize(vWorldDir), uSunDir), 0.0);
          dayCol += vec3(0.34, 0.29, 0.21) * pow(sunDot, 12.0);
          dayCol += vec3(0.55, 0.48, 0.36) * pow(sunDot, 180.0);

          vec3 nightHorizon = vec3(0.06, 0.08, 0.11);
          vec3 nightZenith = vec3(0.025, 0.04, 0.065);
          vec3 nightCol = mix(nightHorizon, nightZenith, clamp(h, 0.0, 1.0));

          vec3 col = mix(nightCol, dayCol, uDaylight);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);

  const loadingSequenceTrigger = useGameStore((s) => s.loadingSequenceTrigger);

  useEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const renderTarget = pmremGenerator.fromScene(roomEnv, 0.045);
    scene.environment = renderTarget.texture;
    scene.environmentIntensity = 0.84;

    roomEnv.dispose();
    pmremGenerator.dispose();

    return () => {
      scene.environment = null;
      renderTarget.dispose();
      skyMaterial.dispose();
    };
  }, [gl, scene, skyMaterial]);

  useEffect(() => {
    const store = useGameStore.getState();
    store.setSceneLoadState(loadingSequenceTrigger === 0 ? 24 : 32, false);

    const manager = THREE.DefaultLoadingManager;
    const prevOnProgress = manager.onProgress;
    manager.onProgress = (_url, loaded, total) => {
      if (total > 0) {
        const pct = 28 + Math.round((loaded / total) * 40);
        useGameStore.getState().setSceneLoadState(Math.min(72, pct), false);
      }
      if (prevOnProgress) prevOnProgress(_url, loaded, total);
    };

    useGameStore.getState().setSceneLoadState(loadingSequenceTrigger === 0 ? 68 : 64, false);

    let active = true;
    let raf1 = 0;
    let raf2 = 0;
    let raf3 = 0;
    raf1 = requestAnimationFrame(() => {
      if (!active) return;
      useGameStore.getState().setSceneLoadState(84, false);
      raf2 = requestAnimationFrame(() => {
        if (!active) return;
        useGameStore.getState().setSceneLoadState(95, false);
        raf3 = requestAnimationFrame(() => {
          if (!active) return;
          useGameStore.getState().setSceneLoadState(100, true);
        });
      });
    });

    return () => {
      active = false;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(raf3);
      manager.onProgress = prevOnProgress;
    };
  }, [loadingSequenceTrigger]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const activePhase = useGameStore.getState().screenPhase;
    const isOutdoorView =
      activePhase === 'intro'
        ? Math.abs(camera.position.x) > 25.5 ||
          Math.abs(camera.position.z) > 25.5 ||
          camera.position.y > 17.8
        : controlMode === 'orbit' ||
          Math.abs(playerWorldPos.x) > 27.65 ||
          Math.abs(playerWorldPos.z) > 27.65;
    const targetDay = isOutdoorView ? 1.0 : 0.0;
    dayMixRef.current = THREE.MathUtils.damp(dayMixRef.current, targetDay, 4.2, delta);
    const d = dayMixRef.current;

    skyMaterial.uniforms.uDaylight.value = d;

    if (bgRef.current) {
      bgRef.current.lerpColors(NIGHT_BG, DAY_BG, d);
    }
    if (fogRef.current) {
      fogRef.current.color.lerpColors(NIGHT_BG, DAY_BG, d);
      fogRef.current.density = THREE.MathUtils.lerp(0.0112, 0.0038, d);
    }
    if (hemiRef.current) {
      hemiRef.current.color.lerpColors(HEMI_NIGHT_SKY, HEMI_DAY_SKY, d);
      hemiRef.current.groundColor.lerpColors(HEMI_NIGHT_GND, HEMI_DAY_GND, d);
      const indoorHemi = ceilingLightsOn ? 0.82 : 0.38;
      hemiRef.current.intensity = THREE.MathUtils.lerp(indoorHemi, 0.98, d);
    }
    if (sunRef.current) {
      sunRef.current.color.lerpColors(SUN_NIGHT_COL, SUN_DAY_COL, d);
      const indoorSun = ceilingLightsOn ? 1.44 : 0.82;
      sunRef.current.intensity = THREE.MathUtils.lerp(indoorSun, 2.02, d);
      sunRef.current.position.set(
        THREE.MathUtils.lerp(26, 44, d),
        THREE.MathUtils.lerp(46, 68, d),
        THREE.MathUtils.lerp(22, 54, d)
      );
    }
    scene.environmentIntensity = THREE.MathUtils.lerp(0.84, 0.78, d);
  });

  return (
    <>
      <color ref={bgRef} attach="background" args={['#b7c8d6']} />
      <fogExp2 ref={fogRef} attach="fog" args={['#b7c8d6', 0.0038]} />

      {/* Natural Daylight / Evening Gradient Sky Dome */}
      <mesh material={skyMaterial} frustumCulled={false}>
        <sphereGeometry args={[230, 24, 16]} />
      </mesh>

      {/* Dynamic Hemisphere Bounce (Outdoors Daylight <-> Indoors Concrete Bounce) */}
      <hemisphereLight ref={hemiRef} args={['#dceaf7', '#524d41', 0.98]} />

      {/* Primary Key Sunlight / Courtyard Moonlight Shadow Caster */}
      <directionalLight
        ref={sunRef}
        position={[44, 68, 54]}
        intensity={2.02}
        color="#fff1d6"
        castShadow={!isSoftwareGl}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={5}
        shadow-camera-far={185}
        shadow-camera-left={-78}
        shadow-camera-right={78}
        shadow-camera-top={78}
        shadow-camera-bottom={-78}
        shadow-bias={-0.00045}
        shadow-normalBias={0.025}
      />

      {/* Subtle warm industrial counter-fill keeping apartment walls & graphite floors navigable */}
      <directionalLight
        position={[-28, 24, -26]}
        intensity={ceilingLightsOn ? 0.62 : 0.28}
        color="#d8bfa0"
      />

      {/* Floor 1 Central Haunted Courtyard Cool Pale-Blue / Moss Illumination */}
      <pointLight
        position={[0, FLOOR_ELEVATIONS[1] + 4.1, 0]}
        color="#7fb4d8"
        intensity={ceilingLightsOn ? 8.2 : 5.2}
        distance={34}
        decay={1.3}
      />

      {/* Floor 1 Warm Industrial Corridor Wing Fills */}
      <pointLight
        position={[-14.8, FLOOR_ELEVATIONS[1] + 3.4, 14.8]}
        color="#ffe1b5"
        intensity={ceilingLightsOn ? 9.4 : 2.8}
        distance={38}
        decay={1.22}
      />
      <pointLight
        position={[14.8, FLOOR_ELEVATIONS[1] + 3.4, -14.8]}
        color="#ffe1b5"
        intensity={ceilingLightsOn ? 9.4 : 2.8}
        distance={38}
        decay={1.22}
      />

      {/* Floors 2–4 Warm Industrial Corridor Fills */}
      {([2, 3, 4] as const).map((fl) => (
        <pointLight
          key={`atrium-light-${fl}`}
          position={[0, FLOOR_ELEVATIONS[fl] + 3.55, 0]}
          color="#ffe1b5"
          intensity={ceilingLightsOn ? 10.6 : 3.4}
          distance={48}
          decay={1.18}
        />
      ))}

      {/* Mission Room warm tungsten interior illumination */}
      <pointLight
        position={[
          MISSION_ROOM_BOUNDS.centerX,
          MISSION_ROOM_BOUNDS.elevation + 3.4,
          MISSION_ROOM_BOUNDS.centerZ,
        ]}
        color="#f0be74"
        intensity={7.2}
        distance={18}
        decay={1.45}
      />

      {/* Puzzle Room cool institutional cyan illumination */}
      <pointLight
        position={[
          PUZZLE_CHAMBER_BOUNDS.centerX,
          PUZZLE_CHAMBER_BOUNDS.elevation + 3.4,
          PUZZLE_CHAMBER_BOUNDS.centerZ,
        ]}
        color="#82d4e8"
        intensity={7.2}
        distance={18}
        decay={1.45}
      />

      {/* Dynamic Safe Room Exterior Escape Passage emerald beacon fill */}
      <pointLight
        position={[
          SAFE_ROOM_BOUNDS.centerX,
          SAFE_ROOM_BOUNDS.elevation + 2.6,
          SAFE_ROOM_BOUNDS.centerZ,
        ]}
        color="#22c55e"
        intensity={7.2}
        distance={18}
        decay={1.45}
      />

      {/* Subtle drifting ambient corridor dust particles */}
      {!isSoftwareGl && <CorridorDustMotes />}
    </>
  );
});
