import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { BEAST_DIFFICULTY_PROFILES } from '../../data/beastConfig';
import {
  ALL_DOORS,
  BUILDING_FLOORS,
  COMPOUND_GATE_POS,
  EXTERIOR_PLAYER_SPAWN,
  FLOOR_ELEVATIONS,
  getActiveMissionFrame,
  getActivePuzzleFrame,
  GROUND_ESCAPE_ZONE,
  LOBBY_RESPAWN_POS,
  MAIN_ENTRANCE_POS,
  MISSION_KEY_CELLS,
  MISSION_ROOM_BOUNDS,
  PUZZLE_CHAMBER_BOUNDS,
  PUZZLE_TERMINALS,
  roomLocalToWorld,
} from '../../data/buildingLayout';
import { getHidingSpotById, HIDING_SPOTS_BY_FLOOR } from '../../data/hidingSpots';
import { useGameStore } from '../../store/useGameStore';
import { canBeastSeePlayer } from '../../three/beastNavigation';
import {
  hasLineOfSightOnFloor,
  resolvePlayerMovement,
} from '../../three/collision';
import {
  getFloorFromElevation,
  resolveSurfaceElevation,
} from '../../three/floorNavigation';
import {
  beastWorldPos,
  beastWorldPositions,
  playerWorldPos,
  triggerPlayerActionAnim,
  virtualInput,
  worldDirToCharacterYaw,
} from '../../three/playerWorldState';
import { emitSoundEvent } from '../../three/soundBus';
import {
  initAudioContext,
  playBeastAlertSiren,
  playCompoundGateSound,
  playDoorSound,
  playHeavyMainEntranceSound,
  playIntroWindAmbience,
  playJumpLandSound,
  playKeypadBeep,
  playLockedDoorSound,
  playPlayerFootstepSound,
} from '../../three/soundEffects';
import {
  getIntroSegmentMeta,
  INTRO_DURATION_SECONDS,
  sampleIntroCameraPose,
} from '../../three/introCameraPath';
import {
  CAMERA_MAX_PITCH,
  CAMERA_MIN_PITCH,
  resolveThirdPersonCameraPosition,
} from '../../three/thirdPersonCamera';
import { BeastId } from '../../types/game';

const CROUCH_SPEED = 3.35;
const MOVE_SPEED = 5.8;
const SPRINT_SPEED = 8.6;
const JUMP_VELOCITY = 5.4;
const JUMP_GRAVITY = 16.8;
const MAX_JUMP_HEIGHT = 0.92;
const ACCEL_LAMBDA = 16.0; // Crisp, natural acceleration (95% speed in ~0.18s)
const DECEL_LAMBDA = 18.0; // Tight, natural stop without sliding or popping
const SPRINT_BLEND_LAMBDA = 10.5; // Smooth walk <-> sprint speed & gait transition
const INTERACT_RANGE = 2.45;
const HIDE_INTERACT_RANGE = 2.25;
const HIDING_EYE_HEIGHT = 1.38;
const HIDING_MAX_PEEK_YAW = 0.85; // ±48° peek through wardrobe/cabinet slats
const DEFAULT_THIRD_PERSON_PITCH = 0.14;

/** Stride phase radians per meter traveled — prevents foot sliding across walk/run/sprint */
const WALK_STRIDE_RAD_PER_METER = 2.45;
const SPRINT_STRIDE_RAD_PER_METER = 2.15;

// Pre-allocated math helpers (Zero GC in useFrame)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _camPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

function normalizeAngleDelta(target: number, current: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export const PlayerController: React.FC = () => {
  const { camera, gl } = useThree();
  const controlMode = useGameStore((s) => s.controlMode);
  const playerSpawnTarget = useGameStore((s) => s.playerSpawnTarget);
  const playerSpawnTrigger = useGameStore((s) => s.playerSpawnTrigger);

  const isPlayableMode = controlMode !== 'orbit';

  const posRef = useRef({
    x: EXTERIOR_PLAYER_SPAWN[0],
    feetY: FLOOR_ELEVATIONS[1],
    z: EXTERIOR_PLAYER_SPAWN[2],
  });
  const velRef = useRef({ x: 0, z: 0 });
  const sprintBlendRef = useRef(0);
  const smoothedSpeedRef = useRef(0);
  const yawRef = useRef(0);
  const pitchRef = useRef(DEFAULT_THIRD_PERSON_PITCH);
  const characterYawRef = useRef(Math.PI);
  const targetCharacterYawRef = useRef(Math.PI);
  const hiddenCenterYawRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const dragLookRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const lastPromptRef = useRef<string | null>(null);
  const ePressedLockRef = useRef(false);
  const spacePressedLockRef = useRef(false);
  const cPressedLockRef = useRef(false);
  const lastStepHalfCycleRef = useRef(0);
  const footstepCooldownRef = useRef(0);
  const entryCineTimerRef = useRef(0);
  const jumpOffsetRef = useRef(0);
  const jumpVelRef = useRef(0);
  const crouchBlendRef = useRef(0);
  const lobbyClockRef = useRef(0);
  const lobbyDragRef = useRef(false);
  const introClockRef = useRef(0);
  const lastIntroTriggerRef = useRef(0);
  const lastIntroSegRef = useRef(-1);
  const handleInteractRef = useRef<() => void>(() => {});
  const handleHideActionRef = useRef<() => void>(() => {});

  // Smooth third-person camera state (instant pull-in on wall hit, smooth ease-out when clear)
  const camStateRef = useRef({
    initialized: false,
    x: EXTERIOR_PLAYER_SPAWN[0] + 0.4,
    y: FLOOR_ELEVATIONS[1] + 2.15,
    z: EXTERIOR_PLAYER_SPAWN[2] + 3.0,
    lookX: EXTERIOR_PLAYER_SPAWN[0],
    lookY: FLOOR_ELEVATIONS[1] + 1.45,
    lookZ: EXTERIOR_PLAYER_SPAWN[2] - 4.0,
    currentDist: 3.0,
  });

  // Sync player spawn point & third-person camera on initial mount, floor quick-jump, or New Game / Respawn
  useEffect(() => {
    if (!isPlayableMode) return;

    if (playerSpawnTarget === 'f2-mission') {
      const mFrame = getActiveMissionFrame();
      const [sx, sz] = roomLocalToWorld(0, 7.5, mFrame);
      posRef.current = { x: sx, feetY: mFrame.elevation, z: sz };
      yawRef.current = mFrame.rotY;
      pitchRef.current = DEFAULT_THIRD_PERSON_PITCH;
    } else if (playerSpawnTarget === 'f3-puzzle') {
      const pFrame = getActivePuzzleFrame();
      const [sx, sz] = roomLocalToWorld(0, 7.5, pFrame);
      posRef.current = { x: sx, feetY: pFrame.elevation, z: sz };
      yawRef.current = pFrame.rotY;
      pitchRef.current = DEFAULT_THIRD_PERSON_PITCH;
    } else if (playerSpawnTarget === 'f4-exit') {
      posRef.current = { x: 0.0, feetY: FLOOR_ELEVATIONS[4], z: 14.8 };
      yawRef.current = Math.PI;
      pitchRef.current = DEFAULT_THIRD_PERSON_PITCH;
    } else if (playerSpawnTarget === 'f1-lobby') {
      posRef.current = {
        x: LOBBY_RESPAWN_POS[0],
        feetY: FLOOR_ELEVATIONS[1],
        z: LOBBY_RESPAWN_POS[2],
      };
      yawRef.current = 0;
      pitchRef.current = DEFAULT_THIRD_PERSON_PITCH;
    } else {
      // Spawn outside the compound gate on the abandoned city boulevard looking North toward LAST EXIT
      posRef.current = {
        x: EXTERIOR_PLAYER_SPAWN[0],
        feetY: FLOOR_ELEVATIONS[1],
        z: EXTERIOR_PLAYER_SPAWN[2],
      };
      yawRef.current = 0;
      pitchRef.current = DEFAULT_THIRD_PERSON_PITCH;
    }

    velRef.current.x = 0;
    velRef.current.z = 0;
    sprintBlendRef.current = 0;
    smoothedSpeedRef.current = 0;
    lastStepHalfCycleRef.current = Math.floor(playerWorldPos.walkPhase / Math.PI);
    footstepCooldownRef.current = 0;
    entryCineTimerRef.current = 0;

    // Face character in the same forward direction the third-person camera is looking
    const initialCharYaw = yawRef.current + Math.PI;
    characterYawRef.current = initialCharYaw;
    targetCharacterYawRef.current = initialCharYaw;

    keysRef.current = {};
    dragLookRef.current = false;
    ePressedLockRef.current = false;
    spacePressedLockRef.current = false;
    cPressedLockRef.current = false;
    jumpOffsetRef.current = 0;
    jumpVelRef.current = 0;
    crouchBlendRef.current = 0;

    playerWorldPos.x = posRef.current.x;
    playerWorldPos.feetY = posRef.current.feetY;
    playerWorldPos.z = posRef.current.z;
    playerWorldPos.vx = 0;
    playerWorldPos.vz = 0;
    playerWorldPos.yaw = yawRef.current;
    playerWorldPos.pitch = pitchRef.current;
    playerWorldPos.characterYaw = initialCharYaw;
    playerWorldPos.targetCharacterYaw = initialCharYaw;
    playerWorldPos.isMoving = false;
    playerWorldPos.isSprinting = false;
    playerWorldPos.sprintBlend = 0;
    playerWorldPos.isTurning = false;
    playerWorldPos.turnRate = 0;
    playerWorldPos.speed = 0;
    playerWorldPos.moveRatio = 0;
    playerWorldPos.verticalVelocity = 0;
    playerWorldPos.isGrounded = true;
    playerWorldPos.isCrouching = false;
    playerWorldPos.crouchBlend = 0;
    playerWorldPos.jumpOffsetY = 0;
    playerWorldPos.jumpVelocity = 0;
    playerWorldPos.isHidden = false;
    playerWorldPos.hiddenSpotId = null;

    const store = useGameStore.getState();
    const detectedFloor = getFloorFromElevation(posRef.current.feetY);
    store.setPlayerFloor(detectedFloor);

    // Snap third-person camera cleanly to collision-safe shoulder position on spawn/respawn
    const solved = resolveThirdPersonCameraPosition({
      playerX: posRef.current.x,
      playerFeetY: posRef.current.feetY,
      playerZ: posRef.current.z,
      yaw: yawRef.current,
      pitch: pitchRef.current,
      desiredDistance: store.cameraDistance,
      doorStates: store.doorStates,
      compoundGateOpen: store.compoundGateState === 'open',
      mainEntranceOpen: store.mainEntranceState === 'open',
    });

    camStateRef.current = {
      initialized: true,
      x: solved.camX,
      y: solved.camY,
      z: solved.camZ,
      lookX: solved.lookX,
      lookY: solved.lookY,
      lookZ: solved.lookZ,
      currentDist: solved.effectiveDistance,
    };

    playerWorldPos.cameraPos.x = solved.camX;
    playerWorldPos.cameraPos.y = solved.camY;
    playerWorldPos.cameraPos.z = solved.camZ;
    playerWorldPos.cameraEffectiveDist = solved.effectiveDistance;

    camera.position.set(solved.camX, solved.camY, solved.camZ);
    camera.lookAt(solved.lookX, solved.lookY, solved.lookZ);
  }, [camera, isPlayableMode, playerSpawnTarget, playerSpawnTrigger]);

  // Pointer Lock + Fallback Drag Mouse Look + Keyboard Listeners
  useEffect(() => {
    if (!isPlayableMode) return;

    const canvas = gl.domElement;

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      useGameStore.getState().setPointerLocked(locked);
    };

    const isInputBlocked = () => {
      const st = useGameStore.getState();
      return (
        st.inMainMenu ||
        st.gamePaused ||
        st.beastCapturing ||
        st.puzzleModalOpen ||
        st.activeKeyCellModal !== null ||
        st.escaped ||
        st.escapeAnimating ||
        st.progression === 'PLAYER_CAUGHT'
      );
    };

    const applyLookDelta = (deltaYaw: number, deltaPitch: number) => {
      const st = useGameStore.getState();
      let nextYaw = yawRef.current - deltaYaw;
      if (st.playerHiddenSpotId) {
        const diffFromCenter = normalizeAngleDelta(nextYaw, hiddenCenterYawRef.current);
        const clampedDiff = THREE.MathUtils.clamp(
          diffFromCenter,
          -HIDING_MAX_PEEK_YAW,
          HIDING_MAX_PEEK_YAW
        );
        nextYaw = hiddenCenterYawRef.current + clampedDiff;
      }
      yawRef.current = nextYaw;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current + deltaPitch,
        st.playerHiddenSpotId ? -0.35 : CAMERA_MIN_PITCH,
        st.playerHiddenSpotId ? 0.35 : CAMERA_MAX_PITCH
      );
    };

    const onMouseMove = (e: MouseEvent) => {
      const st = useGameStore.getState();
      if (st.inMainMenu && st.screenPhase === 'lobby' && lobbyDragRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        virtualInput.lobbyCharacterYaw += dx * 0.009;
        return;
      }
      if (isInputBlocked()) return;

      const sensitivity = st.mouseSensitivity;
      const isLocked = document.pointerLockElement === canvas;
      if (isLocked) {
        applyLookDelta(e.movementX * 0.0024 * sensitivity, e.movementY * 0.0022 * sensitivity);
      } else if (dragLookRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        applyLookDelta(dx * 0.0042 * sensitivity, dy * 0.0038 * sensitivity);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const st = useGameStore.getState();
      if (st.inMainMenu && st.screenPhase === 'lobby') {
        initAudioContext();
        lobbyDragRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
      if (isInputBlocked()) return;
      if (e.target !== canvas) return;

      initAudioContext();
      dragLookRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
        try {
          const maybePromise = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch(() => {});
          }
        } catch {
          // Fallback drag look remains active
        }
      }
    };

    const onMouseUp = () => {
      dragLookRef.current = false;
      lobbyDragRef.current = false;
    };

    const onTouchStartLook = (e: TouchEvent) => {
      if (e.target !== canvas || e.touches.length === 0) return;
      const touch = e.touches[0];
      const st = useGameStore.getState();
      if (st.inMainMenu && st.screenPhase === 'lobby') {
        lobbyDragRef.current = true;
        lastMouseRef.current = { x: touch.clientX, y: touch.clientY };
        return;
      }
      if (isInputBlocked()) return;
      initAudioContext();
      dragLookRef.current = true;
      lastMouseRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const onTouchMoveLook = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const st = useGameStore.getState();
      if (st.inMainMenu && st.screenPhase === 'lobby' && lobbyDragRef.current) {
        const dx = touch.clientX - lastMouseRef.current.x;
        lastMouseRef.current = { x: touch.clientX, y: touch.clientY };
        virtualInput.lobbyCharacterYaw += dx * 0.011;
        return;
      }
      if (!dragLookRef.current || isInputBlocked()) return;
      const sensitivity = st.mouseSensitivity;
      const dx = touch.clientX - lastMouseRef.current.x;
      const dy = touch.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: touch.clientX, y: touch.clientY };
      applyLookDelta(dx * 0.005 * sensitivity, dy * 0.004 * sensitivity);
    };

    const onTouchEndLook = () => {
      dragLookRef.current = false;
      lobbyDragRef.current = false;
    };

    const faceWorldTarget = (tx: number, tz: number) => {
      const dx = tx - posRef.current.x;
      const dz = tz - posRef.current.z;
      if (dx * dx + dz * dz > 1e-4) {
        targetCharacterYawRef.current = worldDirToCharacterYaw(dx, dz);
      }
    };

    const handleInteractKey = () => {
      const state = useGameStore.getState();
      if (isInputBlocked()) return;

      // 0B. Exterior Compound Gate & Main Apartment Entrance Doorway
      if (state.nearbyExteriorInteract === 'compound-gate') {
        faceWorldTarget(COMPOUND_GATE_POS[0], COMPOUND_GATE_POS[2]);
        triggerPlayerActionAnim('door-interact', 0.6);
        if (state.tryOpenCompoundGate()) {
          playCompoundGateSound(true, state.audioEnabled);
        }
        return;
      }
      if (state.nearbyExteriorInteract === 'main-entrance') {
        faceWorldTarget(MAIN_ENTRANCE_POS[0], MAIN_ENTRANCE_POS[2]);
        triggerPlayerActionAnim('door-interact', 0.7);
        if (state.tryOpenMainEntrance()) {
          playHeavyMainEntranceSound(state.audioEnabled);
          entryCineTimerRef.current = 1.9;
        }
        return;
      }

      // 0. If currently hidden, pressing E immediately exits hiding smoothly
      if (state.playerHiddenSpotId) {
        const spot = getHidingSpotById(state.playerHiddenSpotId);
        if (spot) {
          posRef.current.x = spot.exitPos[0];
          posRef.current.feetY = spot.exitPos[1];
          posRef.current.z = spot.exitPos[2];
          velRef.current.x = 0;
          velRef.current.z = 0;
          yawRef.current = spot.lookYaw;
          pitchRef.current = DEFAULT_THIRD_PERSON_PITCH;
          const exitCharYaw = spot.lookYaw + Math.PI;
          characterYawRef.current = exitCharYaw;
          targetCharacterYawRef.current = exitCharYaw;
        }
        state.exitHidingSpot();
        return;
      }

      // 1. Nearby Hiding Spot entry ("PRESS E TO HIDE")
      if (state.nearbyHidingSpotId) {
        const spot = getHidingSpotById(state.nearbyHidingSpotId);
        if (spot) {
          const dist = Math.hypot(
            spot.exitPos[0] - posRef.current.x,
            spot.exitPos[2] - posRef.current.z
          );
          if (Math.abs(spot.exitPos[1] - posRef.current.feetY) < 1.5 && dist <= HIDE_INTERACT_RANGE + 0.35) {
            const witnessedBy: BeastId[] = [];
            const visionProfile = BEAST_DIFFICULTY_PROFILES.mission;
            for (const b of beastWorldPositions) {
              if (
                canBeastSeePlayer({
                  beastX: b.x,
                  beastY: b.feetY,
                  beastZ: b.z,
                  beastYaw: b.yaw,
                  playerX: posRef.current.x,
                  playerY: posRef.current.feetY,
                  playerZ: posRef.current.z,
                  visionRange: visionProfile.visionRange,
                  visionFovDeg: visionProfile.visionFovDeg,
                  proximitySenseRadius: visionProfile.proximitySenseRadius,
                  doorStates: state.doorStates,
                  playerHidden: false,
                  puzzleRoomProtected: state.puzzleProtectionActive,
                })
              ) {
                witnessedBy.push(b.id);
              }
            }

            posRef.current.x = spot.hidePos[0];
            posRef.current.feetY = spot.hidePos[1];
            posRef.current.z = spot.hidePos[2];
            velRef.current.x = 0;
            velRef.current.z = 0;
            hiddenCenterYawRef.current = spot.lookYaw;
            yawRef.current = spot.lookYaw;
            pitchRef.current = 0;
            const hideCharYaw = spot.lookYaw + Math.PI;
            characterYawRef.current = hideCharYaw;
            targetCharacterYawRef.current = hideCharYaw;
            keysRef.current = {};
            state.enterHidingSpot(spot.id, witnessedBy);
            return;
          }
        }
      }

      // 2. Nearby door interaction
      if (state.nearbyDoorId) {
        const door = ALL_DOORS.find((d) => d.id === state.nearbyDoorId);
        if (!door) return;

        const curFloor = getFloorFromElevation(posRef.current.feetY);
        const dist = Math.hypot(door.position[0] - posRef.current.x, door.position[2] - posRef.current.z);
        if (
          Math.abs(door.position[1] - posRef.current.feetY) > 1.6 ||
          dist > INTERACT_RANGE + 0.2 ||
          !hasLineOfSightOnFloor(posRef.current.x, posRef.current.z, door.position[0], door.position[2], curFloor)
        ) {
          return;
        }

        faceWorldTarget(door.position[0], door.position[2]);
        triggerPlayerActionAnim('door-interact', 0.55);

        const result = state.tryUnlockSpecialDoor(door.id);
        if (result.opened) {
          playDoorSound(true, state.audioEnabled);
          emitSoundEvent({
            x: door.position[0],
            y: door.position[1],
            z: door.position[2],
            floor: curFloor,
            kind: 'door-unlock',
          });
        } else {
          playLockedDoorSound(state.audioEnabled);
          emitSoundEvent({
            x: door.position[0],
            y: door.position[1],
            z: door.position[2],
            floor: curFloor,
            kind: 'door-locked',
          });
        }
        return;
      }

      // 3. Mission Room Key Cell Locker / Physical Key Pickup
      if (state.nearbyKeyCellId && state.missionRoomEntered) {
        const cell = MISSION_KEY_CELLS.find((c) => c.id === state.nearbyKeyCellId);
        if (!cell) return;
        const cellState = state.keyCells[cell.id];
        if (!cellState) return;

        const curFloor = getFloorFromElevation(posRef.current.feetY);
        const targetPos = cellState.unlocked ? cell.keyPosition : cell.keypadPosition;
        const dist = Math.hypot(
          targetPos[0] - posRef.current.x,
          targetPos[2] - posRef.current.z
        );
        if (
          Math.abs(cell.position[1] - posRef.current.feetY) > 1.6 ||
          dist > INTERACT_RANGE + 0.2 ||
          !hasLineOfSightOnFloor(
            posRef.current.x,
            posRef.current.z,
            targetPos[0],
            targetPos[2],
            curFloor
          )
        ) {
          return;
        }

        faceWorldTarget(targetPos[0], targetPos[2]);

        if (!cellState.unlocked) {
          triggerPlayerActionAnim('puzzle-interact', 0.65);
          playKeypadBeep(620, state.audioEnabled);
          state.openKeyCellModal(cell.id);
        } else if (!cellState.keyCollected) {
          triggerPlayerActionAnim('key-pickup', 0.65);
          state.collectKeyFromCell(cell.id);
        }
        return;
      }

      // 4. Puzzle Room terminal interaction
      if (state.nearbyPuzzleTerminalId && state.puzzleRoomEntered) {
        const term = PUZZLE_TERMINALS.find((t) => t.id === state.nearbyPuzzleTerminalId);
        if (term) {
          faceWorldTarget(term.position[0], term.position[2]);
        }
        triggerPlayerActionAnim('puzzle-interact', 0.7);
        playKeypadBeep(620, state.audioEnabled);
        emitSoundEvent({
          x: posRef.current.x,
          y: posRef.current.feetY,
          z: posRef.current.z,
          floor: getFloorFromElevation(posRef.current.feetY),
          kind: 'puzzle-loud',
        });
        state.openPuzzleModal();
      }
    };

    const tryHideOrExit = () => {
      const state = useGameStore.getState();
      if (isInputBlocked()) return;

      if (state.playerHiddenSpotId) {
        const spot = getHidingSpotById(state.playerHiddenSpotId);
        if (spot) {
          posRef.current.x = spot.exitPos[0];
          posRef.current.feetY = spot.exitPos[1];
          posRef.current.z = spot.exitPos[2];
          velRef.current.x = 0;
          velRef.current.z = 0;
          yawRef.current = spot.lookYaw;
          pitchRef.current = DEFAULT_THIRD_PERSON_PITCH;
          const exitCharYaw = spot.lookYaw + Math.PI;
          characterYawRef.current = exitCharYaw;
          targetCharacterYawRef.current = exitCharYaw;
        }
        state.exitHidingSpot();
        return;
      }

      if (state.nearbyHidingSpotId) {
        const spot = getHidingSpotById(state.nearbyHidingSpotId);
        if (spot) {
          const dist = Math.hypot(
            spot.exitPos[0] - posRef.current.x,
            spot.exitPos[2] - posRef.current.z
          );
          if (Math.abs(spot.exitPos[1] - posRef.current.feetY) < 1.5 && dist <= HIDE_INTERACT_RANGE + 0.35) {
            const witnessedBy: BeastId[] = [];
            const visionProfile = BEAST_DIFFICULTY_PROFILES.mission;
            for (const b of beastWorldPositions) {
              if (
                canBeastSeePlayer({
                  beastX: b.x,
                  beastY: b.feetY,
                  beastZ: b.z,
                  beastYaw: b.yaw,
                  playerX: posRef.current.x,
                  playerY: posRef.current.feetY,
                  playerZ: posRef.current.z,
                  visionRange: visionProfile.visionRange,
                  visionFovDeg: visionProfile.visionFovDeg,
                  proximitySenseRadius: visionProfile.proximitySenseRadius,
                  doorStates: state.doorStates,
                  playerHidden: false,
                  puzzleRoomProtected: state.puzzleProtectionActive,
                })
              ) {
                witnessedBy.push(b.id);
              }
            }

            posRef.current.x = spot.hidePos[0];
            posRef.current.feetY = spot.hidePos[1];
            posRef.current.z = spot.hidePos[2];
            velRef.current.x = 0;
            velRef.current.z = 0;
            jumpOffsetRef.current = 0;
            jumpVelRef.current = 0;
            state.setCrouch(false);
            hiddenCenterYawRef.current = spot.lookYaw;
            yawRef.current = spot.lookYaw;
            pitchRef.current = 0;
            const hideCharYaw = spot.lookYaw + Math.PI;
            characterYawRef.current = hideCharYaw;
            targetCharacterYawRef.current = hideCharYaw;
            keysRef.current = {};
            state.enterHidingSpot(spot.id, witnessedBy);
          }
        }
      }
    };

    handleInteractRef.current = handleInteractKey;
    handleHideActionRef.current = tryHideOrExit;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysRef.current[e.code] = true;

      if (e.code === 'KeyE' && !ePressedLockRef.current) {
        ePressedLockRef.current = true;
        handleInteractKey();
      } else if (e.code === 'Space' && !spacePressedLockRef.current) {
        spacePressedLockRef.current = true;
        if (!isInputBlocked() && !useGameStore.getState().playerHiddenSpotId) {
          virtualInput.jumpQueued = true;
        }
      } else if (e.code === 'KeyC' && !cPressedLockRef.current) {
        cPressedLockRef.current = true;
        const st = useGameStore.getState();
        if (!isInputBlocked() && st.controlMode !== 'orbit') {
          st.toggleCrouch();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
      if (e.code === 'KeyE') {
        ePressedLockRef.current = false;
      } else if (e.code === 'Space') {
        spacePressedLockRef.current = false;
      } else if (e.code === 'KeyC') {
        cPressedLockRef.current = false;
      }
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStartLook, { passive: true });
    window.addEventListener('touchmove', onTouchMoveLook, { passive: true });
    window.addEventListener('touchend', onTouchEndLook);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStartLook);
      window.removeEventListener('touchmove', onTouchMoveLook);
      window.removeEventListener('touchend', onTouchEndLook);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
      useGameStore.getState().setPointerLocked(false);
    };
  }, [isPlayableMode, gl]);

  // Movement, Collision, Character Facing, Third-Person Camera, Hiding Peek, Ground Escape & Triggers
  useFrame((_, rawDelta) => {
    if (!isPlayableMode) return;

    const delta = Math.min(rawDelta, 0.05);
    const state = useGameStore.getState();

    // 0. Cinematic Loading Screen & Interactive 3D Third-Person Player Lobby Staging
    if (state.inMainMenu) {
      lobbyClockRef.current += delta;
      const sx = EXTERIOR_PLAYER_SPAWN[0];
      const sy = FLOOR_ELEVATIONS[1];
      const sz = EXTERIOR_PLAYER_SPAWN[2];

      posRef.current.x = sx;
      posRef.current.feetY = sy;
      posRef.current.z = sz;
      velRef.current.x = 0;
      velRef.current.z = 0;
      jumpOffsetRef.current = 0;
      jumpVelRef.current = 0;
      crouchBlendRef.current = 0;

      playerWorldPos.x = sx;
      playerWorldPos.feetY = sy;
      playerWorldPos.z = sz;
      playerWorldPos.vx = 0;
      playerWorldPos.vz = 0;
      playerWorldPos.isMoving = false;
      playerWorldPos.isSprinting = false;
      playerWorldPos.sprintBlend = 0;
      playerWorldPos.speed = 0;
      playerWorldPos.moveRatio = 0;
      playerWorldPos.isCrouching = false;
      playerWorldPos.crouchBlend = 0;
      playerWorldPos.jumpOffsetY = 0;
      playerWorldPos.jumpVelocity = 0;
      playerWorldPos.isGrounded = true;
      playerWorldPos.characterYaw = virtualInput.lobbyCharacterYaw;
      playerWorldPos.targetCharacterYaw = virtualInput.lobbyCharacterYaw;

      if (state.screenPhase === 'intro') {
        if (lastIntroTriggerRef.current !== state.introSequenceTrigger) {
          lastIntroTriggerRef.current = state.introSequenceTrigger;
          introClockRef.current = 0;
          lastIntroSegRef.current = -1;
        }
        introClockRef.current = Math.min(
          INTRO_DURATION_SECONDS,
          introClockRef.current + delta
        );

        playerWorldPos.characterYaw = Math.PI;
        playerWorldPos.targetCharacterYaw = Math.PI;
        characterYawRef.current = Math.PI;
        targetCharacterYawRef.current = Math.PI;
        yawRef.current = 0;
        pitchRef.current = DEFAULT_THIRD_PERSON_PITCH;

        const exactEndPose = resolveThirdPersonCameraPosition({
          playerX: sx,
          playerFeetY: sy,
          playerZ: sz,
          yaw: 0,
          pitch: DEFAULT_THIRD_PERSON_PITCH,
          desiredDistance: state.cameraDistance,
          doorStates: state.doorStates,
          compoundGateOpen: state.compoundGateState === 'open',
          mainEntranceOpen: state.mainEntranceState === 'open',
        });

        sampleIntroCameraPose(introClockRef.current, exactEndPose, _camPos, _lookTarget);
        camera.position.copy(_camPos);
        camera.lookAt(_lookTarget);

        const cs = camStateRef.current;
        cs.initialized = true;
        cs.x = _camPos.x;
        cs.y = _camPos.y;
        cs.z = _camPos.z;
        cs.lookX = _lookTarget.x;
        cs.lookY = _lookTarget.y;
        cs.lookZ = _lookTarget.z;
        cs.currentDist = exactEndPose.effectiveDistance;

        const segMeta = getIntroSegmentMeta(introClockRef.current);
        state.setIntroUiProgress(segMeta.index, segMeta.showDirective);
        if (lastIntroSegRef.current !== segMeta.index) {
          lastIntroSegRef.current = segMeta.index;
          playIntroWindAmbience(state.audioEnabled, segMeta.index === 3);
        }

        if (introClockRef.current >= INTRO_DURATION_SECONDS) {
          state.completeIntroToGameplay();
        }
        return;
      }

      if (state.screenPhase === 'loading') {
        const sway = Math.sin(lobbyClockRef.current * 0.25) * 1.15;
        camera.position.set(sx + 1.4 + sway, sy + 2.3, sz + 6.4);
        camera.lookAt(sx, sy + 2.1, 44.0);
      } else {
        // Frame the breathing survivor prominently center-right with the sunlit abandoned avenue & LAST BREATH building behind
        const camSw = Math.sin(lobbyClockRef.current * 0.35) * 0.04;
        camera.position.set(sx + 0.32 + camSw, sy + 1.32, sz + 3.48);
        camera.lookAt(sx - 0.36, sy + 1.04, sz);
      }
      return;
    }

    // 1. Beast Capture Camera Lock: frame BOTH the survivor and the capturing Warrior Hunter
    if (state.beastCapturing) {
      keysRef.current = {};
      velRef.current.x = 0;
      velRef.current.z = 0;
      sprintBlendRef.current = 0;
      smoothedSpeedRef.current = 0;
      jumpOffsetRef.current = 0;
      jumpVelRef.current = 0;
      crouchBlendRef.current = 0;
      playerWorldPos.vx = 0;
      playerWorldPos.vz = 0;
      playerWorldPos.isMoving = false;
      playerWorldPos.isSprinting = false;
      playerWorldPos.sprintBlend = 0;
      playerWorldPos.speed = 0;
      playerWorldPos.moveRatio = 0;
      playerWorldPos.isCrouching = false;
      playerWorldPos.crouchBlend = 0;
      playerWorldPos.jumpOffsetY = 0;
      playerWorldPos.jumpVelocity = 0;

      const dx = beastWorldPos.x - posRef.current.x;
      const dz = beastWorldPos.z - posRef.current.z;
      const desiredCamYaw = Math.atan2(-dx, -dz);
      yawRef.current += normalizeAngleDelta(desiredCamYaw, yawRef.current) * (1 - Math.exp(-9 * delta));
      pitchRef.current = THREE.MathUtils.damp(pitchRef.current, 0.16, 8, delta);

      const faceBeastYaw = worldDirToCharacterYaw(dx, dz);
      characterYawRef.current +=
        normalizeAngleDelta(faceBeastYaw, characterYawRef.current) * (1 - Math.exp(-14 * delta));
      playerWorldPos.characterYaw = characterYawRef.current;

      const solvedCapture = resolveThirdPersonCameraPosition({
        playerX: posRef.current.x,
        playerFeetY: posRef.current.feetY,
        playerZ: posRef.current.z,
        yaw: yawRef.current + 0.36,
        pitch: 0.18,
        desiredDistance: Math.min(2.6, state.cameraDistance),
        doorStates: state.doorStates,
      });

      const cs = camStateRef.current;
      cs.x = THREE.MathUtils.damp(cs.x, solvedCapture.camX, 10, delta);
      cs.y = THREE.MathUtils.damp(cs.y, solvedCapture.camY, 10, delta);
      cs.z = THREE.MathUtils.damp(cs.z, solvedCapture.camZ, 10, delta);

      const midX = (posRef.current.x + beastWorldPos.x) * 0.5;
      const midY = posRef.current.feetY + 1.25;
      const midZ = (posRef.current.z + beastWorldPos.z) * 0.5;
      cs.lookX = THREE.MathUtils.damp(cs.lookX, midX, 12, delta);
      cs.lookY = THREE.MathUtils.damp(cs.lookY, midY, 12, delta);
      cs.lookZ = THREE.MathUtils.damp(cs.lookZ, midZ, 12, delta);

      camera.position.set(cs.x, cs.y, cs.z);
      camera.lookAt(cs.lookX, cs.lookY, cs.lookZ);
      return;
    }

    // Consume queued virtual button actions (touch HUD INTERACT & HIDE)
    if (virtualInput.interactQueued) {
      virtualInput.interactQueued = false;
      handleInteractRef.current();
    }
    if (virtualInput.hideQueued) {
      virtualInput.hideQueued = false;
      handleHideActionRef.current();
    }

    const latestState = useGameStore.getState();
    const isHidden = latestState.playerHiddenSpotId !== null;
    const movementPaused =
      isHidden ||
      latestState.inMainMenu ||
      latestState.gamePaused ||
      latestState.puzzleModalOpen ||
      latestState.activeKeyCellModal !== null ||
      latestState.escaped ||
      latestState.progression === 'PLAYER_CAUGHT';

    const prevFeetY = posRef.current.feetY;

    if (movementPaused) {
      keysRef.current = {};
      virtualInput.jumpQueued = false;
      velRef.current.x = 0;
      velRef.current.z = 0;
      sprintBlendRef.current = 0;
      smoothedSpeedRef.current = 0;
      jumpOffsetRef.current = 0;
      jumpVelRef.current = 0;
      playerWorldPos.vx = 0;
      playerWorldPos.vz = 0;
      playerWorldPos.isMoving = false;
      playerWorldPos.isSprinting = false;
      playerWorldPos.sprintBlend = 0;
      playerWorldPos.speed = 0;
      playerWorldPos.moveRatio = 0;
      playerWorldPos.verticalVelocity = 0;
      playerWorldPos.isGrounded = true;
      playerWorldPos.jumpOffsetY = 0;
      playerWorldPos.jumpVelocity = 0;
    } else {
      const keys = keysRef.current;
      const kbForward =
        (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
        (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
      const kbStrafe =
        (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
        (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);

      const forwardInput = THREE.MathUtils.clamp(kbForward + virtualInput.moveY, -1, 1);
      const strafeInput = THREE.MathUtils.clamp(kbStrafe + virtualInput.moveX, -1, 1);
      const magSq = forwardInput * forwardInput + strafeInput * strafeInput;
      const hasInput = magSq > 0.015;

      const rawSprintHeld = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || virtualInput.sprinting);
      if (rawSprintHeld && hasInput && latestState.playerCrouched) {
        latestState.setCrouch(false);
      }
      const isCrouching = useGameStore.getState().playerCrouched;
      const wantsSprint = hasInput && !isCrouching && rawSprintHeld;

      // Trigger safe vertical jump arc when grounded
      if (virtualInput.jumpQueued) {
        virtualInput.jumpQueued = false;
        if (jumpOffsetRef.current <= 0.02 && playerWorldPos.isGrounded) {
          if (isCrouching) {
            useGameStore.getState().setCrouch(false);
          }
          jumpVelRef.current = JUMP_VELOCITY;
          jumpOffsetRef.current = 0.01;
          playJumpLandSound(true, latestState.audioEnabled);
        }
      }

      // Advance vertical jump arc smoothly with guaranteed ceiling safety
      if (jumpOffsetRef.current > 0 || jumpVelRef.current > 0) {
        jumpVelRef.current -= JUMP_GRAVITY * delta;
        jumpOffsetRef.current += jumpVelRef.current * delta;
        if (jumpOffsetRef.current >= MAX_JUMP_HEIGHT) {
          jumpOffsetRef.current = MAX_JUMP_HEIGHT;
          if (jumpVelRef.current > 0) jumpVelRef.current = 0;
        }
        if (jumpOffsetRef.current <= 0) {
          jumpOffsetRef.current = 0;
          jumpVelRef.current = 0;
          playJumpLandSound(false, latestState.audioEnabled);
        }
      }

      const activeCrouch = useGameStore.getState().playerCrouched && jumpOffsetRef.current <= 0.02;
      crouchBlendRef.current = THREE.MathUtils.damp(
        crouchBlendRef.current,
        activeCrouch ? 1 : 0,
        14,
        delta
      );
      playerWorldPos.isCrouching = activeCrouch;
      playerWorldPos.crouchBlend = crouchBlendRef.current;
      playerWorldPos.jumpOffsetY = jumpOffsetRef.current;
      playerWorldPos.jumpVelocity = jumpVelRef.current;

      // Smooth continuous walk <-> sprint speed blend
      sprintBlendRef.current = THREE.MathUtils.damp(
        sprintBlendRef.current,
        wantsSprint ? 1 : 0,
        SPRINT_BLEND_LAMBDA,
        delta
      );

      let desiredVx = 0;
      let desiredVz = 0;
      if (hasInput) {
        _forward.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
        _right.set(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));
        _move
          .set(0, 0, 0)
          .addScaledVector(_forward, forwardInput)
          .addScaledVector(_right, strafeInput);
        if (_move.lengthSq() > 1) {
          _move.normalize();
        }

        const baseWalkSpeed = THREE.MathUtils.lerp(MOVE_SPEED, CROUCH_SPEED, crouchBlendRef.current);
        const targetSpeed = THREE.MathUtils.lerp(
          baseWalkSpeed,
          SPRINT_SPEED,
          sprintBlendRef.current * (1 - crouchBlendRef.current)
        );
        desiredVx = _move.x * targetSpeed;
        desiredVz = _move.z * targetSpeed;
      }

      // Frame-rate independent smooth horizontal acceleration & deceleration
      const lambda = hasInput ? ACCEL_LAMBDA : DECEL_LAMBDA;
      velRef.current.x = THREE.MathUtils.damp(velRef.current.x, desiredVx, lambda, delta);
      velRef.current.z = THREE.MathUtils.damp(velRef.current.z, desiredVz, lambda, delta);

      const velSq = velRef.current.x * velRef.current.x + velRef.current.z * velRef.current.z;
      let targetFeetY = posRef.current.feetY;
      footstepCooldownRef.current = Math.max(0, footstepCooldownRef.current - delta);

      if (velSq > 0.0025 || hasInput) {
        const prevX = posRef.current.x;
        const prevZ = posRef.current.z;
        const nextX = prevX + velRef.current.x * delta;
        const nextZ = prevZ + velRef.current.z * delta;

        const resolved = resolvePlayerMovement({
          x: nextX,
          z: nextZ,
          feetY: posRef.current.feetY,
          doorStates: state.doorStates,
          isBeast: false,
          puzzleRoomProtected: state.puzzleProtectionActive,
          compoundGateOpen: state.compoundGateState === 'open',
          mainEntranceOpen: state.mainEntranceState === 'open',
        });

        posRef.current.x = resolved.x;
        posRef.current.z = resolved.z;
        targetFeetY = resolved.feetY;

        // Measure actual collision-resolved horizontal displacement so footsteps & stride NEVER slide
        const actualDx = resolved.x - prevX;
        const actualDz = resolved.z - prevZ;
        const actualDist = Math.hypot(actualDx, actualDz);
        const actualSpeed = delta > 1e-4 ? actualDist / delta : 0;

        // Project stored velocity toward collision-resolved displacement so wall contact never builds backlog
        if (delta > 1e-4) {
          const projVx = actualDx / delta;
          const projVz = actualDz / delta;
          velRef.current.x = THREE.MathUtils.damp(velRef.current.x, projVx, 18, delta);
          velRef.current.z = THREE.MathUtils.damp(velRef.current.z, projVz, 18, delta);
        }

        // Smoothly face movement direction
        if (actualDist > 0.002) {
          targetCharacterYawRef.current = worldDirToCharacterYaw(actualDx, actualDz);
        } else if (hasInput) {
          targetCharacterYawRef.current = worldDirToCharacterYaw(_move.x, _move.z);
        }

        smoothedSpeedRef.current = THREE.MathUtils.damp(
          smoothedSpeedRef.current,
          actualSpeed,
          14,
          delta
        );

        const movingNow = smoothedSpeedRef.current > 0.14;
        playerWorldPos.isMoving = movingNow;
        playerWorldPos.isSprinting = movingNow && sprintBlendRef.current > 0.55;
        playerWorldPos.sprintBlend = sprintBlendRef.current;
        playerWorldPos.speed = smoothedSpeedRef.current;
        playerWorldPos.moveRatio = THREE.MathUtils.clamp(
          smoothedSpeedRef.current / SPRINT_SPEED,
          0,
          1
        );

        if (actualDist > 1e-5) {
          const strideRate = THREE.MathUtils.lerp(
            WALK_STRIDE_RAD_PER_METER,
            SPRINT_STRIDE_RAD_PER_METER,
            sprintBlendRef.current
          );
          playerWorldPos.walkPhase += actualDist * strideRate;
        }

        // Synchronize footstep audio directly with visual heel-strike half-cycles of walkPhase (silent while mid-air!)
        const halfCycle = Math.floor(playerWorldPos.walkPhase / Math.PI);
        if (
          movingNow &&
          jumpOffsetRef.current <= 0.04 &&
          halfCycle !== lastStepHalfCycleRef.current &&
          footstepCooldownRef.current <= 0
        ) {
          lastStepHalfCycleRef.current = halfCycle;
          const sprintingStep = sprintBlendRef.current > 0.55 && crouchBlendRef.current < 0.3;
          const crouchStep = crouchBlendRef.current > 0.45;
          footstepCooldownRef.current = sprintingStep ? 0.22 : crouchStep ? 0.44 : 0.34;
          if (!crouchStep) {
            playPlayerFootstepSound(sprintingStep, state.audioEnabled);
          }
          emitSoundEvent({
            x: posRef.current.x,
            y: posRef.current.feetY,
            z: posRef.current.z,
            floor: resolved.floor,
            kind: sprintingStep
              ? 'footstep-sprint'
              : crouchStep
                ? 'footstep-crouch'
                : 'footstep-walk',
          });
        }
      } else {
        velRef.current.x = 0;
        velRef.current.z = 0;
        smoothedSpeedRef.current = THREE.MathUtils.damp(smoothedSpeedRef.current, 0, 16, delta);
        if (smoothedSpeedRef.current < 0.02) smoothedSpeedRef.current = 0;

        targetFeetY = resolveSurfaceElevation(
          posRef.current.x,
          posRef.current.z,
          posRef.current.feetY
        );
        playerWorldPos.isMoving = false;
        playerWorldPos.isSprinting = false;
        playerWorldPos.sprintBlend = sprintBlendRef.current;
        playerWorldPos.speed = smoothedSpeedRef.current;
        playerWorldPos.moveRatio = THREE.MathUtils.clamp(
          smoothedSpeedRef.current / SPRINT_SPEED,
          0,
          1
        );
        lastStepHalfCycleRef.current = Math.floor(playerWorldPos.walkPhase / Math.PI);
      }

      posRef.current.feetY = THREE.MathUtils.damp(
        posRef.current.feetY,
        targetFeetY,
        24,
        delta
      );

      const vertVel = delta > 1e-4 ? (posRef.current.feetY - prevFeetY) / delta : 0;
      playerWorldPos.verticalVelocity = vertVel + jumpVelRef.current;
      playerWorldPos.isGrounded =
        jumpOffsetRef.current <= 0.02 && Math.abs(posRef.current.feetY - targetFeetY) < 0.18;
    }

    // Smoothly turn the 3D human character toward its target facing direction (frame-rate independent)
    const charYawDiff = normalizeAngleDelta(targetCharacterYawRef.current, characterYawRef.current);
    const turnSpeed = playerWorldPos.isMoving ? 14.5 : 10.5;
    const stepYaw = charYawDiff * (1 - Math.exp(-turnSpeed * delta));
    characterYawRef.current += stepYaw;
    const yawRate = delta > 1e-4 ? stepYaw / delta : 0;

    // Publish actual physical player character coordinates (PlayerCharacter, Beast AI & audio read these!)
    playerWorldPos.x = posRef.current.x;
    playerWorldPos.feetY = posRef.current.feetY;
    playerWorldPos.z = posRef.current.z;
    playerWorldPos.vx = velRef.current.x;
    playerWorldPos.vz = velRef.current.z;
    playerWorldPos.yaw = yawRef.current;
    playerWorldPos.pitch = pitchRef.current;
    playerWorldPos.characterYaw = characterYawRef.current;
    playerWorldPos.targetCharacterYaw = targetCharacterYawRef.current;
    playerWorldPos.turnRate = yawRate;
    playerWorldPos.isTurning = Math.abs(charYawDiff) > 0.12;
    playerWorldPos.isHidden = isHidden;
    playerWorldPos.hiddenSpotId = state.playerHiddenSpotId;

    const liveFloor = getFloorFromElevation(posRef.current.feetY);
    if (liveFloor !== state.playerFloor) {
      state.setPlayerFloor(liveFloor);
    }

    // 2. Camera Update: Slatted Peek Camera while Hiding, Smooth Third-Person Shoulder Camera otherwise
    const cs = camStateRef.current;

    if (isHidden) {
      const targetX = posRef.current.x;
      const targetY = posRef.current.feetY + HIDING_EYE_HEIGHT;
      const targetZ = posRef.current.z;
      cs.x = THREE.MathUtils.damp(cs.x, targetX, 15, delta);
      cs.y = THREE.MathUtils.damp(cs.y, targetY, 15, delta);
      cs.z = THREE.MathUtils.damp(cs.z, targetZ, 15, delta);
      camera.position.set(cs.x, cs.y, cs.z);

      _euler.set(-pitchRef.current, yawRef.current, 0, 'YXZ');
      camera.quaternion.setFromEuler(_euler);

      playerWorldPos.cameraPos.x = cs.x;
      playerWorldPos.cameraPos.y = cs.y;
      playerWorldPos.cameraPos.z = cs.z;
      playerWorldPos.cameraEffectiveDist = 0;

      const hiddenPrompt = 'PRESS E TO EXIT HIDING';
      const promptKey = `${hiddenPrompt}||||${state.playerHiddenSpotId ?? ''}`;
      if (lastPromptRef.current !== promptKey) {
        lastPromptRef.current = promptKey;
        state.setInteractionPrompt(hiddenPrompt, null, null, null, state.playerHiddenSpotId);
      }
      return;
    }

    // Subtle interior threshold reveal when Main Entrance first opens
    let desiredCamDist = state.cameraDistance;
    if (state.entryCinematicActive) {
      if (entryCineTimerRef.current <= 0) {
        state.finishEntryCinematic();
      } else {
        entryCineTimerRef.current = Math.max(0, entryCineTimerRef.current - delta);
        yawRef.current += normalizeAngleDelta(0, yawRef.current) * (1 - Math.exp(-3.4 * delta));
        pitchRef.current = THREE.MathUtils.damp(pitchRef.current, 0.08, 4.0, delta);
        desiredCamDist = Math.min(state.cameraDistance, 2.25);
        if (entryCineTimerRef.current <= 0) {
          state.finishEntryCinematic();
        }
      }
    }

    // Resolve wall/door/furniture collision-safe third-person shoulder camera
    const camTrackFeetY =
      posRef.current.feetY - crouchBlendRef.current * 0.26 + jumpOffsetRef.current * 0.55;
    const solved = resolveThirdPersonCameraPosition({
      playerX: posRef.current.x,
      playerFeetY: camTrackFeetY,
      playerZ: posRef.current.z,
      yaw: yawRef.current,
      pitch: pitchRef.current,
      desiredDistance: desiredCamDist,
      doorStates: state.doorStates,
      compoundGateOpen: state.compoundGateState === 'open',
      mainEntranceOpen: state.mainEntranceState === 'open',
    });

    // Asymmetric spring-arm distance: pull IN immediately on wall occlusion, glide OUT smoothly when space clears
    if (!cs.initialized) {
      cs.initialized = true;
      cs.x = solved.camX;
      cs.y = solved.camY;
      cs.z = solved.camZ;
      cs.lookX = solved.lookX;
      cs.lookY = solved.lookY;
      cs.lookZ = solved.lookZ;
      cs.currentDist = solved.effectiveDistance;
    } else {
      const pullingIn = solved.effectiveDistance < cs.currentDist;
      const posLambda = pullingIn ? 28 : 16;
      const lookLambda = 20;

      cs.currentDist = pullingIn
        ? solved.effectiveDistance
        : THREE.MathUtils.damp(cs.currentDist, solved.effectiveDistance, 8.5, delta);

      let targetCamX = solved.camX;
      let targetCamY = solved.camY;
      let targetCamZ = solved.camZ;
      if (!pullingIn && solved.effectiveDistance > 0.01 && cs.currentDist < solved.effectiveDistance - 0.01) {
        const ratio = cs.currentDist / solved.effectiveDistance;
        const pivotY = posRef.current.feetY + 1.52;
        targetCamX = posRef.current.x + (solved.camX - posRef.current.x) * ratio;
        targetCamY = pivotY + (solved.camY - pivotY) * ratio;
        targetCamZ = posRef.current.z + (solved.camZ - posRef.current.z) * ratio;
      }

      cs.x = THREE.MathUtils.damp(cs.x, targetCamX, posLambda, delta);
      cs.y = THREE.MathUtils.damp(cs.y, targetCamY, posLambda, delta);
      cs.z = THREE.MathUtils.damp(cs.z, targetCamZ, posLambda, delta);

      cs.lookX = THREE.MathUtils.damp(cs.lookX, solved.lookX, lookLambda, delta);
      cs.lookY = THREE.MathUtils.damp(cs.lookY, solved.lookY, lookLambda, delta);
      cs.lookZ = THREE.MathUtils.damp(cs.lookZ, solved.lookZ, lookLambda, delta);
    }

    _camPos.set(cs.x, cs.y, cs.z);
    _lookTarget.set(cs.lookX, cs.lookY, cs.lookZ);
    camera.position.copy(_camPos);
    camera.lookAt(_lookTarget);

    playerWorldPos.cameraPos.x = cs.x;
    playerWorldPos.cameraPos.y = cs.y;
    playerWorldPos.cameraPos.z = cs.z;
    playerWorldPos.cameraEffectiveDist = cs.currentDist;

    const { x, feetY, z } = posRef.current;

    // Stage 2 Entry Trigger: Mission Room
    if (
      state.doorStates.mission === 'open' &&
      !state.missionRoomEntered &&
      Math.abs(feetY - MISSION_ROOM_BOUNDS.elevation) < 1.0 &&
      x >= MISSION_ROOM_BOUNDS.minX &&
      x <= MISSION_ROOM_BOUNDS.maxX &&
      z >= MISSION_ROOM_BOUNDS.minZ &&
      z <= MISSION_ROOM_BOUNDS.maxZ
    ) {
      state.enterMissionRoom();
    }

    // Stage 3 Entry Trigger: Puzzle Room
    if (
      state.hasPuzzleRoomKey &&
      state.doorStates.puzzle === 'open' &&
      !state.puzzleRoomEntered &&
      Math.abs(feetY - PUZZLE_CHAMBER_BOUNDS.elevation) < 1.0 &&
      x >= PUZZLE_CHAMBER_BOUNDS.minX &&
      x <= PUZZLE_CHAMBER_BOUNDS.maxX &&
      z >= PUZZLE_CHAMBER_BOUNDS.minZ &&
      z <= PUZZLE_CHAMBER_BOUNDS.maxZ
    ) {
      state.enterPuzzleRoom();
      playBeastAlertSiren(state.audioEnabled);
      emitSoundEvent({
        x,
        y: feetY,
        z,
        floor: PUZZLE_CHAMBER_BOUNDS.floor,
        kind: 'alert',
      });
    }

    // Stage 4 Physical Ground-Floor Extraction Trigger
    if (
      state.safeRoomUnlocked &&
      !state.escaped &&
      feetY < 1.0 &&
      x >= GROUND_ESCAPE_ZONE.minX &&
      x <= GROUND_ESCAPE_ZONE.maxX &&
      z >= GROUND_ESCAPE_ZONE.minZ &&
      z <= GROUND_ESCAPE_ZONE.maxZ
    ) {
      state.triggerGroundFloorEscape();
      return;
    }

    // Detect physical walking entry across Floor 1 Main Entrance threshold (no teleportation)
    if (
      state.mainEntranceState === 'open' &&
      !state.hasEnteredApartment &&
      feetY < 1.2 &&
      z <= 27.15 &&
      Math.abs(x - MAIN_ENTRANCE_POS[0]) <= 4.2
    ) {
      state.markEnteredApartment();
    }

    const insideMissionRoom =
      Math.abs(feetY - MISSION_ROOM_BOUNDS.elevation) < 1.0 &&
      x >= MISSION_ROOM_BOUNDS.minX - 0.5 &&
      x <= MISSION_ROOM_BOUNDS.maxX + 0.5 &&
      z >= MISSION_ROOM_BOUNDS.minZ - 0.4 &&
      z <= MISSION_ROOM_BOUNDS.maxZ + 0.4;

    const insidePuzzleRoom =
      Math.abs(feetY - PUZZLE_CHAMBER_BOUNDS.elevation) < 1.0 &&
      x >= PUZZLE_CHAMBER_BOUNDS.minX - 0.5 &&
      x <= PUZZLE_CHAMBER_BOUNDS.maxX + 0.5 &&
      z >= PUZZLE_CHAMBER_BOUNDS.minZ - 0.4 &&
      z <= PUZZLE_CHAMBER_BOUNDS.maxZ + 0.4;

    // Contextual Proximity Prompts (exterior gate/entrance + floor-filtered door scan!)
    let nextPrompt: string | null = null;
    let nextDoorId: string | null = null;
    let nextPuzzleTermId: string | null = null;
    let nextKeyCellId: (typeof MISSION_KEY_CELLS)[number]['id'] | null = null;
    let nextHidingSpotId: string | null = null;
    let nextExteriorInteract: 'compound-gate' | 'main-entrance' | null = null;
    let bestDist = INTERACT_RANGE;

    if (liveFloor === 1) {
      const gateDist = Math.hypot(COMPOUND_GATE_POS[0] - x, COMPOUND_GATE_POS[2] - z);
      if (state.compoundGateState === 'closed' && gateDist < 3.6) {
        nextExteriorInteract = 'compound-gate';
        nextPrompt = 'PRESS E TO OPEN GATE';
      } else {
        const mainDoorDist = Math.hypot(MAIN_ENTRANCE_POS[0] - x, MAIN_ENTRANCE_POS[2] - z);
        if (state.mainEntranceState === 'closed' && mainDoorDist < 3.35) {
          nextExteriorInteract = 'main-entrance';
          nextPrompt = 'PRESS E TO OPEN MAIN ENTRANCE';
        }
      }
    }

    if (!nextExteriorInteract) {
      const floorDoors = BUILDING_FLOORS[liveFloor - 1]?.doors ?? ALL_DOORS;
      for (let i = 0; i < floorDoors.length; i++) {
        const door = floorDoors[i];
        if (Math.abs(door.position[1] - feetY) > 1.5) continue;

        if (door.isInteriorEscape) {
          if (!insidePuzzleRoom || state.doorStates.exit !== 'closed') continue;
        } else {
          if (door.designation === 'mission-room' && state.doorStates.mission !== 'closed') continue;
          if (door.designation === 'puzzle-room' && state.doorStates.puzzle !== 'closed') continue;
        }

        const d = Math.hypot(door.position[0] - x, door.position[2] - z);
        if (d < bestDist && hasLineOfSightOnFloor(x, z, door.position[0], door.position[2], liveFloor)) {
          bestDist = d;
          nextDoorId = door.id;
          if (door.isInteriorEscape) {
            nextPrompt = state.safeRoomUnlocked
              ? 'PRESS E TO OPEN SAFE ROOM DOOR'
              : 'SAFE ROOM SEALED — COMPLETE PUZZLE CHALLENGE';
          } else {
            nextPrompt = `PRESS E TO TRY DOOR · APT ${door.roomNumber}`;
          }
        }
      }

      if (!nextDoorId && state.missionRoomEntered && insideMissionRoom) {
        let bestCellDist = INTERACT_RANGE;
        for (const cell of MISSION_KEY_CELLS) {
          const cellState = state.keyCells[cell.id];
          if (!cellState || cellState.keyCollected) continue;
          if (Math.abs(cell.position[1] - feetY) > 1.5) continue;
          const targetPos = cellState.unlocked ? cell.keyPosition : cell.keypadPosition;
          const d = Math.hypot(targetPos[0] - x, targetPos[2] - z);
          if (d < bestCellDist && hasLineOfSightOnFloor(x, z, targetPos[0], targetPos[2], liveFloor)) {
            bestCellDist = d;
            nextKeyCellId = cell.id;
            nextPrompt = !cellState.unlocked
              ? 'PRESS E TO ENTER PASSWORD'
              : 'PRESS E TO PICK UP KEY';
          }
        }
      }

      if (!nextDoorId && !nextKeyCellId && state.puzzleRoomEntered && insidePuzzleRoom) {
        let bestTermDist = INTERACT_RANGE;
        for (const term of PUZZLE_TERMINALS) {
          if (Math.abs(term.position[1] - feetY) > 1.5) continue;
          const d = Math.hypot(term.position[0] - x, term.position[2] - z);
          if (d < bestTermDist && hasLineOfSightOnFloor(x, z, term.position[0], term.position[2], liveFloor)) {
            bestTermDist = d;
            nextPuzzleTermId = term.id;
            nextPrompt = `PRESS E TO ACCESS ${term.label.toUpperCase()}`;
          }
        }
      }

      if (!nextDoorId && !nextKeyCellId && !nextPuzzleTermId) {
        const floorSpots = HIDING_SPOTS_BY_FLOOR[liveFloor];
        let bestHideDist = HIDE_INTERACT_RANGE;
        for (const spot of floorSpots) {
          if (Math.abs(spot.exitPos[1] - feetY) > 1.4) continue;
          const d = Math.hypot(spot.exitPos[0] - x, spot.exitPos[2] - z);
          if (d < bestHideDist && hasLineOfSightOnFloor(x, z, spot.exitPos[0], spot.exitPos[2], liveFloor)) {
            bestHideDist = d;
            nextHidingSpotId = spot.id;
            nextPrompt = `PRESS E TO HIDE · ${spot.label.toUpperCase()}`;
          }
        }
      }
    }

    const promptKey = `${nextPrompt ?? ''}|${nextDoorId ?? ''}|${nextPuzzleTermId ?? ''}|${nextKeyCellId ?? ''}|${nextHidingSpotId ?? ''}|${nextExteriorInteract ?? ''}`;
    if (lastPromptRef.current !== promptKey) {
      lastPromptRef.current = promptKey;
      state.setInteractionPrompt(
        nextPrompt,
        nextDoorId,
        nextPuzzleTermId,
        nextKeyCellId,
        nextHidingSpotId,
        nextExteriorInteract
      );
    }
  });

  return null;
};
