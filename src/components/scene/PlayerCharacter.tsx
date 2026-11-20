import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { FLOOR_ELEVATIONS } from '../../data/buildingLayout';
import { useGameStore } from '../../store/useGameStore';
import { createPlayerSurvivorMaterials } from '../../three/playerTextures';
import { playerWorldPos } from '../../three/playerWorldState';

function createSurvivorGeometries() {
  // Sculpted cream linen upper tunic torso (rotated +PI/2 so V-notch at u=0.75 faces +Z)
  const torsoPts = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.165, 0.015),
    new THREE.Vector2(0.158, 0.08),
    new THREE.Vector2(0.172, 0.2),
    new THREE.Vector2(0.205, 0.34),
    new THREE.Vector2(0.215, 0.44),
    new THREE.Vector2(0.175, 0.49),
    new THREE.Vector2(0.082, 0.515),
    new THREE.Vector2(0.01, 0.52),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 18);
  torsoGeo.computeVertexNormals();

  // Flared cream linen lower tunic skirt extending cleanly over waist & upper thighs
  const tunicSkirtPts = [
    new THREE.Vector2(0.162, 0.03),
    new THREE.Vector2(0.172, -0.02),
    new THREE.Vector2(0.195, -0.13),
    new THREE.Vector2(0.212, -0.24),
    new THREE.Vector2(0.216, -0.275),
  ];
  const tunicSkirtGeo = new THREE.LatheGeometry(tunicSkirtPts, 18);
  tunicSkirtGeo.computeVertexNormals();

  // Loose cream linen short sleeve (slightly flared open cuff ending above elbow)
  const sleevePts = [
    new THREE.Vector2(0.01, 0.055),
    new THREE.Vector2(0.078, 0.03),
    new THREE.Vector2(0.084, -0.04),
    new THREE.Vector2(0.08, -0.14),
    new THREE.Vector2(0.086, -0.22),
  ];
  const sleeveGeo = new THREE.LatheGeometry(sleevePts, 14);
  sleeveGeo.computeVertexNormals();

  // Natural tapered forearm
  const forearmPts = [
    new THREE.Vector2(0.01, 0.01),
    new THREE.Vector2(0.052, 0.0),
    new THREE.Vector2(0.05, -0.08),
    new THREE.Vector2(0.042, -0.18),
    new THREE.Vector2(0.035, -0.25),
    new THREE.Vector2(0.01, -0.26),
  ];
  const forearmGeo = new THREE.LatheGeometry(forearmPts, 12);
  forearmGeo.computeVertexNormals();

  // Dark brown woven trouser thigh
  const thighPts = [
    new THREE.Vector2(0.01, 0.02),
    new THREE.Vector2(0.106, 0.0),
    new THREE.Vector2(0.112, -0.14),
    new THREE.Vector2(0.098, -0.3),
    new THREE.Vector2(0.082, -0.41),
    new THREE.Vector2(0.072, -0.44),
    new THREE.Vector2(0.01, -0.45),
  ];
  const thighGeo = new THREE.LatheGeometry(thighPts, 14);
  thighGeo.computeVertexNormals();

  // Dark brown woven trouser lower leg tapering into boot collar
  const shinTrouserPts = [
    new THREE.Vector2(0.01, 0.02),
    new THREE.Vector2(0.078, 0.0),
    new THREE.Vector2(0.084, -0.11),
    new THREE.Vector2(0.074, -0.23),
    new THREE.Vector2(0.064, -0.32),
    new THREE.Vector2(0.058, -0.34),
    new THREE.Vector2(0.01, -0.35),
  ];
  const shinTrouserGeo = new THREE.LatheGeometry(shinTrouserPts, 14);
  shinTrouserGeo.computeVertexNormals();

  return {
    torsoGeo,
    tunicSkirtGeo,
    sleeveGeo,
    forearmGeo,
    thighGeo,
    shinTrouserGeo,
    dispose: () => {
      torsoGeo.dispose();
      tunicSkirtGeo.dispose();
      sleeveGeo.dispose();
      forearmGeo.dispose();
      thighGeo.dispose();
      shinTrouserGeo.dispose();
    },
  };
}

function normalizeAngleDelta(target: number, current: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Main playable 3D human male survivor character matching the attached reference image:
 * - Short brown hair, natural realistic male face with trimmed beard/stubble
 * - Off-white/cream woven short-sleeved V-notch tunic
 * - Knotted brown leather waist belt with hanging front straps
 * - Dark brown ribbed trousers tucked cleanly into brown leather laced boots
 * - Grounded at exact feetY = 0.000 (boot soles flush with floor, soft contact shadow)
 * - Continuous frame-rate independent animation blending across idle/walk/run/sprint/turn/actions
 */
export const PlayerCharacter: React.FC = React.memo(() => {
  const mats = useMemo(() => createPlayerSurvivorMaterials(), []);
  const geos = useMemo(() => createSurvivorGeometries(), []);

  const rootRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null);
  const pelvisRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const beltStrapLeftRef = useRef<THREE.Mesh>(null);
  const beltStrapRightRef = useRef<THREE.Mesh>(null);
  const contactShadowRef = useRef<THREE.Mesh>(null);

  const leftHipRef = useRef<THREE.Group>(null);
  const leftKneeRef = useRef<THREE.Group>(null);
  const leftAnkleRef = useRef<THREE.Group>(null);

  const rightHipRef = useRef<THREE.Group>(null);
  const rightKneeRef = useRef<THREE.Group>(null);
  const rightAnkleRef = useRef<THREE.Group>(null);

  const leftShoulderRef = useRef<THREE.Group>(null);
  const leftElbowRef = useRef<THREE.Group>(null);

  const rightShoulderRef = useRef<THREE.Group>(null);
  const rightElbowRef = useRef<THREE.Group>(null);

  const animRef = useRef({
    idleClock: 0,
    smoothedMoveRatio: 0,
    smoothedSprintBlend: 0,
    smoothedTurnRoll: 0,
    captureClock: 0,
  });

  useEffect(() => {
    return () => {
      mats.dispose();
      geos.dispose();
    };
  }, [mats, geos]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const store = useGameStore.getState();
    const anim = animRef.current;

    const paused = store.gamePaused;
    if (!paused) {
      anim.idleClock += delta;
      if (playerWorldPos.actionAnim !== 'none' && playerWorldPos.actionAnim !== 'capture-death') {
        playerWorldPos.actionAnimClock += delta;
        if (
          playerWorldPos.actionAnimDuration > 0 &&
          playerWorldPos.actionAnimClock >= playerWorldPos.actionAnimDuration
        ) {
          playerWorldPos.actionAnim = 'none';
          playerWorldPos.actionAnimClock = 0;
        }
      }
      if (store.beastCapturing || store.progression === 'PLAYER_CAUGHT') {
        anim.captureClock += delta;
      } else {
        anim.captureClock = 0;
      }
    }

    // 1. Place character root strictly at the player's actual physical world feet + jump height
    if (rootRef.current) {
      rootRef.current.position.set(
        playerWorldPos.x,
        playerWorldPos.feetY + playerWorldPos.jumpOffsetY,
        playerWorldPos.z
      );
      rootRef.current.rotation.y = playerWorldPos.characterYaw;
    }

    // Conceal mesh only when fully tucked inside a slatted cupboard peek-view so head never blocks slats
    const hideBodyForPeek =
      store.controlMode !== 'orbit' &&
      playerWorldPos.isHidden &&
      playerWorldPos.actionAnim !== 'hide-enter' &&
      playerWorldPos.actionAnim !== 'hide-exit';
    if (bodyGroupRef.current) {
      bodyGroupRef.current.visible = !hideBodyForPeek;
    }

    // 2. Determine active animation state & compute continuous articulated joint targets
    const isCapturingOrCaught = store.beastCapturing || store.progression === 'PLAYER_CAUGHT';
    const isPuzzleOperating =
      !isCapturingOrCaught && (store.puzzleModalOpen || store.activeKeyCellModal !== null);
    const action = playerWorldPos.actionAnim;
    const actionT =
      playerWorldPos.actionAnimDuration > 0
        ? THREE.MathUtils.clamp(playerWorldPos.actionAnimClock / playerWorldPos.actionAnimDuration, 0, 1)
        : 0;

    anim.smoothedMoveRatio = THREE.MathUtils.damp(
      anim.smoothedMoveRatio,
      playerWorldPos.moveRatio,
      14,
      delta
    );
    anim.smoothedSprintBlend = THREE.MathUtils.damp(
      anim.smoothedSprintBlend,
      playerWorldPos.sprintBlend,
      10,
      delta
    );
    anim.smoothedTurnRoll = THREE.MathUtils.damp(
      anim.smoothedTurnRoll,
      THREE.MathUtils.clamp(-playerWorldPos.turnRate * 0.04, -0.13, 0.13),
      11,
      delta
    );

    // Default natural relaxed human standing pose (NEVER T-pose!)
    const breath = Math.sin(anim.idleClock * 2.1);
    const weightShift = Math.sin(anim.idleClock * 0.95);

    let pelvisY = 0.94 + breath * 0.008;
    let pelvisX = weightShift * 0.012;
    let pelvisPitch = 0;
    let pelvisRoll = anim.smoothedTurnRoll;

    let torsoPitch = 0.03 + breath * 0.012;
    let torsoYaw = 0;

    let headYaw = Math.sin(anim.idleClock * 0.65) * 0.09;
    let headPitch = 0.02;

    let lHipX = -0.02;
    let lHipZ = 0.02;
    let lKneeX = 0.05;
    let lAnkleX = -0.03;

    let rHipX = 0.02;
    let rHipZ = -0.02;
    let rKneeX = 0.05;
    let rAnkleX = -0.03;

    let lShoulderX = 0.04 + breath * 0.015;
    let lShoulderZ = 0.09;
    let lElbowX = -0.22;

    let rShoulderX = 0.04 - breath * 0.015;
    let rShoulderZ = -0.09;
    let rElbowX = -0.22;

    // --- Priority 1: Capture / Death Animation ---
    if (isCapturingOrCaught) {
      const c = anim.captureClock;
      if (c < 0.38) {
        const w = THREE.MathUtils.smoothstep(c / 0.38, 0, 1);
        pelvisY = 0.94 - 0.1 * w;
        pelvisPitch = -0.16 * w;
        torsoPitch = -0.2 * w;
        torsoYaw = 0.22 * w;
        headPitch = -0.18 * w;
        lShoulderX = -1.28 * w;
        lShoulderZ = 0.25 * w;
        lElbowX = -1.15 * w;
        rShoulderX = -1.42 * w;
        rShoulderZ = -0.28 * w;
        rElbowX = -1.05 * w;
        lHipX = -0.22 * w;
        lKneeX = 0.44 * w;
        rHipX = 0.18 * w;
        rKneeX = 0.36 * w;
      } else {
        const fall = THREE.MathUtils.smoothstep((c - 0.38) / 0.45, 0, 1);
        pelvisY = THREE.MathUtils.lerp(0.84, 0.22, fall);
        pelvisPitch = THREE.MathUtils.lerp(-0.16, -1.32, fall);
        torsoPitch = THREE.MathUtils.lerp(-0.2, 0.12, fall);
        headPitch = THREE.MathUtils.lerp(-0.18, 0.28, fall);
        lShoulderX = THREE.MathUtils.lerp(-1.28, -0.35, fall);
        lShoulderZ = THREE.MathUtils.lerp(0.25, 0.52, fall);
        lElbowX = -0.45;
        rShoulderX = THREE.MathUtils.lerp(-1.42, -0.25, fall);
        rShoulderZ = THREE.MathUtils.lerp(-0.28, -0.48, fall);
        rElbowX = -0.38;
        lHipX = THREE.MathUtils.lerp(-0.22, 0.12, fall);
        lKneeX = THREE.MathUtils.lerp(0.44, 0.32, fall);
        rHipX = THREE.MathUtils.lerp(0.18, -0.08, fall);
        rKneeX = THREE.MathUtils.lerp(0.36, 0.24, fall);
      }
    }
    // --- Priority 2: Hiding / Concealed Crouch & Exit Hiding ---
    else if (action === 'hide-enter' || (playerWorldPos.isHidden && action !== 'hide-exit')) {
      const crouch = action === 'hide-enter' ? THREE.MathUtils.smoothstep(actionT, 0, 1) : 1;
      pelvisY = THREE.MathUtils.lerp(0.94, 0.64, crouch) + Math.sin(anim.idleClock * 3.0) * 0.008;
      torsoPitch = THREE.MathUtils.lerp(0.03, 0.34, crouch);
      headPitch = -0.14 * crouch;
      lHipX = -0.78 * crouch;
      lKneeX = 1.48 * crouch;
      lAnkleX = -0.68 * crouch;
      rHipX = -0.72 * crouch;
      rKneeX = 1.42 * crouch;
      rAnkleX = -0.66 * crouch;
      lShoulderX = -0.56 * crouch;
      lShoulderZ = 0.04;
      lElbowX = -1.18 * crouch;
      rShoulderX = -0.58 * crouch;
      rShoulderZ = -0.04;
      rElbowX = -1.18 * crouch;
    } else if (action === 'hide-exit') {
      const rise = THREE.MathUtils.smoothstep(actionT, 0, 1);
      pelvisY = THREE.MathUtils.lerp(0.66, 0.94, rise);
      torsoPitch = THREE.MathUtils.lerp(0.32, 0.04, rise);
      lHipX = THREE.MathUtils.lerp(-0.72, -0.02, rise);
      lKneeX = THREE.MathUtils.lerp(1.38, 0.05, rise);
      lAnkleX = THREE.MathUtils.lerp(-0.64, -0.03, rise);
      rHipX = THREE.MathUtils.lerp(-0.68, 0.02, rise);
      rKneeX = THREE.MathUtils.lerp(1.32, 0.05, rise);
      rAnkleX = THREE.MathUtils.lerp(-0.62, -0.03, rise);
      lShoulderX = THREE.MathUtils.lerp(-0.5, 0.04, rise);
      lElbowX = THREE.MathUtils.lerp(-1.05, -0.22, rise);
      rShoulderX = THREE.MathUtils.lerp(-0.52, 0.04, rise);
      rElbowX = THREE.MathUtils.lerp(-1.05, -0.22, rise);
    }
    // --- Priority 3: Respawn Recovery Animation ---
    else if (action === 'respawn') {
      const recover = THREE.MathUtils.smoothstep(actionT, 0, 1);
      pelvisY = THREE.MathUtils.lerp(0.74, 0.94, recover);
      torsoPitch = THREE.MathUtils.lerp(0.24, 0.03, recover);
      headYaw = Math.sin(actionT * Math.PI * 2) * 0.28 * (1 - recover * 0.4);
      lHipX = THREE.MathUtils.lerp(-0.48, -0.02, recover);
      lKneeX = THREE.MathUtils.lerp(0.95, 0.05, recover);
      rHipX = THREE.MathUtils.lerp(-0.42, 0.02, recover);
      rKneeX = THREE.MathUtils.lerp(0.86, 0.05, recover);
      lShoulderX = THREE.MathUtils.lerp(-0.35, 0.04, recover);
      lElbowX = THREE.MathUtils.lerp(-0.72, -0.22, recover);
      rShoulderX = THREE.MathUtils.lerp(-0.35, 0.04, recover);
      rElbowX = THREE.MathUtils.lerp(-0.72, -0.22, recover);
    }
    // --- Priority 4: Continuous Idle <-> Crouch <-> Walk <-> Run <-> Sprint <-> Jump Blend ---
    else {
      const m = anim.smoothedMoveRatio; // 0..1
      const cw = THREE.MathUtils.clamp(playerWorldPos.crouchBlend, 0, 1);
      const locoWeight = THREE.MathUtils.smoothstep(m, 0.015, 0.24);
      const sprintW = THREE.MathUtils.clamp(
        Math.max(anim.smoothedSprintBlend, THREE.MathUtils.smoothstep(m, 0.68, 0.96)),
        0,
        1
      ) * (1 - cw);

      // Blend stationary crouch stance smoothly over idle
      if (cw > 0.005) {
        pelvisY = THREE.MathUtils.lerp(pelvisY, 0.63 + breath * 0.006, cw);
        torsoPitch = THREE.MathUtils.lerp(torsoPitch, 0.28 + breath * 0.01, cw);
        headPitch = THREE.MathUtils.lerp(headPitch, -0.14, cw);
        lHipX = THREE.MathUtils.lerp(lHipX, -0.72, cw);
        lKneeX = THREE.MathUtils.lerp(lKneeX, 1.36, cw);
        lAnkleX = THREE.MathUtils.lerp(lAnkleX, -0.62, cw);
        rHipX = THREE.MathUtils.lerp(rHipX, -0.66, cw);
        rKneeX = THREE.MathUtils.lerp(rKneeX, 1.3, cw);
        rAnkleX = THREE.MathUtils.lerp(rAnkleX, -0.58, cw);
        lShoulderX = THREE.MathUtils.lerp(lShoulderX, -0.26, cw);
        lElbowX = THREE.MathUtils.lerp(lElbowX, -0.82, cw);
        rShoulderX = THREE.MathUtils.lerp(rShoulderX, -0.26, cw);
        rElbowX = THREE.MathUtils.lerp(rElbowX, -0.82, cw);
      }

      if (locoWeight > 0.001) {
        const phase = playerWorldPos.walkPhase;
        const s = Math.sin(phase);
        const c = Math.cos(phase);

        const walkStride = THREE.MathUtils.lerp(0.36, 0.62, Math.min(1, m / 0.68));
        const strideAmp = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(walkStride, 0.84, sprintW),
          0.34,
          cw
        );
        const kneeLift = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(0.34, 0.72, Math.min(1, m / 0.68)),
          1.04,
          sprintW
        );
        const armAmp = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(0.32, 0.64, Math.min(1, m / 0.68)),
            0.95,
            sprintW
          ),
          0.26,
          cw
        );

        const dipAmp = THREE.MathUtils.lerp(0.022, 0.042, sprintW);
        const bounceAmp = THREE.MathUtils.lerp(0.018, 0.036, sprintW);
        const baseLocoPelvisY = THREE.MathUtils.lerp(0.94, 0.63, cw);
        const locoPelvisY =
          baseLocoPelvisY - Math.abs(s) * dipAmp * m + Math.max(0, c) * bounceAmp * m;

        const locoTorsoPitch = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(0.06, THREE.MathUtils.lerp(0.14, 0.28, sprintW), m),
          0.32,
          cw
        );
        const locoTorsoYaw = s * THREE.MathUtils.lerp(0.1, 0.18, sprintW) * m * (1 - cw * 0.45);

        const crouchHipBias = -0.68 * cw;
        const crouchKneeBias = 1.24 * cw;
        const locoLHipX = crouchHipBias + s * strideAmp;
        const locoRHipX = crouchHipBias - s * strideAmp;
        const locoLKneeX = Math.max(0.05, crouchKneeBias + (-c * 0.55 + 0.45) * kneeLift * (1 - cw * 0.55));
        const locoRKneeX = Math.max(0.05, crouchKneeBias + (c * 0.55 + 0.45) * kneeLift * (1 - cw * 0.55));
        const locoLAnkleX = THREE.MathUtils.clamp(-locoLHipX * 0.48 - locoLKneeX * 0.34, -0.68, 0.35);
        const locoRAnkleX = THREE.MathUtils.clamp(-locoRHipX * 0.48 - locoRKneeX * 0.34, -0.68, 0.35);

        const locoLShoulderX = THREE.MathUtils.lerp(-s * armAmp, -0.26 - s * armAmp, cw);
        const locoRShoulderX = THREE.MathUtils.lerp(s * armAmp, -0.26 + s * armAmp, cw);
        const locoLShoulderZ = THREE.MathUtils.lerp(0.1, 0.14, sprintW);
        const locoRShoulderZ = -locoLShoulderZ;
        const baseElbow = THREE.MathUtils.lerp(THREE.MathUtils.lerp(-0.44, -1.16, sprintW), -0.84, cw);
        const elbowSwing = THREE.MathUtils.lerp(0.3, 0.24, sprintW);
        const locoLElbowX = baseElbow - Math.max(0, -s) * elbowSwing;
        const locoRElbowX = baseElbow - Math.max(0, s) * elbowSwing;

        const locoHeadYaw = THREE.MathUtils.clamp(playerWorldPos.turnRate * 0.12, -0.35, 0.35);
        const locoHeadPitch = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(-0.04, -0.14, sprintW),
          -0.16,
          cw
        );

        // Blend smoothly between idle/crouch pose and locomotion pose
        pelvisY = THREE.MathUtils.lerp(pelvisY, locoPelvisY, locoWeight);
        pelvisX = THREE.MathUtils.lerp(pelvisX, 0, locoWeight);
        torsoPitch = THREE.MathUtils.lerp(torsoPitch, locoTorsoPitch, locoWeight);
        torsoYaw = THREE.MathUtils.lerp(torsoYaw, locoTorsoYaw, locoWeight);
        headYaw = THREE.MathUtils.lerp(headYaw, locoHeadYaw, locoWeight);
        headPitch = THREE.MathUtils.lerp(headPitch, locoHeadPitch, locoWeight);

        lHipX = THREE.MathUtils.lerp(lHipX, locoLHipX, locoWeight);
        rHipX = THREE.MathUtils.lerp(rHipX, locoRHipX, locoWeight);
        lKneeX = THREE.MathUtils.lerp(lKneeX, locoLKneeX, locoWeight);
        rKneeX = THREE.MathUtils.lerp(rKneeX, locoRKneeX, locoWeight);
        lAnkleX = THREE.MathUtils.lerp(lAnkleX, locoLAnkleX, locoWeight);
        rAnkleX = THREE.MathUtils.lerp(rAnkleX, locoRAnkleX, locoWeight);

        lShoulderX = THREE.MathUtils.lerp(lShoulderX, locoLShoulderX, locoWeight);
        rShoulderX = THREE.MathUtils.lerp(rShoulderX, locoRShoulderX, locoWeight);
        lShoulderZ = THREE.MathUtils.lerp(lShoulderZ, locoLShoulderZ, locoWeight);
        rShoulderZ = THREE.MathUtils.lerp(rShoulderZ, locoRShoulderZ, locoWeight);
        lElbowX = THREE.MathUtils.lerp(lElbowX, locoLElbowX, locoWeight);
        rElbowX = THREE.MathUtils.lerp(rElbowX, locoRElbowX, locoWeight);
      } else if (playerWorldPos.isTurning) {
        const turnDir = Math.sign(playerWorldPos.turnRate);
        torsoYaw = turnDir * 0.16;
        headYaw = turnDir * 0.26;
        lHipX += turnDir * 0.08;
        rHipX -= turnDir * 0.08;
      }

      // Airborne jump / landing leg tuck (applies cleanly both while moving and standing jump!)
      if (!playerWorldPos.isGrounded && playerWorldPos.jumpOffsetY > 0.04) {
        const airW = THREE.MathUtils.clamp(playerWorldPos.jumpOffsetY / 0.45, 0.35, 1.0);
        lHipX = THREE.MathUtils.lerp(lHipX, -0.44, airW);
        lKneeX = THREE.MathUtils.lerp(lKneeX, 0.88, airW);
        lAnkleX = THREE.MathUtils.lerp(lAnkleX, -0.35, airW);
        rHipX = THREE.MathUtils.lerp(rHipX, -0.18, airW);
        rKneeX = THREE.MathUtils.lerp(rKneeX, 0.56, airW);
        rAnkleX = THREE.MathUtils.lerp(rAnkleX, -0.22, airW);
        lShoulderX = THREE.MathUtils.lerp(lShoulderX, -0.32, airW);
        lShoulderZ = THREE.MathUtils.lerp(lShoulderZ, 0.34, airW);
        rShoulderX = THREE.MathUtils.lerp(rShoulderX, -0.24, airW);
        rShoulderZ = THREE.MathUtils.lerp(rShoulderZ, -0.34, airW);
        torsoPitch = THREE.MathUtils.lerp(torsoPitch, 0.14, airW);
      }
    }

    // --- Upper-Body Action Overlays (Key Pickup, Door Interaction, Puzzle Console) ---
    if (!isCapturingOrCaught && !playerWorldPos.isHidden) {
      if (action === 'key-pickup') {
        const reach = Math.sin(actionT * Math.PI);
        torsoPitch += 0.22 * reach;
        torsoYaw += -0.18 * reach;
        headPitch += 0.28 * reach;
        rShoulderX = THREE.MathUtils.lerp(rShoulderX, -1.08, reach);
        rShoulderZ = THREE.MathUtils.lerp(rShoulderZ, -0.12, reach);
        rElbowX = THREE.MathUtils.lerp(rElbowX, -0.42, reach);
        lShoulderX = THREE.MathUtils.lerp(lShoulderX, 0.14, reach);
      } else if (action === 'door-interact') {
        const push = Math.sin(actionT * Math.PI);
        torsoPitch += 0.12 * push;
        torsoYaw += -0.2 * push;
        rShoulderX = THREE.MathUtils.lerp(rShoulderX, -1.25, push);
        rShoulderZ = THREE.MathUtils.lerp(rShoulderZ, 0.06, push);
        rElbowX = THREE.MathUtils.lerp(rElbowX, -0.28, push);
      } else if (isPuzzleOperating || action === 'puzzle-interact') {
        const typeWave = Math.sin(anim.idleClock * 9.0) * 0.08;
        torsoPitch = 0.12;
        headPitch = 0.18;
        headYaw = Math.sin(anim.idleClock * 1.4) * 0.12;
        lShoulderX = -0.88 + typeWave;
        lShoulderZ = 0.14;
        lElbowX = -0.95;
        rShoulderX = -0.92 - typeWave;
        rShoulderZ = -0.14;
        rElbowX = -0.98;
      } else {
        const camForwardCharYaw = playerWorldPos.yaw + Math.PI;
        const lookOffset = normalizeAngleDelta(camForwardCharYaw, playerWorldPos.characterYaw);
        if (anim.smoothedMoveRatio < 0.06) {
          headYaw = THREE.MathUtils.clamp(lookOffset * 0.45, -0.52, 0.52);
          headPitch = THREE.MathUtils.clamp(playerWorldPos.pitch * 0.35, -0.24, 0.26);
        }
      }
    }

    // 3. Apply frame-rate independent exponential damping to all articulated joints
    const lambda = isCapturingOrCaught ? 16 : 14;

    if (pelvisRef.current) {
      pelvisRef.current.position.y = THREE.MathUtils.damp(pelvisRef.current.position.y, pelvisY, lambda, delta);
      pelvisRef.current.position.x = THREE.MathUtils.damp(pelvisRef.current.position.x, pelvisX, lambda, delta);
      pelvisRef.current.rotation.x = THREE.MathUtils.damp(pelvisRef.current.rotation.x, pelvisPitch, lambda, delta);
      pelvisRef.current.rotation.z = THREE.MathUtils.damp(pelvisRef.current.rotation.z, pelvisRoll, lambda, delta);
    }

    if (torsoRef.current) {
      torsoRef.current.rotation.x = THREE.MathUtils.damp(torsoRef.current.rotation.x, torsoPitch, lambda, delta);
      torsoRef.current.rotation.y = THREE.MathUtils.damp(torsoRef.current.rotation.y, torsoYaw, lambda, delta);
    }

    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.damp(headRef.current.rotation.y, headYaw, lambda, delta);
      headRef.current.rotation.x = THREE.MathUtils.damp(headRef.current.rotation.x, headPitch, lambda, delta);
    }

    if (leftHipRef.current) {
      leftHipRef.current.rotation.x = THREE.MathUtils.damp(leftHipRef.current.rotation.x, lHipX, lambda, delta);
      leftHipRef.current.rotation.z = THREE.MathUtils.damp(leftHipRef.current.rotation.z, lHipZ, lambda, delta);
    }
    if (leftKneeRef.current) {
      leftKneeRef.current.rotation.x = THREE.MathUtils.damp(leftKneeRef.current.rotation.x, lKneeX, lambda, delta);
    }
    if (leftAnkleRef.current) {
      leftAnkleRef.current.rotation.x = THREE.MathUtils.damp(leftAnkleRef.current.rotation.x, lAnkleX, lambda, delta);
    }

    if (rightHipRef.current) {
      rightHipRef.current.rotation.x = THREE.MathUtils.damp(rightHipRef.current.rotation.x, rHipX, lambda, delta);
      rightHipRef.current.rotation.z = THREE.MathUtils.damp(rightHipRef.current.rotation.z, rHipZ, lambda, delta);
    }
    if (rightKneeRef.current) {
      rightKneeRef.current.rotation.x = THREE.MathUtils.damp(rightKneeRef.current.rotation.x, rKneeX, lambda, delta);
    }
    if (rightAnkleRef.current) {
      rightAnkleRef.current.rotation.x = THREE.MathUtils.damp(rightAnkleRef.current.rotation.x, rAnkleX, lambda, delta);
    }

    if (leftShoulderRef.current) {
      leftShoulderRef.current.rotation.x = THREE.MathUtils.damp(leftShoulderRef.current.rotation.x, lShoulderX, lambda, delta);
      leftShoulderRef.current.rotation.z = THREE.MathUtils.damp(leftShoulderRef.current.rotation.z, lShoulderZ, lambda, delta);
    }
    if (leftElbowRef.current) {
      leftElbowRef.current.rotation.x = THREE.MathUtils.damp(leftElbowRef.current.rotation.x, lElbowX, lambda, delta);
    }

    if (rightShoulderRef.current) {
      rightShoulderRef.current.rotation.x = THREE.MathUtils.damp(rightShoulderRef.current.rotation.x, rShoulderX, lambda, delta);
      rightShoulderRef.current.rotation.z = THREE.MathUtils.damp(rightShoulderRef.current.rotation.z, rShoulderZ, lambda, delta);
    }
    if (rightElbowRef.current) {
      rightElbowRef.current.rotation.x = THREE.MathUtils.damp(rightElbowRef.current.rotation.x, rElbowX, lambda, delta);
    }

    // Secondary motion: knotted brown leather waist belt hanging straps smoothly damped with stride
    const sway = anim.smoothedMoveRatio;
    const strapKick = Math.max(0, Math.abs(Math.sin(playerWorldPos.walkPhase)) * sway);
    if (beltStrapLeftRef.current) {
      beltStrapLeftRef.current.rotation.x = THREE.MathUtils.damp(
        beltStrapLeftRef.current.rotation.x,
        -0.06 - strapKick * 0.34,
        12,
        delta
      );
      beltStrapLeftRef.current.rotation.z = THREE.MathUtils.damp(
        beltStrapLeftRef.current.rotation.z,
        0.08 + Math.sin(anim.idleClock * 4.5) * 0.04 * sway,
        12,
        delta
      );
    }
    if (beltStrapRightRef.current) {
      beltStrapRightRef.current.rotation.x = THREE.MathUtils.damp(
        beltStrapRightRef.current.rotation.x,
        -0.05 - strapKick * 0.28,
        12,
        delta
      );
      beltStrapRightRef.current.rotation.z = THREE.MathUtils.damp(
        beltStrapRightRef.current.rotation.z,
        -0.09 - Math.cos(anim.idleClock * 4.5) * 0.04 * sway,
        12,
        delta
      );
    }

    if (contactShadowRef.current) {
      const jumpShrink = Math.max(0.45, 1.0 - playerWorldPos.jumpOffsetY * 0.45);
      const shadowScale = (isCapturingOrCaught ? 1.35 : 1.0) * jumpShrink;
      contactShadowRef.current.position.y = 0.012 - playerWorldPos.jumpOffsetY;
      contactShadowRef.current.scale.set(shadowScale, shadowScale, 1);
    }
  });

  return (
    <group
      ref={rootRef}
      name="player-survivor-character"
      position={[-22.3, FLOOR_ELEVATIONS[1], -15.8]}
      rotation={[0, Math.PI / 2, 0]}
    >
      {/* Grounded contact shadow disc directly beneath boots */}
      <mesh
        ref={contactShadowRef}
        position={[0, 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={mats.shadowMat}
      >
        <planeGeometry args={[0.78, 0.78]} />
      </mesh>

      <group ref={bodyGroupRef}>
        {/* PELVIS ROOT (y = 0.94m -> boot soles sit flush at y = 0.000m) */}
        <group ref={pelvisRef} position={[0, 0.94, 0]}>
          {/* Dark brown trousers hip block */}
          <mesh scale={[1.08, 1.0, 0.82]} material={mats.trousersMat} castShadow receiveShadow>
            <cylinderGeometry args={[0.158, 0.17, 0.22, 14]} />
          </mesh>

          {/* Flared cream linen lower tunic skirt */}
          <mesh
            position={[0, 0.02, 0]}
            scale={[1.04, 1.0, 0.84]}
            geometry={geos.tunicSkirtGeo}
            material={mats.tunicDoubleMat}
            castShadow
            receiveShadow
          />

          {/* Brown leather waist belt (double-wrapped cord/strap matching reference) */}
          <mesh
            position={[0, 0.048, 0]}
            scale={[1.06, 1.0, 0.86]}
            rotation={[Math.PI / 2 + 0.03, 0, 0]}
            material={mats.beltLeatherMat}
          >
            <torusGeometry args={[0.172, 0.017, 8, 22]} />
          </mesh>
          <mesh
            position={[0, 0.018, 0]}
            scale={[1.07, 1.0, 0.87]}
            rotation={[Math.PI / 2 - 0.03, 0, 0]}
            material={mats.beltLeatherMat}
          >
            <torusGeometry args={[0.174, 0.015, 8, 22]} />
          </mesh>
          {/* Front-center leather belt knot */}
          <mesh position={[0, 0.032, 0.162]} material={mats.beltLeatherMat}>
            <sphereGeometry args={[0.026, 10, 8]} />
          </mesh>
          {/* Two hanging knotted brown leather belt ends */}
          <mesh
            ref={beltStrapLeftRef}
            position={[0.018, -0.09, 0.168]}
            rotation={[-0.06, 0, 0.08]}
            material={mats.beltLeatherMat}
          >
            <cylinderGeometry args={[0.01, 0.008, 0.24, 8]} />
          </mesh>
          <mesh
            ref={beltStrapRightRef}
            position={[-0.018, -0.1, 0.166]}
            rotation={[-0.05, 0, -0.09]}
            material={mats.beltLeatherMat}
          >
            <cylinderGeometry args={[0.01, 0.008, 0.26, 8]} />
          </mesh>

          {/* LEFT ARTICULATED LEG (+X) */}
          <group ref={leftHipRef} position={[0.108, -0.02, 0]}>
            <mesh
              geometry={geos.thighGeo}
              scale={[1.0, 1.0, 1.06]}
              material={mats.trousersMat}
              castShadow
              receiveShadow
            />
            <group ref={leftKneeRef} position={[0, -0.43, 0]}>
              <mesh
                geometry={geos.shinTrouserGeo}
                material={mats.trousersMat}
                castShadow
                receiveShadow
              />
              {/* Left Brown Leather Boot */}
              <group ref={leftAnkleRef} position={[0, -0.39, 0]}>
                <mesh position={[0, 0.045, 0.005]} material={mats.bootLeatherMat} castShadow>
                  <cylinderGeometry args={[0.066, 0.062, 0.145, 12]} />
                </mesh>
                <mesh position={[0, -0.04, 0.042]} material={mats.bootLeatherMat} castShadow receiveShadow>
                  <boxGeometry args={[0.112, 0.082, 0.215]} />
                </mesh>
                <mesh
                  position={[0, -0.046, 0.14]}
                  scale={[1.0, 0.72, 1.15]}
                  material={mats.bootLeatherMat}
                >
                  <sphereGeometry args={[0.054, 10, 8]} />
                </mesh>
                <mesh position={[0, -0.088, 0.052]} material={mats.bootSoleMat} receiveShadow>
                  <boxGeometry args={[0.118, 0.024, 0.258]} />
                </mesh>
              </group>
            </group>
          </group>

          {/* RIGHT ARTICULATED LEG (-X) */}
          <group ref={rightHipRef} position={[-0.108, -0.02, 0]}>
            <mesh
              geometry={geos.thighGeo}
              scale={[1.0, 1.0, 1.06]}
              material={mats.trousersMat}
              castShadow
              receiveShadow
            />
            <group ref={rightKneeRef} position={[0, -0.43, 0]}>
              <mesh
                geometry={geos.shinTrouserGeo}
                material={mats.trousersMat}
                castShadow
                receiveShadow
              />
              {/* Right Brown Leather Boot */}
              <group ref={rightAnkleRef} position={[0, -0.39, 0]}>
                <mesh position={[0, 0.045, 0.005]} material={mats.bootLeatherMat} castShadow>
                  <cylinderGeometry args={[0.066, 0.062, 0.145, 12]} />
                </mesh>
                <mesh position={[0, -0.04, 0.042]} material={mats.bootLeatherMat} castShadow receiveShadow>
                  <boxGeometry args={[0.112, 0.082, 0.215]} />
                </mesh>
                <mesh
                  position={[0, -0.046, 0.14]}
                  scale={[1.0, 0.72, 1.15]}
                  material={mats.bootLeatherMat}
                >
                  <sphereGeometry args={[0.054, 10, 8]} />
                </mesh>
                <mesh position={[0, -0.088, 0.052]} material={mats.bootSoleMat} receiveShadow>
                  <boxGeometry args={[0.118, 0.024, 0.258]} />
                </mesh>
              </group>
            </group>
          </group>

          {/* UPPER TORSO (OFF-WHITE / CREAM SHORT-SLEEVED LINEN TUNIC) */}
          <group ref={torsoRef} position={[0, 0.04, 0]}>
            <mesh
              geometry={geos.torsoGeo}
              scale={[0.82, 1.0, 1.08]}
              rotation={[0, Math.PI / 2, 0]}
              material={mats.tunicMat}
              castShadow
              receiveShadow
            />

            {/* LEFT ARTICULATED ARM (+X) */}
            <group ref={leftShoulderRef} position={[0.242, 0.44, 0.0]}>
              <mesh
                geometry={geos.sleeveGeo}
                material={mats.tunicDoubleMat}
                castShadow
                receiveShadow
              />
              <mesh position={[0, -0.22, 0]} material={mats.skinMat} castShadow>
                <cylinderGeometry args={[0.055, 0.05, 0.15, 12]} />
              </mesh>
              <group ref={leftElbowRef} position={[0, -0.295, 0]}>
                <mesh material={mats.skinMat}>
                  <sphereGeometry args={[0.05, 10, 8]} />
                </mesh>
                <mesh geometry={geos.forearmGeo} material={mats.skinMat} castShadow receiveShadow />
                <group position={[0, -0.265, 0.008]}>
                  <mesh position={[0, -0.032, 0]} material={mats.skinMat}>
                    <boxGeometry args={[0.034, 0.072, 0.068]} />
                  </mesh>
                  <mesh position={[0.004, -0.086, 0.008]} rotation={[0.14, 0, 0]} material={mats.skinMat}>
                    <boxGeometry args={[0.026, 0.054, 0.058]} />
                  </mesh>
                  <mesh position={[-0.014, -0.036, 0.04]} rotation={[0.35, 0, 0.25]} material={mats.skinMat}>
                    <capsuleGeometry args={[0.01, 0.032, 4, 6]} />
                  </mesh>
                </group>
              </group>
            </group>

            {/* RIGHT ARTICULATED ARM (-X) */}
            <group ref={rightShoulderRef} position={[-0.242, 0.44, 0.0]}>
              <mesh
                geometry={geos.sleeveGeo}
                material={mats.tunicDoubleMat}
                castShadow
                receiveShadow
              />
              <mesh position={[0, -0.22, 0]} material={mats.skinMat} castShadow>
                <cylinderGeometry args={[0.055, 0.05, 0.15, 12]} />
              </mesh>
              <group ref={rightElbowRef} position={[0, -0.295, 0]}>
                <mesh material={mats.skinMat}>
                  <sphereGeometry args={[0.05, 10, 8]} />
                </mesh>
                <mesh geometry={geos.forearmGeo} material={mats.skinMat} castShadow receiveShadow />
                <group position={[0, -0.265, 0.008]}>
                  <mesh position={[0, -0.032, 0]} material={mats.skinMat}>
                    <boxGeometry args={[0.034, 0.072, 0.068]} />
                  </mesh>
                  <mesh position={[-0.004, -0.086, 0.008]} rotation={[0.14, 0, 0]} material={mats.skinMat}>
                    <boxGeometry args={[0.026, 0.054, 0.058]} />
                  </mesh>
                  <mesh position={[0.014, -0.036, 0.04]} rotation={[0.35, 0, -0.25]} material={mats.skinMat}>
                    <capsuleGeometry args={[0.01, 0.032, 4, 6]} />
                  </mesh>
                </group>
              </group>
            </group>

            {/* NECK, REALISTIC MALE HUMAN HEAD & SHORT BROWN HAIR */}
            <group ref={headRef} position={[0, 0.575, 0.01]}>
              <mesh position={[0, -0.085, -0.008]} material={mats.skinMat}>
                <cylinderGeometry args={[0.056, 0.072, 0.135, 12]} />
              </mesh>
              <mesh
                position={[0, 0.045, 0]}
                scale={[0.84, 1.06, 0.94]}
                rotation={[0, -Math.PI / 2, 0]}
                material={mats.headMat}
                castShadow
                receiveShadow
              >
                <sphereGeometry args={[0.124, 18, 16]} />
              </mesh>
              <mesh position={[0, -0.038, 0.034]} scale={[0.92, 0.85, 0.9]} material={mats.skinMat}>
                <sphereGeometry args={[0.066, 12, 10]} />
              </mesh>
              <mesh position={[0, 0.032, 0.114]} rotation={[-0.22, 0, 0]} material={mats.skinMat}>
                <boxGeometry args={[0.022, 0.044, 0.026]} />
              </mesh>
              <mesh position={[0.104, 0.036, -0.006]} scale={[0.45, 1.0, 0.72]} material={mats.skinMat}>
                <sphereGeometry args={[0.026, 8, 8]} />
              </mesh>
              <mesh position={[-0.104, 0.036, -0.006]} scale={[0.45, 1.0, 0.72]} material={mats.skinMat}>
                <sphereGeometry args={[0.026, 8, 8]} />
              </mesh>
              <mesh
                position={[0, 0.112, -0.008]}
                scale={[0.9, 0.58, 0.98]}
                material={mats.hairMat}
                castShadow
              >
                <sphereGeometry args={[0.126, 14, 12]} />
              </mesh>
              <mesh
                position={[0, 0.056, -0.052]}
                scale={[0.89, 0.86, 0.78]}
                material={mats.hairMat}
              >
                <sphereGeometry args={[0.12, 14, 12]} />
              </mesh>
              <mesh
                position={[0, 0.118, 0.062]}
                rotation={[0.25, 0, 0]}
                scale={[1.0, 0.42, 0.65]}
                material={mats.hairMat}
              >
                <sphereGeometry args={[0.078, 12, 8]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
});
