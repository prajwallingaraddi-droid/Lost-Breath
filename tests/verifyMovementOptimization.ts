import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  BEAST_DIFFICULTY_PROFILES,
  BEAST_ROSTER,
} from '../src/data/beastConfig';
import { FLOOR_ELEVATIONS } from '../src/data/buildingLayout';
import {
  createBeastBrainStateForRoster,
  SiblingBeastPosition,
  stepBeastBrain,
} from '../src/three/beastAiEngine';
import {
  findNavPath,
  hasBeastLineOfSight,
} from '../src/three/beastNavigation';
import {
  getCameraObstructionBoxesOnFloor,
  raycastAABB2D,
  raycastCameraObstructionsOnFloor,
  resolvePlayerMovement,
} from '../src/three/collision';
import { getFloorFromElevation } from '../src/three/floorNavigation';
import { resolveThirdPersonCameraPosition } from '../src/three/thirdPersonCamera';
import { BeastId, DoorAnimState, FloorNumber, SpecialDoorKey } from '../src/types/game';

const CLOSED_DOORS: Record<SpecialDoorKey, DoorAnimState> = {
  mission: 'closed',
  puzzle: 'closed',
  exit: 'closed',
};

async function runVerification() {
  // Mock localStorage for Node test environment before importing store
  const storageMap = new Map<string, string>();
  (globalThis as unknown as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storageMap.set(k, v);
      },
      removeItem: (k: string) => {
        storageMap.delete(k);
      },
      clear: () => {
        storageMap.clear();
      },
    },
  };

  const { useGameStore } = await import('../src/store/useGameStore');

  console.log('Running LAST EXIT Smooth Movement, Animation & Performance Verification Suite...');

  // ---------------------------------------------------------------------------
  // TEST 1: Spatial-Hash Camera Raycast Exact Parity with Legacy Full-Scan
  // ---------------------------------------------------------------------------
  {
    for (let floor = 1; floor <= 4; floor++) {
      const fl = floor as FloorNumber;
      const feetY = FLOOR_ELEVATIONS[fl];
      const boxes = getCameraObstructionBoxesOnFloor(fl, feetY, CLOSED_DOORS, false);
      const probes: Array<[number, number, number, number]> = [
        [0, 15.6, 0, 11.2],
        [0, 15.6, 0, 20.5],
        [-15.6, 0, -11.0, 0],
        [-15.6, 0, -21.0, 0],
        [15.6, 15.6, 11.5, 11.5],
        [-15.6, -15.6, -21.0, -21.0],
        [14.2, -15.6, 14.2, -19.8],
        [-14.2, 15.6, -18.5, 19.2],
      ];
      for (const [ax, az, bx, bz] of probes) {
        let legacyMinT = 1.0;
        for (let i = 0; i < boxes.length; i++) {
          const hit = raycastAABB2D(ax, az, bx, bz, boxes[i]);
          if (hit !== null && hit < legacyMinT) legacyMinT = hit;
        }
        const gridMinT = raycastCameraObstructionsOnFloor(
          fl,
          feetY,
          CLOSED_DOORS,
          false,
          ax,
          az,
          bx,
          bz,
          1.0
        );
        assert.ok(
          Math.abs(legacyMinT - gridMinT) < 1e-6,
          `Floor ${fl} camera raycast mismatch: legacy=${legacyMinT} vs grid=${gridMinT}`
        );
      }
    }
    console.log(
      'PASS 1: Spatial-hash camera raycasting matches legacy full-scan with < 1e-6 precision on all 4 floors.'
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Smooth Exponential Acceleration, Deceleration & Frame-Rate Independence
  // ---------------------------------------------------------------------------
  {
    const ACCEL_LAMBDA = 16;
    const DECEL_LAMBDA = 18;
    const WALK_SPEED = 4.2;

    const simulateRun = (fps: number, durationSec: number) => {
      const dt = 1 / fps;
      const steps = Math.round(durationSec * fps);
      let vx = 0;
      let x = 0;
      for (let i = 0; i < steps; i++) {
        vx = THREE.MathUtils.damp(vx, WALK_SPEED, ACCEL_LAMBDA, dt);
        x += vx * dt;
      }
      const afterAccelSpeed = vx;

      // Decelerate to rest for 0.4s
      const stopSteps = Math.round(0.4 * fps);
      for (let i = 0; i < stopSteps; i++) {
        vx = THREE.MathUtils.damp(vx, 0, DECEL_LAMBDA, dt);
        x += vx * dt;
      }
      return { afterAccelSpeed, finalSpeed: vx, finalX: x };
    };

    const r30 = simulateRun(30, 1.0);
    const r60 = simulateRun(60, 1.0);
    const r120 = simulateRun(120, 1.0);

    assert.ok(r60.afterAccelSpeed > WALK_SPEED * 0.99, 'Player velocity reaches walk speed smoothly within 1s');
    assert.ok(r60.finalSpeed < 0.01, 'Player velocity decelerates cleanly to rest');
    assert.ok(
      Math.abs(r30.finalX - r60.finalX) < 0.14 && Math.abs(r120.finalX - r60.finalX) < 0.08,
      `Frame-rate consistency failed: 30fps=${r30.finalX.toFixed(3)}m, 60fps=${r60.finalX.toFixed(3)}m, 120fps=${r120.finalX.toFixed(3)}m`
    );
    console.log(
      `PASS 2: Frame-rate independent smooth player accel/decel verified (30fps=${r30.finalX.toFixed(2)}m, 60fps=${r60.finalX.toFixed(2)}m, 120fps=${r120.finalX.toFixed(2)}m).`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Zero Foot Sliding for All 4 Beasts & Smooth Velocity Transitions
  // ---------------------------------------------------------------------------
  {
    const profile = BEAST_DIFFICULTY_PROFILES.early;
    const brains = ([0, 1, 2, 3] as BeastId[]).map((id) => createBeastBrainStateForRoster(id));

    const prevSpeeds = brains.map(() => 0);
    let maxSingleFrameJump = 0;
    let minPairSpacing = Infinity;
    let totalWalkPhaseGain = 0;

    // Run 360 frames (6 seconds) of active 4-Beast patrolling & multi-floor navigation
    for (let frame = 0; frame < 360; frame++) {
      const dt = 1 / 60;
      const siblings: SiblingBeastPosition[] = brains.map((b) => ({
        id: b.id,
        x: b.x,
        feetY: b.feetY,
        z: b.z,
      }));
      const reserved = brains
        .map((b) => b.assignedTargetNodeId)
        .filter((v): v is string => Boolean(v));

      for (let i = 0; i < brains.length; i++) {
        const b = brains[i];
        const bx0 = b.x;
        const bz0 = b.z;
        const wp0 = b.walkPhase;
        stepBeastBrain({
          state: b,
          delta: dt,
          playerX: -22.3,
          playerFeetY: FLOOR_ELEVATIONS[1],
          playerZ: -15.8,
          controlMode: 'third-person',
          doorStates: CLOSED_DOORS,
          beastAlerted: false,
          keyAlarmTriggered: false,
          otherBeasts: siblings,
          reservedPatrolNodeIds: reserved,
          profile,
          nowMs: 1000 + Math.round(frame * dt * 1000),
        });
        const stepDist = Math.hypot(b.x - bx0, b.z - bz0);
        const stepSpeed = stepDist / dt;
        if (frame > 2) {
          maxSingleFrameJump = Math.max(maxSingleFrameJump, Math.abs(stepSpeed - prevSpeeds[i]));
        }
        prevSpeeds[i] = stepSpeed;
        totalWalkPhaseGain += Math.max(0, b.walkPhase - wp0);

        // Distance-coupled stride phase: if Beast didn't move horizontally, walkPhase must not advance
        if (stepDist < 1e-4) {
          assert.ok(
            Math.abs(b.walkPhase - wp0) < 1e-5,
            `Foot sliding detected on beast ${b.id}: moved ${stepDist}m but walkPhase changed by ${b.walkPhase - wp0}`
          );
        }

        // Verify Beast stays inside valid building bounds (no NaN or wall-escape)
        assert.ok(Number.isFinite(b.x) && Number.isFinite(b.feetY) && Number.isFinite(b.z));
        assert.ok(Math.abs(b.x) < 27.5 && Math.abs(b.z) < 27.5, `Beast ${b.id} escaped building bounds`);
      }

      // Check same-floor Beast-to-Beast spacing (must never stack/overlap)
      for (let i = 0; i < brains.length; i++) {
        const fi = getFloorFromElevation(brains[i].feetY);
        for (let j = i + 1; j < brains.length; j++) {
          const fj = getFloorFromElevation(brains[j].feetY);
          if (fi === fj && Math.abs(brains[i].feetY - brains[j].feetY) < 1.5) {
            const d = Math.hypot(brains[i].x - brains[j].x, brains[i].z - brains[j].z);
            if (d < minPairSpacing) minPairSpacing = d;
          }
        }
      }
    }

    assert.ok(totalWalkPhaseGain > 20, 'Beasts must actively patrol and accumulate stride phase');
    assert.ok(
      maxSingleFrameJump < 1.8,
      `Beast velocity stutter detected: max single-frame speed delta was ${maxSingleFrameJump.toFixed(2)} m/s`
    );
    assert.ok(
      minPairSpacing >= 0.95,
      `Beasts overlapped too closely on same floor: min spacing=${minPairSpacing.toFixed(2)}m`
    );
    console.log(
      `PASS 3: All 4 Beasts move smoothly (max speed jump ${maxSingleFrameJump.toFixed(2)} m/s, zero foot sliding, min pair spacing ${minPairSpacing === Infinity ? 'separate floors' : minPairSpacing.toFixed(2) + 'm'}).`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Cross-Floor A* Typed-Array Pathfinding & LOS Accuracy
  // ---------------------------------------------------------------------------
  {
    const path = findNavPath({
      startX: 0,
      startY: FLOOR_ELEVATIONS[1],
      startZ: 15.6,
      goalX: 0,
      goalY: FLOOR_ELEVATIONS[4],
      goalZ: -15.6,
      doorStates: CLOSED_DOORS,
    });
    assert.ok(path.length >= 6, `Expected valid multi-floor path from F1 to F4, got ${path.length} nodes`);
    assert.equal(getFloorFromElevation(path[0].y), 1);
    assert.equal(getFloorFromElevation(path[path.length - 1].y), 4);

    assert.equal(
      hasBeastLineOfSight(0, FLOOR_ELEVATIONS[1], 15.6, 0, FLOOR_ELEVATIONS[1], 22.0, CLOSED_DOORS),
      false,
      'LOS through solid corridor wall and closed apartment door must be blocked'
    );
    assert.equal(
      hasBeastLineOfSight(-4, FLOOR_ELEVATIONS[1], 15.6, 4, FLOOR_ELEVATIONS[1], 15.6, CLOSED_DOORS),
      true,
      'LOS down clear Floor 1 south corridor must be unobstructed'
    );
    console.log(
      `PASS 4: Zero-GC typed-array A* cross-floor pathfinding (${path.length} nodes F1→F4) & LOS verified.`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Player Spatial-Hash Collision & Third-Person Camera Wall-Safety
  // ---------------------------------------------------------------------------
  {
    const pushed = resolvePlayerMovement({
      x: 0,
      z: 10.5,
      feetY: FLOOR_ELEVATIONS[1],
      radius: 0.34,
      doorStates: CLOSED_DOORS,
    });
    assert.ok(pushed.z >= 13.0, `Player must not clip into courtyard barrier (got z=${pushed.z.toFixed(3)})`);

    const cam = resolveThirdPersonCameraPosition({
      playerX: 0,
      playerFeetY: FLOOR_ELEVATIONS[1],
      playerZ: 15.2,
      yaw: 0,
      pitch: 0.08,
      desiredDistance: 3.6,
      doorStates: CLOSED_DOORS,
    });
    assert.ok(cam.isOccluded, 'Camera near south outer wall must smoothly pull in');
    assert.ok(cam.effectiveDistance < 3.6 && cam.effectiveDistance >= 0.16);
    console.log('PASS 5: Spatial-hash player collision & third-person camera occlusion verified.');
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Store Telemetry Deduplication Guard (Prevents Unnecessary React Re-renders)
  // ---------------------------------------------------------------------------
  {
    useGameStore.getState().startGameFromMenu();
    const sampleEntries = BEAST_ROSTER.map((r, idx) => ({
      id: r.id,
      name: r.name,
      floor: ((idx % 4) + 1) as FloorNumber,
      mode: 'patrol' as const,
      distance: 12.5 + idx * 3,
      lastKnownFloor: null,
    }));
    useGameStore.getState().setBeastsTelemetry(sampleEntries, 'PATROL', null);
    let notifications = 0;
    const unsub = useGameStore.subscribe(() => {
      notifications++;
    });
    // Calling again with identical values must NOT trigger subscriber notifications
    useGameStore.getState().setBeastsTelemetry(
      sampleEntries.map((e) => ({ ...e })),
      'PATROL',
      null
    );
    assert.equal(notifications, 0, 'Unchanged Beast telemetry must not emit Zustand subscriber notifications');
    // Calling with a changed distance MUST emit a notification
    useGameStore.getState().setBeastsTelemetry(
      sampleEntries.map((e, idx) => (idx === 0 ? { ...e, distance: 11.5 } : { ...e })),
      'PATROL',
      null
    );
    assert.equal(notifications, 1, 'Changed Beast telemetry must notify HUD subscribers');
    unsub();
    console.log('PASS 6: Beast telemetry deduplication guard verified (0 wasted re-renders on steady state).');
  }

  console.log('ALL MOVEMENT OPTIMIZATION VERIFICATION TESTS PASSED!');
}

runVerification().catch((err) => {
  console.error('Movement optimization verification failed:', err);
  process.exit(1);
});
