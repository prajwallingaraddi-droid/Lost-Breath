import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  BEAST_ROSTER,
  BeastRosterEntry,
  getBeastDifficultyProfile,
} from '../../data/beastConfig';
import { FLOOR_ELEVATIONS } from '../../data/buildingLayout';
import { useGameStore } from '../../store/useGameStore';
import {
  BeastBrainState,
  createBeastBrainStateForRoster,
  stepBeastBrain,
} from '../../three/beastAiEngine';
import { createBeastWarriorMaterials } from '../../three/beastTextures';
import { getFloorFromElevation } from '../../three/floorNavigation';
import {
  barrierFeedbackState,
  beastWorldPos,
  beastWorldPositions,
  playerWorldPos,
} from '../../three/playerWorldState';
import {
  playBarrierStrikeSound,
  playBeastAlarmReactionSound,
  playBeastBattleCrySound,
  playBeastBreathingSound,
  playBeastCaptureSound,
  playBeastChasePulseSound,
  playBeastDetectSound,
  playBeastFootstepSound,
  playBeastGrowlSound,
  playBeastServoSound,
  playBeastSwordSwishSound,
  SpatialAudioPos,
} from '../../three/soundEffects';
import { BeastTelemetryEntry, FloorNumber } from '../../types/game';

const _beastPos: SpatialAudioPos = { x: 0, y: 0, z: 0 };
const _reservedScratch: string[] = [];

function createSculptedGeometries() {
  const torsoPts = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.185, 0.03),
    new THREE.Vector2(0.178, 0.14),
    new THREE.Vector2(0.195, 0.27),
    new THREE.Vector2(0.245, 0.42),
    new THREE.Vector2(0.268, 0.54),
    new THREE.Vector2(0.22, 0.61),
    new THREE.Vector2(0.095, 0.65),
    new THREE.Vector2(0.01, 0.66),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 16);
  torsoGeo.computeVertexNormals();

  const thighPts = [
    new THREE.Vector2(0.01, 0.02),
    new THREE.Vector2(0.13, 0.0),
    new THREE.Vector2(0.145, -0.16),
    new THREE.Vector2(0.138, -0.34),
    new THREE.Vector2(0.105, -0.45),
    new THREE.Vector2(0.082, -0.49),
    new THREE.Vector2(0.01, -0.5),
  ];
  const thighGeo = new THREE.LatheGeometry(thighPts, 12);
  thighGeo.computeVertexNormals();

  const calfTrouserPts = [
    new THREE.Vector2(0.01, 0.02),
    new THREE.Vector2(0.088, 0.0),
    new THREE.Vector2(0.115, -0.09),
    new THREE.Vector2(0.096, -0.18),
    new THREE.Vector2(0.072, -0.22),
    new THREE.Vector2(0.01, -0.23),
  ];
  const calfTrouserGeo = new THREE.LatheGeometry(calfTrouserPts, 12);
  calfTrouserGeo.computeVertexNormals();

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.lineTo(0.09, 0.04);
  bladeShape.lineTo(0.09, 0.72);
  bladeShape.lineTo(0.055, 0.84);
  bladeShape.lineTo(-0.015, 0.8);
  bladeShape.lineTo(-0.032, 0.04);
  bladeShape.closePath();

  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  bladeGeo.center();
  bladeGeo.rotateX(Math.PI / 2);
  bladeGeo.rotateZ(Math.PI / 2);
  bladeGeo.computeVertexNormals();

  const uv = bladeGeo.attributes.uv;
  const pos = bladeGeo.attributes.position;
  if (uv && pos) {
    for (let i = 0; i < pos.count; i++) {
      const yVal = pos.getY(i);
      const zVal = pos.getZ(i);
      const u = THREE.MathUtils.clamp((0.06 - yVal) / 0.13, 0, 1);
      const v = THREE.MathUtils.clamp((zVal + 0.42) / 0.84, 0, 1);
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  }

  // Shared primitive geometries across all 4 Beasts (cuts duplicate GPU buffers by 4x!)
  const pelvisCyl = new THREE.CylinderGeometry(0.19, 0.21, 0.24, 14);
  const sashCyl = new THREE.CylinderGeometry(0.205, 0.21, 0.13, 14);
  const sashKnot = new THREE.SphereGeometry(0.062, 10, 8);
  const sashLeft = new THREE.BoxGeometry(0.058, 0.42, 0.028);
  const sashRight = new THREE.BoxGeometry(0.054, 0.38, 0.028);
  const beltUpper = new THREE.CylinderGeometry(0.215, 0.222, 0.085, 14);
  const beltLower = new THREE.CylinderGeometry(0.22, 0.225, 0.06, 14);
  const beltRing = new THREE.TorusGeometry(0.032, 0.008, 6, 12);
  const chainLink = new THREE.TorusGeometry(0.02, 0.006, 5, 8);
  const tassetCenter = new THREE.BoxGeometry(0.14, 0.34, 0.032);
  const tassetSide = new THREE.BoxGeometry(0.13, 0.3, 0.028);
  const shinGuard = new THREE.CylinderGeometry(0.088, 0.072, 0.34, 10);
  const shinPlate = new THREE.BoxGeometry(0.1, 0.32, 0.04);
  const shinStrapTop = new THREE.TorusGeometry(0.088, 0.012, 6, 12);
  const shinStrapBot = new THREE.TorusGeometry(0.076, 0.012, 6, 12);
  const bootUpper = new THREE.BoxGeometry(0.155, 0.14, 0.31);
  const bootSole = new THREE.BoxGeometry(0.165, 0.05, 0.325);
  const pecSphere = new THREE.SphereGeometry(0.115, 10, 8);
  const chestStrap = new THREE.CylinderGeometry(0.01, 0.01, 0.42, 6);
  const chestBadge = new THREE.BoxGeometry(0.13, 0.15, 0.04);
  const chestBadgeInner = new THREE.BoxGeometry(0.105, 0.12, 0.016);
  const robeFront = new THREE.BoxGeometry(0.21, 0.58, 0.16);
  const robeShoulder = new THREE.SphereGeometry(0.14, 10, 8);
  const robeBack = new THREE.BoxGeometry(0.28, 0.58, 0.12);
  const backStrap = new THREE.CylinderGeometry(0.01, 0.01, 0.46, 6);
  const robeTailA = new THREE.BoxGeometry(0.12, 0.66, 0.045);
  const robeTailB = new THREE.BoxGeometry(0.11, 0.6, 0.045);
  const shoulderSphereL = new THREE.SphereGeometry(0.105, 10, 8);
  const upperArmL = new THREE.CylinderGeometry(0.095, 0.082, 0.32, 10);
  const foreArmL = new THREE.CylinderGeometry(0.08, 0.068, 0.28, 10);
  const handL = new THREE.BoxGeometry(0.085, 0.11, 0.095);
  const shoulderSphereR = new THREE.SphereGeometry(0.108, 10, 8);
  const upperArmR = new THREE.CylinderGeometry(0.088, 0.072, 0.32, 10);
  const foreArmR = new THREE.CylinderGeometry(0.074, 0.056, 0.26, 10);
  const wristWrapR = new THREE.CylinderGeometry(0.058, 0.054, 0.11, 10);
  const handR = new THREE.BoxGeometry(0.082, 0.095, 0.095);
  const swordGrip = new THREE.CylinderGeometry(0.022, 0.024, 0.22, 8);
  const swordPommel = new THREE.TorusGeometry(0.034, 0.009, 6, 12);
  const swordGuard = new THREE.BoxGeometry(0.052, 0.14, 0.042);
  const neckCyl = new THREE.CylinderGeometry(0.072, 0.092, 0.16, 10);
  const headSphere = new THREE.SphereGeometry(0.148, 16, 14);
  const jawBox = new THREE.BoxGeometry(0.125, 0.082, 0.11);
  const browBox = new THREE.BoxGeometry(0.125, 0.03, 0.045);
  const hairTop = new THREE.SphereGeometry(0.145, 12, 10);
  const hairBack = new THREE.SphereGeometry(0.135, 10, 8);
  const ponyTie = new THREE.TorusGeometry(0.038, 0.012, 6, 10);
  const ponyMain = new THREE.ConeGeometry(0.056, 0.28, 8);
  const ponyTip = new THREE.ConeGeometry(0.038, 0.22, 8);

  const allDisposables: THREE.BufferGeometry[] = [
    torsoGeo,
    thighGeo,
    calfTrouserGeo,
    bladeGeo,
    pelvisCyl,
    sashCyl,
    sashKnot,
    sashLeft,
    sashRight,
    beltUpper,
    beltLower,
    beltRing,
    chainLink,
    tassetCenter,
    tassetSide,
    shinGuard,
    shinPlate,
    shinStrapTop,
    shinStrapBot,
    bootUpper,
    bootSole,
    pecSphere,
    chestStrap,
    chestBadge,
    chestBadgeInner,
    robeFront,
    robeShoulder,
    robeBack,
    backStrap,
    robeTailA,
    robeTailB,
    shoulderSphereL,
    upperArmL,
    foreArmL,
    handL,
    shoulderSphereR,
    upperArmR,
    foreArmR,
    wristWrapR,
    handR,
    swordGrip,
    swordPommel,
    swordGuard,
    neckCyl,
    headSphere,
    jawBox,
    browBox,
    hairTop,
    hairBack,
    ponyTie,
    ponyMain,
    ponyTip,
  ];

  return {
    torsoGeo,
    thighGeo,
    calfTrouserGeo,
    bladeGeo,
    pelvisCyl,
    sashCyl,
    sashKnot,
    sashLeft,
    sashRight,
    beltUpper,
    beltLower,
    beltRing,
    chainLink,
    tassetCenter,
    tassetSide,
    shinGuard,
    shinPlate,
    shinStrapTop,
    shinStrapBot,
    bootUpper,
    bootSole,
    pecSphere,
    chestStrap,
    chestBadge,
    chestBadgeInner,
    robeFront,
    robeShoulder,
    robeBack,
    backStrap,
    robeTailA,
    robeTailB,
    shoulderSphereL,
    upperArmL,
    foreArmL,
    handL,
    shoulderSphereR,
    upperArmR,
    foreArmR,
    wristWrapR,
    handR,
    swordGrip,
    swordPommel,
    swordGuard,
    neckCyl,
    headSphere,
    jawBox,
    browBox,
    hairTop,
    hairBack,
    ponyTie,
    ponyMain,
    ponyTip,
    dispose: () => {
      for (const g of allDisposables) g.dispose();
    },
  };
}

type WarriorMaterials = ReturnType<typeof createBeastWarriorMaterials>;
type SculptedGeos = ReturnType<typeof createSculptedGeometries>;

interface SingleBeastActorProps {
  roster: BeastRosterEntry;
  warriorMats: WarriorMaterials;
  sculptedGeos: SculptedGeos;
  brain: BeastBrainState;
  allBrainsRef: React.MutableRefObject<BeastBrainState[]>;
  resetCounter: number;
}

const CHAIN_LINKS = [0, 1, 2, 3, 4, 5] as const;

const SingleBeastActor: React.FC<SingleBeastActorProps> = React.memo(({
  roster,
  warriorMats,
  sculptedGeos,
  brain,
  allBrainsRef,
  resetCounter,
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const pelvisRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const ponytailRef = useRef<THREE.Group>(null);
  const robeTailRef = useRef<THREE.Group>(null);
  const sashLeftRef = useRef<THREE.Mesh>(null);
  const sashRightRef = useRef<THREE.Mesh>(null);
  const tassetLeftRef = useRef<THREE.Mesh>(null);
  const tassetCenterRef = useRef<THREE.Mesh>(null);
  const tassetRightRef = useRef<THREE.Mesh>(null);

  const leftHipRef = useRef<THREE.Group>(null);
  const leftKneeRef = useRef<THREE.Group>(null);
  const rightHipRef = useRef<THREE.Group>(null);
  const rightKneeRef = useRef<THREE.Group>(null);

  const leftShoulderRef = useRef<THREE.Group>(null);
  const leftElbowRef = useRef<THREE.Group>(null);
  const rightShoulderRef = useRef<THREE.Group>(null);
  const rightElbowRef = useRef<THREE.Group>(null);
  const rightHandRef = useRef<THREE.Group>(null);

  const animRef = useRef({
    idleClock: roster.id * 1.37,
    lastStepHalfCycle: 0,
    chasePulseAccum: roster.id * 0.25,
    breathAccum: 1.5 + roster.id * 0.7,
    growlAccum: 2.8 + roster.id * 1.2,
    chaseCryAccum: 2.0 + roster.id * 0.8,
    swordSwishAccum: 1.4 + roster.id * 0.5,
    captureAnimClock: 0,
    attackSwishPlayed: false,
    attackImpactPlayed: false,
    torsoLean: 0,
    headYaw: 0,
    headPitch: 0,
    prevYaw: roster.initialYaw,
    turnLeanRoll: 0,
    locoBlend: 0,
    runBlend: 0,
    lodFrameParity: roster.id & 1,
  });

  useEffect(() => {
    const fresh = allBrainsRef.current[roster.id] ?? brain;
    const anim = animRef.current;
    anim.lastStepHalfCycle = Math.floor(fresh.walkPhase / Math.PI);
    anim.chasePulseAccum = roster.id * 0.25;
    anim.breathAccum = 1.5 + roster.id * 0.7;
    anim.growlAccum = 2.8 + roster.id * 1.2;
    anim.chaseCryAccum = 2.0 + roster.id * 0.8;
    anim.swordSwishAccum = 1.4 + roster.id * 0.5;
    anim.captureAnimClock = 0;
    anim.attackSwishPlayed = false;
    anim.attackImpactPlayed = false;
    anim.prevYaw = fresh.yaw;
    anim.locoBlend = 0;
    anim.runBlend = 0;

    if (rootRef.current) {
      rootRef.current.position.set(fresh.x, fresh.feetY, fresh.z);
      rootRef.current.rotation.y = fresh.yaw;
    }
  }, [resetCounter, brain, roster.id, allBrainsRef]);

  useFrame((_, rawDelta) => {
    const store = useGameStore.getState();
    const st = allBrainsRef.current[roster.id];
    if (!st) return;

    const anim = animRef.current;
    const delta = Math.min(rawDelta, 0.05);

    const paused =
      store.inMainMenu ||
      store.gamePaused ||
      store.escapeAnimating ||
      store.escaped ||
      store.progression === 'PLAYER_CAUGHT';

    let dist3D = Math.hypot(
      playerWorldPos.x - st.x,
      playerWorldPos.feetY - st.feetY,
      playerWorldPos.z - st.z
    );

    if (!paused) {
      const profile = getBeastDifficultyProfile(
        store.progression,
        store.missionCompleted,
        store.allPuzzlesCompleted,
        store.puzzleRoomEntered,
        store.keyPickupAlarmTriggered
      );

      // Zero-GC sibling patrol node reservation list
      _reservedScratch.length = 0;
      const allBrains = allBrainsRef.current;
      for (let i = 0; i < allBrains.length; i++) {
        const other = allBrains[i];
        if (other.id !== roster.id && other.assignedTargetNodeId) {
          _reservedScratch.push(other.assignedTargetNodeId);
        }
      }

      const witnessedByMe =
        store.playerHiddenSpotId && store.playerHiddenWitnessedBy.includes(roster.id)
          ? store.playerHiddenSpotId
          : null;

      const events = stepBeastBrain({
        state: st,
        delta,
        playerX: playerWorldPos.x,
        playerFeetY: playerWorldPos.feetY,
        playerZ: playerWorldPos.z,
        controlMode: store.controlMode,
        doorStates: store.doorStates,
        keyAlarmTriggered: store.keyPickupAlarmTriggered,
        beastAlerted: store.beastAlerted,
        puzzleRoomProtected: store.puzzleProtectionActive,
        puzzleTimerExpired: store.puzzleTimerExpired,
        playerHidden: store.playerHiddenSpotId !== null,
        playerHiddenSpotId: store.playerHiddenSpotId,
        witnessedHidingSpotId: witnessedByMe,
        otherBeasts: beastWorldPositions,
        reservedPatrolNodeIds: _reservedScratch,
        profile,
      });

      _beastPos.x = st.x;
      _beastPos.y = st.feetY;
      _beastPos.z = st.z;

      dist3D = Math.hypot(
        playerWorldPos.x - st.x,
        playerWorldPos.feetY - st.feetY,
        playerWorldPos.z - st.z
      );

      for (let i = 0; i < events.length; i++) {
        const evt = events[i];
        if (evt === 'alarm-reaction') {
          playBeastAlarmReactionSound(_beastPos, roster.id, store.audioEnabled);
        } else if (evt === 'detect-warning') {
          playBeastDetectSound(store.audioEnabled, _beastPos, roster.id, roster.voicePitch);
        } else if (evt === 'chase-started') {
          playBeastBattleCrySound(_beastPos, true, store.audioEnabled, roster.id, roster.voicePitch);
          playBeastChasePulseSound(dist3D, store.audioEnabled, _beastPos);
          anim.chasePulseAccum = 0;
          anim.chaseCryAccum = 0;
          anim.swordSwishAccum = 0.6;
        } else if (evt === 'servo-scan') {
          playBeastServoSound(dist3D, store.audioEnabled, _beastPos);
        } else if (evt === 'barrier-strike') {
          barrierFeedbackState.lastImpactMs = performance.now();
          playBeastSwordSwishSound(_beastPos, true, store.audioEnabled);
          playBarrierStrikeSound(_beastPos, store.audioEnabled);
        } else if (evt === 'siege-shout') {
          playBeastGrowlSound(_beastPos, store.audioEnabled, roster.id, roster.voicePitch);
        } else if (evt === 'capture-started') {
          anim.captureAnimClock = 0;
          anim.attackSwishPlayed = false;
          anim.attackImpactPlayed = false;
          beastWorldPos.capturingBeastId = roster.id;
          beastWorldPos.x = st.x;
          beastWorldPos.feetY = st.feetY;
          beastWorldPos.z = st.z;
          beastWorldPos.yaw = st.yaw;
          playBeastBattleCrySound(_beastPos, false, store.audioEnabled, roster.id, roster.voicePitch);
          store.beginBeastCapture();
        } else if (evt === 'capture-completed') {
          beastWorldPos.capturingBeastId = null;
          store.completeBeastCapture();
        }
      }

      // Sync this Beast's entry into shared zero-GC array
      const sharedEntry = beastWorldPositions[roster.id];
      if (sharedEntry) {
        sharedEntry.x = st.x;
        sharedEntry.feetY = st.feetY;
        sharedEntry.z = st.z;
        sharedEntry.yaw = st.yaw;
        sharedEntry.mode = st.mode;
      }

      // Locomotion footsteps synced to distance-coupled walkPhase half-cycles
      if (st.isMoving) {
        const halfCycle = Math.floor(st.walkPhase / Math.PI);
        if (halfCycle !== anim.lastStepHalfCycle) {
          anim.lastStepHalfCycle = halfCycle;
          playBeastFootstepSound(
            dist3D,
            st.mode === 'chase',
            store.audioEnabled,
            _beastPos,
            roster.id,
            roster.voicePitch
          );
        }
      }

      // Deep warrior breathing when idle or stalking close
      if (st.mode !== 'capture' && dist3D < 15.5) {
        anim.breathAccum += delta;
        const breathInterval = st.mode === 'investigate' || st.mode === 'search' ? 2.8 : 4.2;
        if (anim.breathAccum >= breathInterval) {
          anim.breathAccum = 0;
          playBeastBreathingSound(
            _beastPos,
            st.mode === 'investigate' || st.mode === 'search' || st.mode === 'detect',
            store.audioEnabled
          );
        }
      }

      // Occasional low guttural growls during patrol / investigate / search
      if (
        (st.mode === 'patrol' || st.mode === 'investigate' || st.mode === 'search') &&
        dist3D < 25
      ) {
        anim.growlAccum += delta;
        const growlPeriod = st.mode === 'patrol' ? 9.2 : 5.8;
        if (anim.growlAccum >= growlPeriod) {
          anim.growlAccum = Math.random() * 1.6;
          playBeastGrowlSound(_beastPos, store.audioEnabled, roster.id, roster.voicePitch);
        }
      }

      // Active Chase battle cries, sword movement swishes & heartbeat
      if (st.mode === 'chase') {
        anim.chasePulseAccum += delta;
        if (anim.chasePulseAccum >= 1.15) {
          anim.chasePulseAccum = 0;
          playBeastChasePulseSound(dist3D, store.audioEnabled, _beastPos);
        }

        anim.chaseCryAccum += delta;
        if (anim.chaseCryAccum >= 4.6) {
          anim.chaseCryAccum = Math.random() * 1.1;
          playBeastBattleCrySound(_beastPos, false, store.audioEnabled, roster.id, roster.voicePitch);
        }

        anim.swordSwishAccum += delta;
        if (anim.swordSwishAccum >= 2.8 && dist3D < 22) {
          anim.swordSwishAccum = Math.random() * 0.7;
          playBeastSwordSwishSound(_beastPos, false, store.audioEnabled);
        }
      }

      anim.idleClock += delta;
      if (st.mode === 'capture') {
        anim.captureAnimClock += delta;
        if (!anim.attackSwishPlayed && anim.captureAnimClock >= 0.31) {
          anim.attackSwishPlayed = true;
          playBeastSwordSwishSound(_beastPos, true, store.audioEnabled);
        }
        if (!anim.attackImpactPlayed && anim.captureAnimClock >= 0.44) {
          anim.attackImpactPlayed = true;
          playBeastCaptureSound(store.audioEnabled, _beastPos);
        }
      }
    }

    // ALWAYS update 3D root transform at full frame rate
    if (rootRef.current) {
      rootRef.current.position.set(st.x, st.feetY, st.z);
      rootRef.current.rotation.y = st.yaw;
    }

    const isCapture = st.mode === 'capture';
    const isBarrierStrike = !isCapture && st.barrierStrikeAnimClock > 0;

    // Gentle animation LOD for far-away Beasts on a different floor (keeps root smooth at 60Hz, halves far joint cost)
    const farOffFloor =
      !isCapture &&
      !isBarrierStrike &&
      Math.abs(st.feetY - playerWorldPos.feetY) > 2.8 &&
      dist3D > 24 &&
      store.controlMode !== 'orbit';
    anim.lodFrameParity ^= 1;
    if (farOffFloor && anim.lodFrameParity === 1) {
      return;
    }
    const animDt = farOffFloor ? Math.min(delta * 2, 0.08) : delta;

    let yawVel = st.yaw - anim.prevYaw;
    while (yawVel > Math.PI) yawVel -= Math.PI * 2;
    while (yawVel < -Math.PI) yawVel += Math.PI * 2;
    anim.prevYaw = st.yaw;
    const rawTurnRate = animDt > 0.001 ? THREE.MathUtils.clamp(yawVel / animDt, -6, 6) : 0;
    anim.turnLeanRoll = THREE.MathUtils.damp(
      anim.turnLeanRoll,
      -rawTurnRate * 0.042,
      9,
      animDt
    );

    // Smooth continuous locomotion & run blending (eliminates binary walk/run/idle pose snaps!)
    const targetLocoBlend = THREE.MathUtils.clamp(st.currentSpeed / 1.35, 0, 1);
    const targetRunBlend =
      st.mode === 'chase'
        ? THREE.MathUtils.smoothstep(st.currentSpeed, 2.2, 4.6)
        : 0;
    anim.locoBlend = THREE.MathUtils.damp(anim.locoBlend, targetLocoBlend, 11, animDt);
    anim.runBlend = THREE.MathUtils.damp(anim.runBlend, targetRunBlend, 9, animDt);

    const isSearching =
      st.mode === 'search' || (st.mode === 'patrol' && !st.isMoving && st.patrolPauseTimer > 0.35);

    const dampLambda = isCapture || isBarrierStrike ? 20 : 13;

    // Base idle/search/detect pose
    const breath = Math.sin(anim.idleClock * 2.0);
    let targetPelvisY = 1.08 + breath * 0.016;
    let targetTorsoLean = 0.05 + breath * 0.02;
    let targetTorsoYaw = 0;
    let targetHeadYaw = Math.sin(anim.idleClock * 0.85) * 0.2;
    let targetHeadPitch = 0;

    let lHipX = 0;
    let lKneeX = 0.08;
    let rHipX = 0;
    let rKneeX = 0.08;

    let lShoulderX = 0.04 + breath * 0.04;
    let lShoulderZ = -0.11;
    let lElbowX = -0.32;

    let rShoulderX = 0.04 - breath * 0.03;
    let rShoulderZ = 0.17;
    let rElbowX = -0.36;
    let rHandX = 0.05;
    let rHandZ = 0.08;

    if (isCapture) {
      const c = anim.captureAnimClock;
      if (c < 0.3) {
        const w = THREE.MathUtils.smoothstep(c / 0.3, 0, 1);
        targetPelvisY = 1.08 - 0.04 * w;
        targetTorsoLean = THREE.MathUtils.lerp(0.15, -0.1, w);
        targetTorsoYaw = -0.42 * w;
        targetHeadPitch = -0.06;
        rShoulderX = THREE.MathUtils.lerp(-0.55, -2.35, w);
        rShoulderZ = THREE.MathUtils.lerp(0.22, 0.42, w);
        rElbowX = THREE.MathUtils.lerp(-0.9, -0.45, w);
        rHandX = 0.25 * w;
        rHandZ = 0.18 * w;
        lShoulderX = -0.55 * w;
        lShoulderZ = -0.25;
        lElbowX = -0.95;
        lHipX = -0.2 * w;
        lKneeX = 0.32 * w;
        rHipX = 0.18 * w;
        rKneeX = 0.22 * w;
      } else if (c < 0.62) {
        const s = THREE.MathUtils.smoothstep((c - 0.3) / 0.32, 0, 1);
        targetPelvisY = 1.04 - 0.08 * s;
        targetTorsoLean = THREE.MathUtils.lerp(-0.1, 0.48, s);
        targetTorsoYaw = THREE.MathUtils.lerp(-0.42, 0.48, s);
        targetHeadPitch = -0.16;
        rShoulderX = THREE.MathUtils.lerp(-2.35, 0.26, s);
        rShoulderZ = THREE.MathUtils.lerp(0.42, -0.26, s);
        rElbowX = THREE.MathUtils.lerp(-0.45, -0.2, s);
        rHandX = THREE.MathUtils.lerp(0.25, -0.35, s);
        rHandZ = THREE.MathUtils.lerp(0.18, -0.15, s);
        lShoulderX = THREE.MathUtils.lerp(-0.55, -1.05, s);
        lShoulderZ = -0.18;
        lElbowX = -0.65;
        lHipX = -0.34 * s;
        lKneeX = 0.56 * s;
        rHipX = 0.3 * s;
        rKneeX = 0.24 * s;
      } else {
        targetPelvisY = 0.96;
        targetTorsoLean = 0.46;
        targetTorsoYaw = 0.38;
        targetHeadPitch = -0.18;
        rShoulderX = 0.18;
        rShoulderZ = -0.18;
        rElbowX = -0.28;
        rHandX = -0.28;
        lShoulderX = -1.15;
        lShoulderZ = -0.15;
        lElbowX = -0.58;
        lHipX = -0.34;
        lKneeX = 0.56;
        rHipX = 0.3;
        rKneeX = 0.24;
      }
    } else if (isBarrierStrike) {
      const progress = 1 - st.barrierStrikeAnimClock / 0.72;
      const swing = Math.sin(progress * Math.PI);
      targetPelvisY = 1.04 - swing * 0.06;
      targetTorsoLean = 0.12 + swing * 0.32;
      targetTorsoYaw = progress < 0.42 ? -0.38 : 0.42;
      rShoulderX = progress < 0.42 ? -2.05 : 0.18;
      rShoulderZ = progress < 0.42 ? 0.36 : -0.22;
      rElbowX = -0.38;
      rHandX = progress < 0.42 ? 0.22 : -0.3;
      lShoulderX = -0.65;
      lShoulderZ = -0.24;
      lElbowX = -0.82;
    } else if (st.mode === 'detect') {
      targetPelvisY = 1.04;
      targetTorsoLean = 0.18;
      targetHeadPitch = -0.08;
      lShoulderX = -0.42;
      lShoulderZ = -0.24;
      lElbowX = -0.82;
      rShoulderX = -0.68;
      rShoulderZ = 0.26;
      rElbowX = -0.96;
      rHandX = 0.18;
      rHandZ = 0.12;
    } else {
      // Stationary search sweep blends cleanly under locomotion weight
      if (isSearching && anim.locoBlend < 0.95) {
        const sweep = Math.sin(anim.idleClock * 1.85);
        targetPelvisY = 1.06 + Math.sin(anim.idleClock * 2.1) * 0.02;
        targetTorsoLean = 0.14;
        targetTorsoYaw = sweep * 0.26;
        targetHeadYaw = sweep * 0.52;
        targetHeadPitch = Math.sin(anim.idleClock * 3.1) * 0.07;
        lShoulderX = -0.24 + sweep * 0.1;
        lShoulderZ = -0.18;
        lElbowX = -0.62;
        rShoulderX = -0.32 - sweep * 0.08;
        rShoulderZ = 0.22;
        rElbowX = -0.72;
        rHandX = 0.14;
      }

      // Smooth continuous blend between idle/search <-> walk/stalk <-> sprint chase
      const lw = anim.locoBlend;
      if (lw > 0.005) {
        const rw = anim.runBlend;
        const s = Math.sin(st.walkPhase);
        const c = Math.cos(st.walkPhase);

        const strideAmp = THREE.MathUtils.lerp(0.46, 0.72, rw);
        const bounceAmp = THREE.MathUtils.lerp(0.04, 0.075, rw);
        const walkLean = st.mode === 'investigate' ? 0.17 : 0.08;
        const locoPelvisY = 1.08 + Math.abs(c) * bounceAmp;
        const locoTorsoLean = THREE.MathUtils.lerp(walkLean, 0.32, rw);
        const locoTorsoYaw = s * THREE.MathUtils.lerp(0.08, 0.15, rw);

        const kneeAmp = THREE.MathUtils.lerp(0.54, 0.8, rw);
        const locoLHipX = s * strideAmp;
        const locoRHipX = -s * strideAmp;
        const locoLKneeX = Math.max(0.06, -c * kneeAmp + 0.2);
        const locoRKneeX = Math.max(0.06, c * kneeAmp + 0.2);

        const locoLShoulderX = -s * THREE.MathUtils.lerp(0.44, 0.78, rw);
        const locoLShoulderZ = THREE.MathUtils.lerp(-0.12, -0.2, rw);
        const locoLElbowX = THREE.MathUtils.lerp(-0.42, -1.05, rw);

        // Smooth sword-arm blend from walk carry -> aggressive chase poise
        const walkRShoulderX = 0.08 + s * 0.22;
        const runRShoulderX = -0.44 + s * 0.24;
        const locoRShoulderX = THREE.MathUtils.lerp(walkRShoulderX, runRShoulderX, rw);
        const locoRShoulderZ = THREE.MathUtils.lerp(0.19, 0.26, rw);
        const locoRElbowX = THREE.MathUtils.lerp(
          -0.48 - Math.max(0, s) * 0.14,
          -0.92 + c * 0.12,
          rw
        );
        const locoRHandX = THREE.MathUtils.lerp(0.08, 0.18, rw);
        const locoRHandZ = THREE.MathUtils.lerp(0.1, 0.12, rw);

        const locoHeadYaw = st.isTurning
          ? THREE.MathUtils.clamp(-rawTurnRate * 0.22, -0.45, 0.45)
          : st.mode === 'investigate'
            ? Math.sin(anim.idleClock * 2.6) * 0.28
            : Math.sin(st.walkPhase * 0.5) * 0.1;
        const locoHeadPitch = THREE.MathUtils.lerp(0.02, -0.18, rw);

        targetPelvisY = THREE.MathUtils.lerp(targetPelvisY, locoPelvisY, lw);
        targetTorsoLean = THREE.MathUtils.lerp(targetTorsoLean, locoTorsoLean, lw);
        targetTorsoYaw = THREE.MathUtils.lerp(targetTorsoYaw, locoTorsoYaw, lw);
        targetHeadYaw = THREE.MathUtils.lerp(targetHeadYaw, locoHeadYaw, lw);
        targetHeadPitch = THREE.MathUtils.lerp(targetHeadPitch, locoHeadPitch, lw);

        lHipX = THREE.MathUtils.lerp(lHipX, locoLHipX, lw);
        rHipX = THREE.MathUtils.lerp(rHipX, locoRHipX, lw);
        lKneeX = THREE.MathUtils.lerp(lKneeX, locoLKneeX, lw);
        rKneeX = THREE.MathUtils.lerp(rKneeX, locoRKneeX, lw);

        lShoulderX = THREE.MathUtils.lerp(lShoulderX, locoLShoulderX, lw);
        lShoulderZ = THREE.MathUtils.lerp(lShoulderZ, locoLShoulderZ, lw);
        lElbowX = THREE.MathUtils.lerp(lElbowX, locoLElbowX, lw);

        rShoulderX = THREE.MathUtils.lerp(rShoulderX, locoRShoulderX, lw);
        rShoulderZ = THREE.MathUtils.lerp(rShoulderZ, locoRShoulderZ, lw);
        rElbowX = THREE.MathUtils.lerp(rElbowX, locoRElbowX, lw);
        rHandX = THREE.MathUtils.lerp(rHandX, locoRHandX, lw);
        rHandZ = THREE.MathUtils.lerp(rHandZ, locoRHandZ, lw);
      }
    }

    // Apply true frame-rate independent THREE.MathUtils.damp to every articulated joint
    anim.torsoLean = THREE.MathUtils.damp(anim.torsoLean, targetTorsoLean, dampLambda, animDt);
    anim.headYaw = THREE.MathUtils.damp(anim.headYaw, targetHeadYaw, dampLambda, animDt);
    anim.headPitch = THREE.MathUtils.damp(anim.headPitch, targetHeadPitch, dampLambda, animDt);

    if (pelvisRef.current) {
      pelvisRef.current.position.y = THREE.MathUtils.damp(
        pelvisRef.current.position.y,
        targetPelvisY,
        dampLambda,
        animDt
      );
      pelvisRef.current.rotation.z = anim.turnLeanRoll;
    }
    if (torsoRef.current) {
      torsoRef.current.rotation.x = anim.torsoLean;
      torsoRef.current.rotation.y = THREE.MathUtils.damp(
        torsoRef.current.rotation.y,
        targetTorsoYaw,
        dampLambda,
        animDt
      );
    }
    if (headRef.current) {
      headRef.current.rotation.y = anim.headYaw;
      headRef.current.rotation.x = anim.headPitch;
    }

    if (leftHipRef.current) leftHipRef.current.rotation.x = THREE.MathUtils.damp(leftHipRef.current.rotation.x, lHipX, dampLambda, animDt);
    if (leftKneeRef.current) leftKneeRef.current.rotation.x = THREE.MathUtils.damp(leftKneeRef.current.rotation.x, lKneeX, dampLambda, animDt);
    if (rightHipRef.current) rightHipRef.current.rotation.x = THREE.MathUtils.damp(rightHipRef.current.rotation.x, rHipX, dampLambda, animDt);
    if (rightKneeRef.current) rightKneeRef.current.rotation.x = THREE.MathUtils.damp(rightKneeRef.current.rotation.x, rKneeX, dampLambda, animDt);

    if (leftShoulderRef.current) {
      leftShoulderRef.current.rotation.x = THREE.MathUtils.damp(leftShoulderRef.current.rotation.x, lShoulderX, dampLambda, animDt);
      leftShoulderRef.current.rotation.z = THREE.MathUtils.damp(leftShoulderRef.current.rotation.z, lShoulderZ, dampLambda, animDt);
    }
    if (leftElbowRef.current) leftElbowRef.current.rotation.x = THREE.MathUtils.damp(leftElbowRef.current.rotation.x, lElbowX, dampLambda, animDt);

    if (rightShoulderRef.current) {
      rightShoulderRef.current.rotation.x = THREE.MathUtils.damp(rightShoulderRef.current.rotation.x, rShoulderX, dampLambda, animDt);
      rightShoulderRef.current.rotation.z = THREE.MathUtils.damp(rightShoulderRef.current.rotation.z, rShoulderZ, dampLambda, animDt);
    }
    if (rightElbowRef.current) rightElbowRef.current.rotation.x = THREE.MathUtils.damp(rightElbowRef.current.rotation.x, rElbowX, dampLambda, animDt);
    if (rightHandRef.current) {
      rightHandRef.current.rotation.x = THREE.MathUtils.damp(rightHandRef.current.rotation.x, rHandX, dampLambda, animDt);
      rightHandRef.current.rotation.z = THREE.MathUtils.damp(rightHandRef.current.rotation.z, rHandZ, dampLambda, animDt);
    }

    // Smoothly damped secondary cloth, leather tassets & ponytail motion
    const speedFactor = THREE.MathUtils.lerp(0.08, THREE.MathUtils.lerp(0.45, 1.0, anim.runBlend), anim.locoBlend);
    const flapKickLeft = leftHipRef.current ? Math.max(0, -leftHipRef.current.rotation.x) : 0;
    const flapKickRight = rightHipRef.current ? Math.max(0, -rightHipRef.current.rotation.x) : 0;
    const flapMax = Math.max(flapKickLeft, flapKickRight);

    if (tassetLeftRef.current) {
      tassetLeftRef.current.rotation.x = THREE.MathUtils.damp(
        tassetLeftRef.current.rotation.x,
        -0.08 - flapKickLeft * 0.72,
        12,
        animDt
      );
    }
    if (tassetRightRef.current) {
      tassetRightRef.current.rotation.x = THREE.MathUtils.damp(
        tassetRightRef.current.rotation.x,
        -0.08 - flapKickRight * 0.72,
        12,
        animDt
      );
    }
    if (tassetCenterRef.current) {
      tassetCenterRef.current.rotation.x = THREE.MathUtils.damp(
        tassetCenterRef.current.rotation.x,
        -0.06 - flapMax * 0.52,
        12,
        animDt
      );
    }
    if (sashLeftRef.current) {
      sashLeftRef.current.rotation.x = THREE.MathUtils.damp(
        sashLeftRef.current.rotation.x,
        -0.05 - flapMax * 0.5 + Math.sin(anim.idleClock * 5) * 0.04 * speedFactor,
        11,
        animDt
      );
      sashLeftRef.current.rotation.z = THREE.MathUtils.damp(
        sashLeftRef.current.rotation.z,
        0.06 + Math.cos(anim.idleClock * 4.5) * 0.04 * speedFactor,
        11,
        animDt
      );
    }
    if (sashRightRef.current) {
      sashRightRef.current.rotation.x = THREE.MathUtils.damp(
        sashRightRef.current.rotation.x,
        -0.05 - flapMax * 0.45 - Math.sin(anim.idleClock * 5) * 0.04 * speedFactor,
        11,
        animDt
      );
      sashRightRef.current.rotation.z = THREE.MathUtils.damp(
        sashRightRef.current.rotation.z,
        -0.06 - Math.cos(anim.idleClock * 4.5) * 0.04 * speedFactor,
        11,
        animDt
      );
    }
    if (robeTailRef.current) {
      robeTailRef.current.rotation.x = THREE.MathUtils.damp(
        robeTailRef.current.rotation.x,
        0.1 + speedFactor * 0.28 + Math.sin(st.walkPhase) * 0.08 * speedFactor,
        10,
        animDt
      );
    }
    if (ponytailRef.current) {
      ponytailRef.current.rotation.x = THREE.MathUtils.damp(
        ponytailRef.current.rotation.x,
        0.14 + speedFactor * 0.35 + Math.abs(Math.sin(st.walkPhase)) * 0.12 * speedFactor,
        10,
        animDt
      );
      ponytailRef.current.rotation.y = THREE.MathUtils.damp(
        ponytailRef.current.rotation.y,
        THREE.MathUtils.clamp(-rawTurnRate * 0.18, -0.4, 0.4),
        10,
        animDt
      );
    }
  });

  const g = sculptedGeos;

  return (
    <group
      ref={rootRef}
      position={[roster.spawnPos[0], FLOOR_ELEVATIONS[roster.initialFloor], roster.spawnPos[1]]}
      rotation={[0, roster.initialYaw, 0]}
    >
      <group ref={pelvisRef} position={[0, 1.08, 0]}>
        <mesh geometry={g.pelvisCyl} scale={[1.15, 1.0, 0.85]} material={warriorMats.trousersMat} castShadow />

        <mesh geometry={g.sashCyl} position={[0, 0.075, 0]} scale={[1.18, 1.0, 0.88]} rotation={[0.04, 0, -0.03]} material={warriorMats.sashMat} />
        <mesh geometry={g.sashKnot} position={[0.02, 0.04, 0.205]} rotation={[0.2, 0, 0.1]} material={warriorMats.sashMat} />
        <mesh
          ref={sashLeftRef}
          geometry={g.sashLeft}
          position={[0.055, -0.18, 0.21]}
          rotation={[-0.06, 0, 0.08]}
          material={warriorMats.sashMat}
        />
        <mesh
          ref={sashRightRef}
          geometry={g.sashRight}
          position={[-0.025, -0.17, 0.215]}
          rotation={[-0.06, 0, -0.07]}
          material={warriorMats.sashMat}
        />

        <mesh geometry={g.beltUpper} position={[0, -0.01, 0]} scale={[1.19, 1.0, 0.9]} rotation={[-0.05, 0, 0.04]} material={warriorMats.leatherMat} />
        <mesh geometry={g.beltLower} position={[0, -0.065, 0]} scale={[1.21, 1.0, 0.92]} rotation={[0.06, 0, -0.04]} material={warriorMats.leatherMat} />
        <mesh geometry={g.beltRing} position={[-0.14, -0.02, 0.195]} rotation={[0, -0.45, 0]} material={warriorMats.metalMat} />
        <mesh geometry={g.beltRing} position={[0.14, -0.02, 0.195]} rotation={[0, 0.45, 0]} material={warriorMats.metalMat} />

        <group position={[-0.23, -0.04, 0.04]}>
          {CHAIN_LINKS.map((idx) => (
            <mesh
              key={idx}
              geometry={g.chainLink}
              position={[
                -0.015 - Math.sin((idx / 5) * Math.PI) * 0.03,
                -idx * 0.042,
                0.08 - idx * 0.032,
              ]}
              rotation={[idx % 2 === 0 ? 0.3 : -0.3, idx * 0.5, 0.2]}
              material={warriorMats.metalMat}
            />
          ))}
        </group>

        <mesh ref={tassetCenterRef} geometry={g.tassetCenter} position={[0, -0.22, 0.195]} material={warriorMats.sashMat} />
        <mesh ref={tassetLeftRef} geometry={g.tassetSide} position={[0.14, -0.2, 0.165]} rotation={[0, 0.28, 0]} material={warriorMats.leatherMat} />
        <mesh ref={tassetRightRef} geometry={g.tassetSide} position={[-0.14, -0.2, 0.165]} rotation={[0, -0.28, 0]} material={warriorMats.leatherMat} />

        {/* LEFT ARTICULATED LEG (+X) */}
        <group ref={leftHipRef} position={[0.155, -0.02, 0]}>
          <mesh geometry={g.thighGeo} scale={[1.04, 1.0, 1.12]} material={warriorMats.trousersMat} castShadow />
          <group ref={leftKneeRef} position={[0, -0.48, 0]}>
            <mesh geometry={g.calfTrouserGeo} material={warriorMats.trousersMat} castShadow />
            <mesh geometry={g.shinGuard} position={[0, -0.29, 0.02]} material={warriorMats.leatherMat} castShadow />
            <mesh geometry={g.shinPlate} position={[0, -0.28, 0.085]} material={warriorMats.leatherMat} />
            <mesh geometry={g.shinStrapTop} position={[0, -0.2, 0.02]} material={warriorMats.leatherMat} />
            <mesh geometry={g.shinStrapBot} position={[0, -0.36, 0.02]} material={warriorMats.leatherMat} />
            <mesh geometry={g.bootUpper} position={[0, -0.51, 0.05]} material={warriorMats.leatherMat} castShadow />
            <mesh geometry={g.bootSole} position={[0, -0.555, 0.06]} material={warriorMats.trousersMat} />
          </group>
        </group>

        {/* RIGHT ARTICULATED LEG (-X) */}
        <group ref={rightHipRef} position={[-0.155, -0.02, 0]}>
          <mesh geometry={g.thighGeo} scale={[1.04, 1.0, 1.12]} material={warriorMats.trousersMat} castShadow />
          <group ref={rightKneeRef} position={[0, -0.48, 0]}>
            <mesh geometry={g.calfTrouserGeo} material={warriorMats.trousersMat} castShadow />
            <mesh geometry={g.shinGuard} position={[0, -0.29, 0.02]} material={warriorMats.leatherMat} castShadow />
            <mesh geometry={g.shinPlate} position={[0, -0.28, 0.085]} material={warriorMats.leatherMat} />
            <mesh geometry={g.shinStrapTop} position={[0, -0.2, 0.02]} material={warriorMats.leatherMat} />
            <mesh geometry={g.shinStrapBot} position={[0, -0.36, 0.02]} material={warriorMats.leatherMat} />
            <mesh geometry={g.bootUpper} position={[0, -0.51, 0.05]} material={warriorMats.leatherMat} castShadow />
            <mesh geometry={g.bootSole} position={[0, -0.555, 0.06]} material={warriorMats.trousersMat} />
          </group>
        </group>

        {/* UPPER MUSCULAR TORSO & ASYMMETRIC MAROON ROBE */}
        <group ref={torsoRef} position={[0, 0.08, 0]}>
          <mesh
            geometry={g.torsoGeo}
            scale={[0.84, 1.0, 1.12]}
            rotation={[0, Math.PI / 2, 0]}
            material={warriorMats.torsoMat}
            castShadow
          />
          <mesh geometry={g.pecSphere} position={[-0.125, 0.45, 0.14]} scale={[1.1, 0.72, 0.68]} material={warriorMats.skinMat} />
          <mesh geometry={g.pecSphere} position={[0.125, 0.45, 0.14]} scale={[1.1, 0.72, 0.68]} material={warriorMats.skinMat} />
          <mesh geometry={g.chestStrap} position={[-0.04, 0.48, 0.185]} rotation={[0.12, 0.1, 0.28]} material={warriorMats.leatherMat} />
          <mesh geometry={g.chestBadge} position={[0.135, 0.48, 0.175]} rotation={[-0.18, 0.25, -0.1]} material={warriorMats.leatherMat} />
          <mesh geometry={g.chestBadgeInner} position={[0.135, 0.48, 0.198]} rotation={[-0.18, 0.25, -0.1]} material={warriorMats.sashMat} />

          {/* Asymmetric Dark Maroon Robe */}
          <mesh geometry={g.robeFront} position={[0.205, 0.34, 0.095]} rotation={[-0.05, 0.32, 0.08]} material={warriorMats.robeDoubleMat} castShadow />
          <mesh geometry={g.robeShoulder} position={[0.24, 0.56, 0.0]} rotation={[0, 0, -0.22]} scale={[1.1, 0.85, 1.35]} material={warriorMats.robeMat} castShadow />
          <mesh geometry={g.robeBack} position={[0.15, 0.33, -0.14]} rotation={[0.08, -0.22, -0.05]} material={warriorMats.robeDoubleMat} castShadow />
          <mesh geometry={g.backStrap} position={[0.02, 0.36, -0.185]} rotation={[0, 0, Math.PI / 2]} material={warriorMats.leatherMat} />
          <group ref={robeTailRef} position={[0.12, 0.34, -0.21]}>
            <mesh geometry={g.robeTailA} position={[-0.05, -0.34, 0]} rotation={[0.06, 0, 0.05]} material={warriorMats.robeDoubleMat} castShadow />
            <mesh geometry={g.robeTailB} position={[0.06, -0.32, 0.01]} rotation={[0.08, -0.12, -0.04]} material={warriorMats.robeDoubleMat} />
          </group>

          {/* LEFT ARM (+X) */}
          <group ref={leftShoulderRef} position={[0.33, 0.54, 0.01]}>
            <mesh geometry={g.shoulderSphereL} material={warriorMats.robeMat} castShadow />
            <mesh geometry={g.upperArmL} position={[0.02, -0.16, 0]} material={warriorMats.robeMat} castShadow />
            <group ref={leftElbowRef} position={[0.02, -0.31, 0]}>
              <mesh geometry={g.foreArmL} position={[0, -0.14, 0.01]} material={warriorMats.robeMat} castShadow />
              <mesh geometry={g.handL} position={[0, -0.31, 0.02]} material={warriorMats.skinMat} />
            </group>
          </group>

          {/* RIGHT ARM (-X) + RIGIDLY HELD BROADSWORD */}
          <group ref={rightShoulderRef} position={[-0.33, 0.54, 0.01]}>
            <mesh geometry={g.shoulderSphereR} scale={[1.05, 1.0, 1.05]} material={warriorMats.skinMat} castShadow />
            <mesh geometry={g.upperArmR} position={[-0.015, -0.16, 0]} scale={[1.02, 1.0, 1.1]} material={warriorMats.skinMat} castShadow />
            <group ref={rightElbowRef} position={[-0.015, -0.31, 0]}>
              <mesh geometry={g.foreArmR} position={[0, -0.13, 0.01]} material={warriorMats.skinMat} castShadow />
              <mesh geometry={g.wristWrapR} position={[0, -0.25, 0.015]} material={warriorMats.wrapMat} />
              <group ref={rightHandRef} position={[0, -0.32, 0.02]}>
                <mesh geometry={g.handR} material={warriorMats.wrapMat} />
                <group position={[-0.015, -0.01, 0.03]} rotation={[0.24, 0.06, 0]}>
                  <mesh geometry={g.swordGrip} position={[0, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]} material={warriorMats.leatherMat} />
                  <mesh geometry={g.swordPommel} position={[0, 0, -0.155]} rotation={[0, Math.PI / 2, 0]} material={warriorMats.metalMat} />
                  <mesh geometry={g.swordGuard} position={[0, 0, 0.09]} material={warriorMats.metalMat} castShadow />
                  <mesh
                    position={[0, -0.01, 0.51]}
                    geometry={g.bladeGeo}
                    material={warriorMats.swordBladeMat}
                    castShadow
                  />
                </group>
              </group>
            </group>
          </group>

          {/* NECK, STERN MALE HEAD & DARK PONYTAIL */}
          <group ref={headRef} position={[0, 0.74, 0.02]}>
            <mesh geometry={g.neckCyl} position={[0, -0.11, -0.01]} material={warriorMats.skinMat} />
            <mesh
              geometry={g.headSphere}
              position={[0, 0.04, 0]}
              scale={[0.84, 1.06, 0.94]}
              rotation={[0, -Math.PI / 2, 0]}
              material={warriorMats.headMat}
              castShadow
            />
            <mesh geometry={g.jawBox} position={[0, -0.052, 0.042]} material={warriorMats.skinMat} />
            <mesh geometry={g.browBox} position={[0, 0.068, 0.122]} rotation={[0.16, 0, 0]} material={warriorMats.skinMat} />
            <mesh geometry={g.hairTop} position={[0, 0.135, -0.01]} scale={[0.92, 0.56, 1.02]} material={warriorMats.hairMat} castShadow />
            <mesh geometry={g.hairBack} position={[0, 0.06, -0.085]} scale={[0.92, 0.9, 0.72]} material={warriorMats.hairMat} />
            <group ref={ponytailRef} position={[0, 0.045, -0.14]}>
              <mesh geometry={g.ponyTie} material={warriorMats.leatherMat} />
              <mesh geometry={g.ponyMain} position={[0, -0.12, -0.07]} rotation={[0.45, 0, 0]} material={warriorMats.hairMat} castShadow />
              <mesh geometry={g.ponyTip} position={[0, -0.18, -0.11]} rotation={[0.62, 0, 0]} material={warriorMats.hairMat} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
});

/**
 * Coordinates all FOUR independent warrior Beasts across the 4-floor apartment building,
 * sharing procedural warrior materials & all geometries for smooth performance.
 */
export const BeastActor: React.FC = () => {
  const beastResetTrigger = useGameStore((s) => s.beastResetTrigger);
  const warriorMats = useMemo(() => createBeastWarriorMaterials(), []);
  const sculptedGeos = useMemo(() => createSculptedGeometries(), []);

  const brainsRef = useRef<BeastBrainState[]>(
    BEAST_ROSTER.map((entry) => createBeastBrainStateForRoster(entry.id))
  );
  const telemetryAccumRef = useRef(0);
  const lastModeSigRef = useRef('');

  useEffect(() => {
    return () => {
      warriorMats.dispose();
      sculptedGeos.dispose();
    };
  }, [warriorMats, sculptedGeos]);

  // Reset all 4 Beast brains cleanly on New Game / Full Restart / Respawn
  useEffect(() => {
    brainsRef.current = BEAST_ROSTER.map((entry) => createBeastBrainStateForRoster(entry.id));
    beastWorldPos.capturingBeastId = null;
    for (let i = 0; i < BEAST_ROSTER.length; i++) {
      const st = brainsRef.current[i];
      if (beastWorldPositions[i]) {
        beastWorldPositions[i].x = st.x;
        beastWorldPositions[i].feetY = st.feetY;
        beastWorldPositions[i].z = st.z;
        beastWorldPositions[i].yaw = st.yaw;
        beastWorldPositions[i].mode = st.mode;
      }
    }
    const first = brainsRef.current[0];
    beastWorldPos.x = first.x;
    beastWorldPos.feetY = first.feetY;
    beastWorldPos.z = first.z;
    beastWorldPos.yaw = first.yaw;
    telemetryAccumRef.current = 0;
    lastModeSigRef.current = '';
  }, [beastResetTrigger]);

  // Throttled squad telemetry sync to Zustand store + closest Beast world pos sync
  useFrame((_, rawDelta) => {
    const store = useGameStore.getState();
    if (store.inMainMenu || store.gamePaused) {
      return;
    }
    const brains = brainsRef.current;

    // Keep beastWorldPos synced to capturing Beast (if any) or closest Beast
    let closest = brains[0];
    let closestDist = Infinity;
    let modeSig = '';
    for (let i = 0; i < brains.length; i++) {
      const b = brains[i];
      const d = Math.hypot(playerWorldPos.x - b.x, playerWorldPos.feetY - b.feetY, playerWorldPos.z - b.z);
      if (d < closestDist) {
        closestDist = d;
        closest = b;
      }
      modeSig += `${b.mode}:${getFloorFromElevation(b.feetY)}|`;
    }
    const focus =
      beastWorldPos.capturingBeastId !== null
        ? brains[beastWorldPos.capturingBeastId] ?? closest
        : closest;
    beastWorldPos.x = focus.x;
    beastWorldPos.feetY = focus.feetY;
    beastWorldPos.z = focus.z;
    beastWorldPos.yaw = focus.yaw;

    telemetryAccumRef.current += Math.min(rawDelta, 0.05);
    const modeChanged = modeSig !== lastModeSigRef.current;
    if (modeChanged || telemetryAccumRef.current >= 0.3) {
      telemetryAccumRef.current = 0;
      lastModeSigRef.current = modeSig;
      const profile = getBeastDifficultyProfile(
        store.progression,
        store.missionCompleted,
        store.allPuzzlesCompleted,
        store.puzzleRoomEntered,
        store.keyPickupAlarmTriggered
      );
      let lkpFloor: FloorNumber | null = null;
      const entries: BeastTelemetryEntry[] = brains.map((b) => {
        const lastKnownFloor = b.lastKnownPlayerPos?.floor ?? null;
        if (lastKnownFloor) lkpFloor = lastKnownFloor;
        return {
          id: b.id,
          name: b.name,
          floor: getFloorFromElevation(b.feetY),
          mode: b.mode,
          distance: Math.round(Math.hypot(playerWorldPos.x - b.x, playerWorldPos.z - b.z) * 2) / 2,
          lastKnownFloor,
        };
      });
      store.setBeastsTelemetry(entries, profile.label, lkpFloor);
    }
  });

  return (
    <group>
      {BEAST_ROSTER.map((roster) => (
        <SingleBeastActor
          key={roster.id}
          roster={roster}
          warriorMats={warriorMats}
          sculptedGeos={sculptedGeos}
          brain={brainsRef.current[roster.id]}
          allBrainsRef={brainsRef}
          resetCounter={beastResetTrigger}
        />
      ))}
    </group>
  );
};
