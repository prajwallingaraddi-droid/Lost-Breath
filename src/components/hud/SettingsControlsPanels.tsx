import React from 'react';
import { Camera, Lightbulb, Mouse, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import {
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_MOUSE_SENSITIVITY,
  MAX_CAMERA_DISTANCE,
  MAX_MOUSE_SENSITIVITY,
  MIN_CAMERA_DISTANCE,
  MIN_MOUSE_SENSITIVITY,
  useGameStore,
} from '../../store/useGameStore';
import { initAudioContext, playMenuClickSound } from '../../three/soundEffects';

export const AudioSettingsPanel: React.FC = () => {
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const masterVolume = useGameStore((s) => s.masterVolume);
  const musicVolume = useGameStore((s) => s.musicVolume);
  const sfxVolume = useGameStore((s) => s.sfxVolume);
  const ceilingLightsOn = useGameStore((s) => s.ceilingLightsOn);
  const mouseSensitivity = useGameStore((s) => s.mouseSensitivity);
  const cameraDistance = useGameStore((s) => s.cameraDistance);

  const toggleAudio = useGameStore((s) => s.toggleAudio);
  const setMasterVolume = useGameStore((s) => s.setMasterVolume);
  const setMusicVolume = useGameStore((s) => s.setMusicVolume);
  const setSfxVolume = useGameStore((s) => s.setSfxVolume);
  const toggleCeilingLights = useGameStore((s) => s.toggleCeilingLights);
  const setMouseSensitivity = useGameStore((s) => s.setMouseSensitivity);
  const resetMouseSensitivity = useGameStore((s) => s.resetMouseSensitivity);
  const setCameraDistance = useGameStore((s) => s.setCameraDistance);
  const resetCameraDistance = useGameStore((s) => s.resetCameraDistance);

  const handleToggleAudio = () => {
    initAudioContext();
    toggleAudio();
    const nowEnabled = useGameStore.getState().audioEnabled;
    if (nowEnabled) {
      playMenuClickSound(false, true);
    }
  };

  const handleSlider = (setter: (v: number) => void, raw: string) => {
    initAudioContext();
    setter(Number(raw) / 100);
  };

  return (
    <div className="space-y-4">
      {/* Camera & Controls: Mouse Sensitivity (Controls Third-Person Camera Rotation) */}
      <div className="space-y-2 rounded-lg border border-slate-700/80 bg-[#070d16] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mouse className="h-4 w-4 text-sky-400" />
            <div>
              <label htmlFor="slider-mouse-sensitivity" className="text-sm font-semibold text-slate-100">
                Mouse Sensitivity
              </label>
              <div className="text-xs text-slate-400">
                Adjust third-person camera rotation speed ({MIN_MOUSE_SENSITIVITY.toFixed(1)} – {MAX_MOUSE_SENSITIVITY.toFixed(1)})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              data-testid="mouse-sensitivity-value"
              className="font-mono-tech rounded border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-300"
            >
              {mouseSensitivity.toFixed(1)}
            </span>
            <button
              type="button"
              onClick={() => {
                initAudioContext();
                playMenuClickSound(false, audioEnabled);
                resetMouseSensitivity();
              }}
              disabled={Math.abs(mouseSensitivity - DEFAULT_MOUSE_SENSITIVITY) < 0.01}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#131d2b] px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-amber-400 hover:text-white disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to Default
            </button>
          </div>
        </div>

        <input
          id="slider-mouse-sensitivity"
          type="range"
          min={MIN_MOUSE_SENSITIVITY}
          max={MAX_MOUSE_SENSITIVITY}
          step={0.1}
          value={mouseSensitivity}
          onChange={(e) => setMouseSensitivity(Number(e.target.value))}
          className="w-full accent-sky-400 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-mono-tech text-slate-500">
          <span>0.2 (Slow / Smooth)</span>
          <span>1.0 (Default)</span>
          <span>3.0 (Fast)</span>
        </div>
      </div>

      {/* Third-Person Camera Distance Setting */}
      <div className="space-y-2 rounded-lg border border-slate-700/80 bg-[#070d16] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-amber-400" />
            <div>
              <label htmlFor="slider-camera-distance" className="text-sm font-semibold text-slate-100">
                Third-Person Camera Distance
              </label>
              <div className="text-xs text-slate-400">
                Adjust follow distance behind survivor ({MIN_CAMERA_DISTANCE.toFixed(1)}m – {MAX_CAMERA_DISTANCE.toFixed(1)}m)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              data-testid="camera-distance-value"
              className="font-mono-tech rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300"
            >
              {cameraDistance.toFixed(1)}m
            </span>
            <button
              type="button"
              onClick={() => {
                initAudioContext();
                playMenuClickSound(false, audioEnabled);
                resetCameraDistance();
              }}
              disabled={Math.abs(cameraDistance - DEFAULT_CAMERA_DISTANCE) < 0.05}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#131d2b] px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-amber-400 hover:text-white disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>

        <input
          id="slider-camera-distance"
          type="range"
          min={MIN_CAMERA_DISTANCE}
          max={MAX_CAMERA_DISTANCE}
          step={0.2}
          value={cameraDistance}
          onChange={(e) => setCameraDistance(Number(e.target.value))}
          className="w-full accent-amber-400 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-mono-tech text-slate-500">
          <span>1.8m (Close Over-Shoulder)</span>
          <span>3.0m (Default)</span>
          <span>5.0m (Wide View)</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-[#070d16] px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Master Audio Output</div>
          <div className="text-xs text-slate-400">
            {audioEnabled ? 'Sound effects and facility ambience active' : 'All game audio muted'}
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleAudio}
          className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors ${
            audioEnabled
              ? 'border-sky-500/60 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
              : 'border-red-500/50 bg-red-500/15 text-red-300 hover:bg-red-500/25'
          }`}
        >
          {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {audioEnabled ? 'AUDIO ON' : 'MUTED'}
        </button>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-700/80 bg-[#070d16] p-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="slider-master-vol" className="font-semibold text-slate-200">
              Master Volume
            </label>
            <span className="font-mono-tech text-amber-300">{Math.round(masterVolume * 100)}%</span>
          </div>
          <input
            id="slider-master-vol"
            type="range"
            min={0}
            max={100}
            value={Math.round(masterVolume * 100)}
            onChange={(e) => handleSlider(setMasterVolume, e.target.value)}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="slider-music-vol" className="font-semibold text-slate-200">
              Music &amp; Facility Ambience
            </label>
            <span className="font-mono-tech text-sky-300">{Math.round(musicVolume * 100)}%</span>
          </div>
          <input
            id="slider-music-vol"
            type="range"
            min={0}
            max={100}
            value={Math.round(musicVolume * 100)}
            onChange={(e) => handleSlider(setMusicVolume, e.target.value)}
            className="w-full accent-sky-400 cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="slider-sfx-vol" className="font-semibold text-slate-200">
              Sound Effects (Footsteps, Doors, Beast)
            </label>
            <span className="font-mono-tech text-emerald-300">{Math.round(sfxVolume * 100)}%</span>
          </div>
          <input
            id="slider-sfx-vol"
            type="range"
            min={0}
            max={100}
            value={Math.round(sfxVolume * 100)}
            onChange={(e) => handleSlider(setSfxVolume, e.target.value)}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-[#070d16] px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Corridor Ceiling Lighting</div>
          <div className="text-xs text-slate-400">Toggle overhead facility light fixtures</div>
        </div>
        <button
          type="button"
          onClick={() => {
            initAudioContext();
            playMenuClickSound(false, audioEnabled);
            toggleCeilingLights();
          }}
          className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors ${
            ceilingLightsOn
              ? 'border-amber-500/60 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
              : 'border-slate-600 bg-[#131d2b] text-slate-300 hover:text-white'
          }`}
        >
          <Lightbulb className="h-4 w-4" />
          {ceilingLightsOn ? 'LIGHTS ON' : 'LIGHTS OFF'}
        </button>
      </div>
    </div>
  );
};

export const ControlsGuidePanel: React.FC = () => {
  const rows = [
    { key: 'W A S D', action: 'Move survivor across exterior street, corridors, stairs, and Safe Room' },
    { key: 'SHIFT', action: 'Sprint faster (emits louder footsteps audible to the 4 Hunters)' },
    { key: 'C', action: 'Crouch / Sit quietly (lower profile and drastically reduced footstep noise)' },
    { key: 'SPACE', action: 'Jump smoothly over ground debris and low barriers' },
    { key: 'MOUSE / CLICK', action: 'Rotate third-person camera around survivor (or peek while hiding)' },
    { key: 'E', action: 'Interact with gate, doors, keypads, consoles, or hide / exit hiding spots' },
    { key: 'TOUCH PAD', action: 'On-screen Virtual Joystick + Sprint, Crouch, Jump, Interact & Hide buttons' },
    { key: '1 - 4', action: 'Select puzzle category or answer option inside the Puzzle Room' },
    { key: 'ESC / P', action: 'Close open terminal consoles or open Pause Menu' },
    { key: 'H', action: 'Collapse or expand bottom control dock' },
    { key: '0 - 4 / C / R', action: 'In Orbit Inspect: switch floors, toggle Cutaway, reset view' },
  ];

  return (
    <div className="space-y-2 rounded-lg border border-slate-700/80 bg-[#070d16] p-4">
      {rows.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-2 last:border-b-0 last:pb-0 text-xs"
        >
          <span className="font-mono-tech shrink-0 rounded border border-slate-700 bg-[#121c2a] px-2.5 py-1 font-bold text-amber-300">
            {item.key}
          </span>
          <span className="text-right text-slate-300">{item.action}</span>
        </div>
      ))}
    </div>
  );
};
