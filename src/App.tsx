/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { GameEngine } from './GameEngine';
import { GameUI } from './components/GameUI';
import { GameState, WeaponType, UpgradeType, TowerType, Upgrade } from './types';
import { Eye, Shield, Cpu, Play } from 'lucide-react';

const DEFAULT_GAME_STATE: GameState = {
  playerHealth: 100,
  maxPlayerHealth: 100,
  coreHealth: 1000,
  maxCoreHealth: 1000,
  coinsCarried: 0,
  coinsBanked: 0,
  currentWave: 1,
  waveActive: false,
  waveCountdown: 10,
  activeEnemies: 0,
  totalWaveEnemies: 0,
  activeWeaponIndex: 0,
  weapons: {
    [WeaponType.PISTOL]: { ammo: 12, isReloading: false, unlocked: true, cost: 0 },
    [WeaponType.RIFLE]: { ammo: 30, isReloading: false, unlocked: false, cost: 100 },
    [WeaponType.SHOTGUN]: { ammo: 6, isReloading: false, unlocked: false, cost: 140 }
  } as Record<WeaponType, { ammo: number; isReloading: boolean; unlocked: boolean; cost: number }>,
  upgrades: {
    [UpgradeType.DAMAGE]: {
      id: UpgradeType.DAMAGE,
      name: 'Quantum Coils (Damage)',
      description: 'Increases weapon damage output by +25% per level.',
      cost: 20,
      level: 1,
      maxLevel: 10,
      value: 1.0
    },
    [UpgradeType.MAX_HEALTH]: {
      id: UpgradeType.MAX_HEALTH,
      name: 'Nanite Shell (Max HP)',
      description: 'Boosts maximum shield capacity by +25 HP.',
      cost: 15,
      level: 1,
      maxLevel: 10,
      value: 100
    },
    [UpgradeType.RELOAD_SPEED]: {
      id: UpgradeType.RELOAD_SPEED,
      name: 'Rapid Charger (Reload)',
      description: 'Accelerates weapon reloading speeds by +20% per level.',
      cost: 25,
      level: 1,
      maxLevel: 5,
      value: 1.0
    },
    [UpgradeType.MOVE_SPEED]: {
      id: UpgradeType.MOVE_SPEED,
      name: 'Solenoid Liners (Speed)',
      description: 'Enhances player sprint and horizontal velocities by +16% per level.',
      cost: 15,
      level: 1,
      maxLevel: 5,
      value: 1.0
    },
    [UpgradeType.MAGNET_RADIUS]: {
      id: UpgradeType.MAGNET_RADIUS,
      name: 'Flux Magnet (Radius)',
      description: 'Expands gravity matrix magnet core radius by +2.3m.',
      cost: 10,
      level: 1,
      maxLevel: 6,
      value: 3.0
    },
    [UpgradeType.AUTO_COLLECT]: {
      id: UpgradeType.AUTO_COLLECT,
      name: 'Void Drone (Auto-Collect)',
      description: 'Deploy auto-collection drone representing gravitational fields. Gathers coins automatically.',
      cost: 120,
      level: 0,
      maxLevel: 1,
      value: 0
    },
    [UpgradeType.TELEPORT]: {
      id: UpgradeType.TELEPORT,
      name: 'Warp Node (Base Teleport)',
      description: 'Enables base teleportation capability. Press the "T" key to return to base anytime.',
      cost: 150,
      level: 0,
      maxLevel: 1,
      value: 0
    }
  } as Record<UpgradeType, Upgrade>,
  score: 0,
  isGameOver: false,
  isPaused: false,
  respawning: false,
  respawnTimer: 0,
  selectedTowerToBuild: null,
  canBuild: false
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(DEFAULT_GAME_STATE);
  const [gameStarted, setGameStarted] = useState<boolean>(false);

  useEffect(() => {
    if (!canvasRef.current || !gameStarted) return;

    // Load and build Babylon.js Orchestrator Instance
    const onStateChange = (updatedState: GameState) => {
      setGameState({ ...updatedState });
    };

    const gEngine = new GameEngine(canvasRef.current, onStateChange);
    engineRef.current = gEngine;

    // Request Pointer Lock on initial canvas bind
    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.focus();
        try {
          const promise = canvasRef.current.requestPointerLock() as any;
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {});
          }
        } catch (e) {}
      }
    }, 150);

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [gameStarted]);

  // UI Event hooks directing action into the Babylon Engine Instance
  const handleBuyUpgrade = (type: UpgradeType) => {
    if (engineRef.current) {
      engineRef.current.buyUpgrade(type);
    }
  };

  const handleBuyWeapon = (type: WeaponType) => {
    if (engineRef.current) {
      engineRef.current.buyWeapon(type);
    }
  };

  const handleSetBuildMode = (type: TowerType | null) => {
    if (engineRef.current) {
      engineRef.current.setBuildMode(type);
    }
  };

  const handleRestartGame = () => {
    if (engineRef.current) {
      engineRef.current.restartGame();
    }
  };

  const handleSelectWeapon = (index: number) => {
    if (engineRef.current) {
      engineRef.current.player.selectWeapon(index);
    }
  };

  const handleTogglePause = () => {
    if (engineRef.current) {
      engineRef.current.togglePauseButton();
    }
  };

  const handleStartNextWave = () => {
    if (engineRef.current) {
      engineRef.current.triggerNextWave();
    }
  };

  const handleStartMission = () => {
    setGameStarted(true);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      
      {/* 1. THREE-DIMENSIONAL WEBGL RENDER CANVAS */}
      {gameStarted ? (
        <canvas
          id="babylon_viewport_context"
          ref={canvasRef}
          className="w-full h-full block absolute inset-0 outline-none select-none touch-none bg-slate-950 z-0"
        />
      ) : (
        // Cinematic Pre-start Ambient Background
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-slate-950 opacity-15 overflow-hidden">
          <div className="absolute w-[600px] h-[600px] rounded-full border border-purple-500/20 animate-spin" />
          <div className="absolute w-[400px] h-[400px] rounded-full border border-dashed border-cyan-500/10 animate-pulse" />
        </div>
      )}

      {/* 2. TAILWIND COMBAT STATS AND HUD INTERFACES OVERLAY */}
      <GameUI
        gameState={gameState}
        onBuyUpgrade={handleBuyUpgrade}
        onBuyWeapon={handleBuyWeapon}
        onSetBuildMode={handleSetBuildMode}
        onRestartGame={handleRestartGame}
        onSelectWeapon={handleSelectWeapon}
        onTogglePause={handleTogglePause}
        gameStarted={gameStarted}
        onStartGame={handleStartMission}
        onStartNextWave={handleStartNextWave}
      />

      {/* 3. CENTER SCREEN IN-GAME AIMING RETICLE CROSSHAIR */}
      {gameStarted && !gameState.isGameOver && !gameState.isPaused && !gameState.respawning && (
        <div className="absolute top-1/2 left-1/2 w-8 h-8 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center">
          {/* Retro-futuristic sniper cross dots */}
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 absolute opacity-80 shadow-md shadow-cyan-800" />
          <div className="w-4 h-0.5 bg-cyan-400/40 absolute -left-5" />
          <div className="w-4 h-0.5 bg-cyan-400/40 absolute -right-5" />
          <div className="w-0.5 h-4 bg-cyan-400/40 absolute -top-5" />
          <div className="w-0.5 h-4 bg-cyan-400/40 absolute -bottom-5" />
        </div>
      )}

      {/* Simple pointer lock instruction ribbon at bottom center screen */}
      {gameStarted && !gameState.isPaused && !gameState.isGameOver && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-slate-950/50 backdrop-blur-xs py-1 px-3 border border-slate-900/60 rounded text-[9px] font-mono text-slate-500 tracking-wider uppercase pointer-events-none text-center hidden sm:block">
          Click the combat grid viewport to lock mouse aiming. Jump with SPACE.
        </div>
      )}

    </div>
  );
}
