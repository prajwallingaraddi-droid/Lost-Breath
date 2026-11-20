import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronDown,
  EyeOff,
  Gamepad2,
  Hand,
  Zap,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { virtualInput } from '../../three/playerWorldState';
import { initAudioContext, playMenuClickSound } from '../../three/soundEffects';

const JOYSTICK_MAX_RADIUS = 42;

export const TouchControlsOverlay: React.FC = () => {
  const inMainMenu = useGameStore((s) => s.inMainMenu);
  const screenPhase = useGameStore((s) => s.screenPhase);
  const gamePaused = useGameStore((s) => s.gamePaused);
  const controlMode = useGameStore((s) => s.controlMode);
  const escaped = useGameStore((s) => s.escaped);
  const escapeAnimating = useGameStore((s) => s.escapeAnimating);
  const beastCapturing = useGameStore((s) => s.beastCapturing);
  const progression = useGameStore((s) => s.progression);
  const puzzleModalOpen = useGameStore((s) => s.puzzleModalOpen);
  const activeKeyCellModal = useGameStore((s) => s.activeKeyCellModal);

  const playerCrouched = useGameStore((s) => s.playerCrouched);
  const toggleCrouch = useGameStore((s) => s.toggleCrouch);
  const interactionPrompt = useGameStore((s) => s.interactionPrompt);
  const nearbyHidingSpotId = useGameStore((s) => s.nearbyHidingSpotId);
  const playerHiddenSpotId = useGameStore((s) => s.playerHiddenSpotId);
  const nearbyDoorId = useGameStore((s) => s.nearbyDoorId);
  const nearbyKeyCellId = useGameStore((s) => s.nearbyKeyCellId);
  const nearbyPuzzleTerminalId = useGameStore((s) => s.nearbyPuzzleTerminalId);
  const nearbyExteriorInteract = useGameStore((s) => s.nearbyExteriorInteract);
  const audioEnabled = useGameStore((s) => s.audioEnabled);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sprintActive, setSprintActive] = useState(false);

  const stickRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const resetStick = () => {
    activePointerIdRef.current = null;
    virtualInput.moveX = 0;
    virtualInput.moveY = 0;
    setKnobOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (
      inMainMenu ||
      screenPhase !== 'playing' ||
      gamePaused ||
      controlMode === 'orbit' ||
      escaped ||
      escapeAnimating ||
      beastCapturing ||
      progression === 'PLAYER_CAUGHT' ||
      puzzleModalOpen ||
      activeKeyCellModal !== null ||
      !controlsVisible
    ) {
      virtualInput.moveX = 0;
      virtualInput.moveY = 0;
      virtualInput.sprinting = false;
      setKnobOffset({ x: 0, y: 0 });
      setSprintActive(false);
    }
  }, [
    activeKeyCellModal,
    beastCapturing,
    controlMode,
    controlsVisible,
    escapeAnimating,
    escaped,
    gamePaused,
    inMainMenu,
    progression,
    puzzleModalOpen,
    screenPhase,
  ]);

  if (
    inMainMenu ||
    screenPhase !== 'playing' ||
    controlMode === 'orbit' ||
    gamePaused ||
    escaped ||
    escapeAnimating ||
    beastCapturing ||
    progression === 'PLAYER_CAUGHT' ||
    puzzleModalOpen ||
    activeKeyCellModal !== null
  ) {
    return null;
  }

  const updateStickFromClient = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(JOYSTICK_MAX_RADIUS, dist);
    const angle = Math.atan2(dy, dx);
    const clampedX = dist > 0.001 ? Math.cos(angle) * clampedDist : 0;
    const clampedY = dist > 0.001 ? Math.sin(angle) * clampedDist : 0;

    setKnobOffset({ x: clampedX, y: clampedY });
    virtualInput.moveX = Math.max(-1, Math.min(1, clampedX / JOYSTICK_MAX_RADIUS));
    // Screen Y down is backward (-1); screen Y up is forward (+1)
    virtualInput.moveY = Math.max(-1, Math.min(1, -clampedY / JOYSTICK_MAX_RADIUS));
  };

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    initAudioContext();
    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    resetStick();
  };

  const hasInteractTarget = Boolean(
    interactionPrompt ||
      nearbyDoorId ||
      nearbyKeyCellId ||
      nearbyPuzzleTerminalId ||
      nearbyExteriorInteract ||
      nearbyHidingSpotId ||
      playerHiddenSpotId
  );

  const canHideOrExit = Boolean(nearbyHidingSpotId || playerHiddenSpotId);

  const interactLabel = playerHiddenSpotId
    ? 'EXIT HIDE'
    : nearbyExteriorInteract === 'compound-gate'
      ? 'GATE'
      : nearbyExteriorInteract === 'main-entrance'
        ? 'ENTER'
        : nearbyKeyCellId
          ? 'KEYPAD'
          : nearbyPuzzleTerminalId
            ? 'PUZZLE'
            : nearbyDoorId
              ? 'DOOR'
              : nearbyHidingSpotId
                ? 'HIDE'
                : 'INTERACT';

  if (!controlsVisible) {
    return (
      <div className="pointer-events-auto fixed bottom-3 left-3 z-20">
        <button
          type="button"
          data-testid="toggle-touch-controls-btn"
          onClick={() => {
            initAudioContext();
            playMenuClickSound(false, audioEnabled);
            setControlsVisible(true);
          }}
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-700/90 bg-[#0b121c]/90 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400/70 transition-colors cursor-pointer shadow-lg"
        >
          <Gamepad2 className="h-4 w-4 text-amber-400" />
          Show Controls
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="touch-controls-overlay"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between px-3 pb-3 sm:px-5 sm:pb-5"
    >
      {/* BOTTOM-LEFT: Virtual Movement Joystick + Sprint Hold + Compact Toggle */}
      <div className="pointer-events-auto flex items-end gap-3">
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            data-testid="toggle-touch-controls-btn"
            onClick={() => {
              initAudioContext();
              playMenuClickSound(false, audioEnabled);
              setControlsVisible(false);
            }}
            className="flex items-center gap-1 rounded border border-slate-700/80 bg-[#0b121c]/85 px-2 py-1 font-mono-tech text-[10px] font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <Gamepad2 className="h-3 w-3 text-amber-400" />
            HIDE PAD
          </button>

          <div
            ref={stickRef}
            data-testid="virtual-joystick"
            onPointerDown={handleStickPointerDown}
            onPointerMove={handleStickPointerMove}
            onPointerUp={handleStickPointerUp}
            onPointerCancel={handleStickPointerUp}
            className="relative flex h-28 w-28 sm:h-32 sm:w-32 touch-none select-none items-center justify-center rounded-full border-2 border-slate-600/80 bg-[#090f18]/85 shadow-2xl cursor-grab active:cursor-grabbing"
          >
            {/* Crosshair / Directional Ring */}
            <div className="pointer-events-none absolute inset-3 rounded-full border border-slate-700/70" />
            <div className="pointer-events-none absolute top-1.5 font-mono-tech text-[9px] font-bold text-slate-500">
              W
            </div>
            <div className="pointer-events-none absolute bottom-1.5 font-mono-tech text-[9px] font-bold text-slate-500">
              S
            </div>
            <div className="pointer-events-none absolute left-2 font-mono-tech text-[9px] font-bold text-slate-500">
              A
            </div>
            <div className="pointer-events-none absolute right-2 font-mono-tech text-[9px] font-bold text-slate-500">
              D
            </div>

            {/* Movable Thumb Knob */}
            <div
              className="pointer-events-none h-11 w-11 sm:h-12 sm:w-12 rounded-full border-2 border-amber-400/80 bg-gradient-to-b from-slate-700 to-slate-900 shadow-lg"
              style={{
                transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
              }}
            />
          </div>
        </div>

        {/* Sprint Hold Button */}
        <button
          type="button"
          data-testid="touch-sprint-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            initAudioContext();
            e.currentTarget.setPointerCapture(e.pointerId);
            virtualInput.sprinting = true;
            setSprintActive(true);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            virtualInput.sprinting = false;
            setSprintActive(false);
          }}
          onPointerCancel={() => {
            virtualInput.sprinting = false;
            setSprintActive(false);
          }}
          className={`flex min-h-[52px] min-w-[58px] touch-none select-none flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2 text-[10px] font-bold tracking-wider transition-colors cursor-pointer shadow-lg ${
            sprintActive
              ? 'border-amber-300 bg-amber-500 text-slate-950'
              : 'border-slate-600/90 bg-[#0b121c]/90 text-slate-200 hover:border-amber-400/70'
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>SPRINT</span>
        </button>
      </div>

      {/* BOTTOM-RIGHT: Action Controls (Interact, Hide/Exit, Sit/Crouch, Jump) */}
      <div className="pointer-events-auto grid grid-cols-2 gap-2 sm:gap-2.5">
        {/* HIDE / EXIT HIDE */}
        <button
          type="button"
          data-testid="touch-hide-btn"
          disabled={!canHideOrExit}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!canHideOrExit) return;
            initAudioContext();
            virtualInput.hideQueued = true;
          }}
          className={`flex min-h-[48px] min-w-[74px] sm:min-w-[84px] touch-none select-none flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2 text-[10px] font-bold tracking-wider transition-colors shadow-lg ${
            playerHiddenSpotId
              ? 'border-amber-300 bg-amber-500 text-slate-950 cursor-pointer'
              : nearbyHidingSpotId
                ? 'border-sky-400 bg-sky-500/25 text-sky-200 hover:bg-sky-500/35 cursor-pointer'
                : 'border-slate-800 bg-[#0b121c]/70 text-slate-500 cursor-not-allowed'
          }`}
        >
          <EyeOff className="h-4 w-4" />
          <span>{playerHiddenSpotId ? 'EXIT HIDE' : 'HIDE'}</span>
        </button>

        {/* INTERACT (Doors, Gate, Keypads, Key Pickup, Terminals, Safe Room) */}
        <button
          type="button"
          data-testid="touch-interact-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            initAudioContext();
            virtualInput.interactQueued = true;
          }}
          className={`flex min-h-[48px] min-w-[78px] sm:min-w-[88px] touch-none select-none flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2 text-[10px] font-bold tracking-wider transition-colors cursor-pointer shadow-lg ${
            hasInteractTarget
              ? 'border-amber-300 bg-amber-500 text-slate-950 hover:bg-amber-400'
              : 'border-slate-600/90 bg-[#0b121c]/90 text-slate-200 hover:border-amber-400/70'
          }`}
        >
          <Hand className="h-4 w-4" />
          <span className="truncate max-w-[76px]">{interactLabel}</span>
        </button>

        {/* SIT / CROUCH TOGGLE */}
        <button
          type="button"
          data-testid="touch-crouch-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            initAudioContext();
            playMenuClickSound(false, audioEnabled);
            toggleCrouch();
          }}
          className={`flex min-h-[48px] min-w-[74px] sm:min-w-[84px] touch-none select-none flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2 text-[10px] font-bold tracking-wider transition-colors cursor-pointer shadow-lg ${
            playerCrouched
              ? 'border-amber-300 bg-amber-500 text-slate-950'
              : 'border-slate-600/90 bg-[#0b121c]/90 text-slate-200 hover:border-amber-400/70'
          }`}
        >
          <ChevronDown className="h-4 w-4" />
          <span>{playerCrouched ? 'CROUCHED' : 'CROUCH [C]'}</span>
        </button>

        {/* JUMP */}
        <button
          type="button"
          data-testid="touch-jump-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            initAudioContext();
            virtualInput.jumpQueued = true;
          }}
          className="flex min-h-[48px] min-w-[78px] sm:min-w-[88px] touch-none select-none flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-600/90 bg-[#0b121c]/90 px-3 py-2 text-[10px] font-bold tracking-wider text-slate-200 hover:border-sky-400/70 active:bg-sky-500 active:text-slate-950 transition-colors cursor-pointer shadow-lg"
        >
          <ArrowUp className="h-4 w-4" />
          <span>JUMP</span>
        </button>
      </div>
    </div>
  );
};
