import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { detectSoftwareWebGL, isWebGLAvailable } from './three/webglSupport';
import { MaterialProvider } from './three/MaterialContext';
import { SceneEnvironment } from './components/scene/SceneEnvironment';
import { CameraRig } from './components/scene/CameraRig';
import { PlayerController } from './components/scene/PlayerController';
import { BuildingScene } from './components/scene/BuildingScene';
import { GameHUD } from './components/hud/GameHUD';
import { MainMenu } from './components/hud/MainMenu';
import { LoadingScreen } from './components/hud/LoadingScreen';
import { GameBriefing } from './components/hud/GameBriefing';
import { CinematicIntroOverlay } from './components/hud/CinematicIntroOverlay';
import { useGameStore } from './store/useGameStore';
import {
  MusicMode,
  setAudioSettings,
  stopEmergencyAlarmSiren,
  updateBackgroundMusic,
} from './three/soundEffects';

/**
 * Isolated audio & background music synchronizer.
 * Subscribing here instead of inside App prevents 3D Canvas & parent tree re-renders
 * when Beast telemetry updates during gameplay.
 */
const AudioMusicSync: React.FC = React.memo(() => {
  const screenPhase = useGameStore((s) => s.screenPhase);
  const inMainMenu = useGameStore((s) => s.inMainMenu);
  const gamePaused = useGameStore((s) => s.gamePaused);
  const playerFloor = useGameStore((s) => s.playerFloor);
  const beastFloor = useGameStore((s) => s.beastFloor);
  const beastDistance = useGameStore((s) => s.beastDistance);
  const beastAiMode = useGameStore((s) => s.beastAiMode);
  const beastCapturing = useGameStore((s) => s.beastCapturing);
  const emergencyAlarmActive = useGameStore((s) => s.emergencyAlarmActive);
  const escaped = useGameStore((s) => s.escaped);
  const progression = useGameStore((s) => s.progression);

  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const masterVolume = useGameStore((s) => s.masterVolume);
  const musicVolume = useGameStore((s) => s.musicVolume);
  const sfxVolume = useGameStore((s) => s.sfxVolume);

  useEffect(() => {
    setAudioSettings({
      enabled: audioEnabled,
      masterVolume,
      musicVolume,
      sfxVolume,
    });
  }, [audioEnabled, masterVolume, musicVolume, sfxVolume]);

  useEffect(() => {
    if (
      !emergencyAlarmActive ||
      inMainMenu ||
      gamePaused ||
      escaped ||
      progression === 'PLAYER_CAUGHT' ||
      !audioEnabled
    ) {
      stopEmergencyAlarmSiren();
    }
  }, [audioEnabled, emergencyAlarmActive, escaped, gamePaused, inMainMenu, progression]);

  useEffect(() => {
    let mode: MusicMode = 'gameplay';
    if (screenPhase === 'intro') {
      mode = 'intro';
    } else if (inMainMenu) {
      mode = 'menu';
    } else if (escaped || progression === 'ESCAPED') {
      mode = 'victory';
    } else if (progression === 'PLAYER_CAUGHT' || beastCapturing) {
      mode = 'gameover';
    } else if (gamePaused) {
      mode = 'paused';
    } else if (beastAiMode === 'chase' || beastAiMode === 'detect') {
      mode = 'chase';
    } else if (
      emergencyAlarmActive ||
      (beastFloor === playerFloor && beastDistance < 14) ||
      ((beastAiMode === 'investigate' || beastAiMode === 'search') && beastDistance < 20)
    ) {
      mode = 'stalking';
    }
    updateBackgroundMusic(mode);
  }, [
    beastAiMode,
    beastCapturing,
    beastDistance,
    beastFloor,
    emergencyAlarmActive,
    escaped,
    gamePaused,
    inMainMenu,
    playerFloor,
    progression,
    screenPhase,
  ]);

  return null;
});

export function App() {
  const [contextLost, setContextLost] = useState(false);
  const webglReady = useMemo(() => isWebGLAvailable(), []);
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);

  if (!webglReady || contextLost) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0d1218] px-6 text-center text-slate-200">
        <h1 className="font-display text-3xl font-bold tracking-wider text-white">LAST BREATH</h1>
        <p className="mt-3 max-w-md text-sm text-slate-400">
          {contextLost
            ? 'The 3D graphics context was interrupted. Reload the page to restore the apartment viewport.'
            : 'WebGL is required to render the 3D four-floor apartment complex.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
        >
          Reload Viewport
        </button>
      </div>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0d1218]">
      <AudioMusicSync />
      <div className="h-full w-full">
        <Canvas
          shadows={!isSoftwareGl}
          dpr={isSoftwareGl ? 1 : [1, 2]}
          camera={{ position: [-25.1, 2.15, -15.4], fov: 62, near: 0.12, far: 240 }}
          gl={{
            antialias: !isSoftwareGl,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.08,
          }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
            const canvas = gl.domElement;
            canvas.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setContextLost(true);
            });
            canvas.addEventListener('webglcontextrestored', () => {
              setContextLost(false);
            });
          }}
        >
          <SceneEnvironment isSoftwareGl={isSoftwareGl} />
          {/* Mount PlayerController BEFORE BuildingScene so playerWorldPos & camera update FIRST every frame (zero 1-frame character-vs-camera jitter!) */}
          <PlayerController />
          <MaterialProvider>
            <BuildingScene />
          </MaterialProvider>
          <CameraRig isSoftwareGl={isSoftwareGl} />
        </Canvas>
      </div>

      <LoadingScreen />
      <MainMenu />
      <GameBriefing />
      <CinematicIntroOverlay />
      <GameHUD />
    </main>
  );
}

export default App;
