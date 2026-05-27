/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameState, UpgradeType, TowerType, WeaponType } from '../types';
import { Shield, Sparkles, AlertTriangle, Play, RefreshCw, Volume2, Plus, Lock, Check, Zap, Eye } from 'lucide-react';

interface GameUIProps {
  gameState: GameState;
  onBuyUpgrade: (type: UpgradeType) => void;
  onBuyWeapon?: (type: WeaponType) => void;
  onSetBuildMode: (type: TowerType | null) => void;
  onRestartGame: () => void;
  onSelectWeapon: (index: number) => void;
  onTogglePause: () => void;
  gameStarted: boolean;
  onStartGame: () => void;
  onStartNextWave?: () => void;
}

export const GameUI: React.FC<GameUIProps> = ({
  gameState,
  onBuyUpgrade,
  onBuyWeapon,
  onSetBuildMode,
  onRestartGame,
  onSelectWeapon,
  onTogglePause,
  gameStarted,
  onStartGame,
  onStartNextWave
}) => {
  const {
    playerHealth,
    maxPlayerHealth,
    coreHealth,
    maxCoreHealth,
    coinsCarried,
    coinsBanked,
    currentWave,
    waveActive,
    waveCountdown,
    activeEnemies,
    totalWaveEnemies,
    activeWeaponIndex,
    weapons,
    upgrades,
    score,
    isGameOver,
    isPaused,
    respawning,
    respawnTimer,
    selectedTowerToBuild
  } = gameState;

  const [activeTab, setActiveTab] = useState<'build' | 'stats' | 'weapons' | 'abilities'>('stats');

  // Helper properties to render weapons detail
  const weaponDetails = [
    { type: WeaponType.PISTOL, name: 'Quantum Sidearm', desc: 'Semi-auto, high accuracy', color: 'from-blue-600 to-cyan-500', hotkey: '1' },
    { type: WeaponType.RIFLE, name: 'Auto Pulsar', desc: 'Fully auto cosmic blaster', color: 'from-emerald-600 to-teal-500', hotkey: '2' },
    { type: WeaponType.SHOTGUN, name: 'Core Breaker', desc: 'Heavy spread shotgun, short-range', color: 'from-orange-600 to-amber-500', hotkey: '3' }
  ];

  const activeWeapon = weaponDetails[activeWeaponIndex];
  const activeWeaponAmmo = weapons[activeWeapon.type];

  // Helper calculations
  const playerHPPercent = (playerHealth / maxPlayerHealth) * 100;
  const coreHPPercent = (coreHealth / maxCoreHealth) * 100;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between font-sans select-none text-gray-100">
      
      {/* 1. START TUTORIAL INSTRUCTIONS OVERLAY */}
      {!gameStarted && (
        <div className="absolute inset-0 bg-slate-950/95 flex items-center justify-center pointer-events-auto p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-700/60 rounded-xl p-8 shadow-2xl text-center flex flex-col space-y-6">
            <div className="flex justify-center flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30 mb-3 animate-pulse">
                <Shield className="w-8 h-8 text-cyan-400" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-white uppercase">3D CORE DEFENSE</h1>
              <p className="text-xs text-cyan-400 font-mono tracking-widest mt-1 uppercase">First-Person Defense Arcader</p>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed max-w-lg mx-auto">
              Your home base and central generator core are under siege by crawler insect beasts spawning from the horizons. Build automated turrets and collect essence to upgrade your arsenal.
            </p>

            <div className="grid grid-cols-2 gap-4 text-left border-y border-slate-800 py-5">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase text-cyan-400 font-mono">Controls</h3>
                <ul className="text-xs space-y-1.5 text-slate-300">
                  <li><span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold mr-1.5">W A S D</span> Walk and Move</li>
                  <li><span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold mr-1.5">Mouse</span> Aim and Rotate</li>
                  <li><span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold mr-1.5">Left Click</span> Shoot Projectiles</li>
                  <li><span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold mr-1.5">Space</span> Jump Over Enemies</li>
                  <li><span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold mr-1.5">L. Shift</span> Sprint (Disabled Gunfire)</li>
                  <li><span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold mr-1.5">T</span> Base Teleport <span className="text-cyan-400 font-bold font-mono text-[9px] uppercase hover:underline">(Requires "Warp Node" from Abilities Tab)</span></li>
                  <li><span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold mr-1.5">R</span> Reload Gun</li>
                  <li><span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold mr-1.5">1 2 3</span> Switch Active Firearms</li>
                </ul>
              </div>
              
              <div className="space-y-3 pl-4 border-l border-slate-800">
                <h3 className="text-sm font-semibold uppercase text-cyan-400 font-mono">Mission Objectives</h3>
                <ul className="text-xs space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold mt-0.5">•</span>
                    <span>Defend the glowing <strong>Central Core (0,0,0)</strong> from crawler attacks.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold mt-0.5">•</span>
                    <span>Collect gold coins. They are lost on death unless <strong>returned to the Central Base perimeter</strong> to bank them permanently!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold mt-0.5">•</span>
                    <span>Spend your banked essence on character upgrades or deploy heavy turrets during wave breaks.</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={onStartGame}
              className="pointer-events-auto w-full py-4 bg-cyan-600 hover:bg-cyan-500 font-bold tracking-wider rounded-lg border border-cyan-400/20 shadow-md shadow-cyan-900/30 transition-all font-mono text-sm uppercase flex items-center justify-center gap-2 text-white"
            >
              <Play className="w-4 h-4 fill-white" /> Access Combat Grid
            </button>
          </div>
        </div>
      )}

      {/* 2. GAME OVER OVERLAY */}
      {isGameOver && (
        <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center pointer-events-auto z-50">
          <div className="max-w-md w-full bg-slate-900 border-2 border-red-500/40 rounded-xl p-8 shadow-2xl text-center flex flex-col space-y-6">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30 mx-auto mb-2">
                <AlertTriangle className="w-6 h-6 text-red-500 animate-bounce" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-red-500 uppercase">CORE COMPROMISED</h2>
              <p className="text-xs text-slate-400 uppercase font-mono">The core health has reached zero</p>
            </div>

            <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 space-y-3 font-mono text-left">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Survival Wave:</span>
                <span className="text-cyan-400 font-bold text-lg">{currentWave}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-slate-800 pt-2.5">
                <span className="text-slate-400">Banked Coins:</span>
                <span className="text-yellow-400 font-bold text-lg">{coinsBanked}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-slate-800 pt-2.5">
                <span className="text-slate-400">Total Combat Score:</span>
                <span className="text-white font-bold text-lg">{score}</span>
              </div>
            </div>

            <button
              onClick={onRestartGame}
              className="pointer-events-auto w-full py-4.5 bg-red-600 hover:bg-red-500 font-semibold tracking-wider rounded-lg border border-red-400/20 shadow-md transition-all font-mono text-sm uppercase flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Reinitialize Simulation
            </button>
          </div>
        </div>
      )}

      {/* 3. RESPAWN OVERLAY */}
      {respawning && !isGameOver && (
        <div className="absolute inset-0 bg-red-950/20 backdrop-blur-xs flex items-center justify-center z-40 pointer-events-none">
          <div className="text-center space-y-3">
            <span className="text-xs font-mono tracking-widest text-red-400 uppercase bg-slate-950/70 py-1.5 px-3 rounded border border-red-500/30">HULL CRITICAL</span>
            <h2 className="text-4xl font-extrabold text-white tracking-tight uppercase animate-pulse">RESPAWNING IN {respawnTimer}s...</h2>
            <p className="text-xs text-slate-300 font-mono max-w-sm mx-auto bg-slate-950/50 p-2 rounded">
              All unbanked coins carried have been dropped at your death coordinates!
            </p>
          </div>
        </div>
      )}

      {/* 4. MAIN HEADERS: WAVE AND SCOREBOARD */}
      {gameStarted && (
        <header className="p-4 flex justify-between items-start">
          
          {/* Top Left: Score and coins panel */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 w-56 flex flex-col space-y-2 pointer-events-auto">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono tracking-wider text-slate-400 uppercase">Score</span>
              <span className="font-mono text-sm font-bold text-slate-100">{score}</span>
            </div>

            <div className="flex justify-between items-center border-t border-slate-800/60 pt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-xs font-mono tracking-wider text-slate-400 uppercase">Banked Coins</span>
              </div>
              <span className="font-mono text-sm font-extrabold text-yellow-400">{coinsBanked}</span>
            </div>

            {/* Carrying Coins warning/deposit bar */}
            <div className={`p-1.5 rounded text-center border mt-1 transition-all ${
              coinsCarried > 0 
                ? 'bg-amber-950/60 border-amber-500/40 animate-pulse text-amber-300' 
                : 'bg-slate-900/50 border-slate-800 text-slate-500'
            }`}>
              {coinsCarried > 0 ? (
                <div className="flex flex-col items-center justify-center space-y-0.5">
                  <span className="text-xs font-extrabold uppercase tracking-tight flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Carrying +{coinsCarried} Coins
                  </span>
                  <span className="text-[9px] font-mono opacity-85 uppercase">Bank at center! Risky!</span>
                </div>
              ) : (
                <span className="text-[10px] font-mono tracking-normal">No loose coins held</span>
              )}
            </div>
          </div>

          {/* Top Center: Wave Indicator */}
          {!waveActive && (
            <div className="flex flex-col items-center space-y-1.5">
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg py-3.5 px-8 flex flex-col items-center text-center shadow-lg pointer-events-auto">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
                  <Sparkles className="w-4 h-4" /> PREPARATION PHASE
                </span>
                <button
                  onClick={onStartNextWave}
                  className="mt-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 px-10 py-5 rounded-xl font-black font-mono text-sm tracking-widest animate-[pulse_1.5s_infinite] flex items-center justify-center gap-2.5 transition-all outline-none border-2 border-cyan-300 shadow-xl shadow-cyan-950/60 pointer-events-auto cursor-pointer cursor-transform-hover uppercase active:scale-95"
                >
                  <Play className="w-5 h-5 fill-slate-950 text-slate-950" /> START WAVE {currentWave}
                </button>
              </div>
              
              {/* Show special notification for Boss Wave soon! */}
              {currentWave % 5 === 0 && (
                <div className="bg-red-950/80 border border-red-500/40 text-red-300 text-[10px] font-mono px-3.5 py-1 rounded-full uppercase tracking-widest animate-bounce">
                  WARNING: BOSS WAVE INBOUND!
                </div>
              )}
            </div>
          )}

          {/* Top Right: Settings & Active State actions */}
          {!waveActive && (
            <div className="flex gap-2 pointer-events-auto">
              <button
                onClick={onTogglePause}
                className="py-2 px-4 bg-slate-950/80 border border-slate-800 rounded-lg text-xs font-bold font-mono text-slate-300 hover:bg-slate-900"
              >
                {isPaused ? 'RESUME' : 'PAUSE'}
              </button>
              <button
                onClick={onRestartGame}
                className="py-2 px-3 bg-red-950/10 hover:bg-red-950/40 border border-red-800/30 rounded-lg text-xs font-bold font-mono text-red-400"
              >
                RESTART
              </button>
            </div>
          )}
        </header>
      )}

      {/* 5. CENTER SCREEN: PAUSED OVERLAY */}
      {isPaused && (
        <div className="absolute inset-0 bg-slate-950/80 font-mono flex items-center justify-center z-50 pointer-events-auto">
          <div className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-lg p-6 text-center space-y-4">
            <h2 className="text-xl font-bold uppercase text-white tracking-widest">GAME PAUSED</h2>
            <p className="text-slate-400 text-xs">The simulation is temporarily on standby.</p>
            <button
              onClick={onTogglePause}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-xs font-bold tracking-wider text-white uppercase rounded w-full border border-cyan-400/20"
            >
              RESUME GAME
            </button>
          </div>
        </div>
      )}

      {/* 6. BOTTOM SECTOR: STATS PANEL, BUILD TAB, AND SHOP UPGRADES */}
      {gameStarted && !isGameOver && !waveActive && (
        <footer className="p-4 flex flex-col md:flex-row justify-between items-end gap-4">
          
          {/* Sub-Panel: Left: Dynamic Upgrade Shop & Turret Builders */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 w-full md:max-w-xl pointer-events-auto shadow-2xl flex flex-col space-y-3">
            <div className="flex border-b border-slate-800 pb-2 justify-between items-center">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full mr-2 sm:mr-4">
                <button
                  onClick={() => {
                    setActiveTab('stats');
                    onSetBuildMode(null); // turn building mode off
                  }}
                  className={`px-2 py-1.5 text-[10px] font-bold tracking-wider rounded font-mono uppercase truncate border transition-all duration-150 cursor-pointer ${
                    activeTab === 'stats' 
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]' 
                      : 'bg-slate-900 text-slate-400 border-slate-700/80 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  Stats Upgrades
                </button>
                <button
                  onClick={() => {
                    setActiveTab('abilities');
                    onSetBuildMode(null); // turn building mode off
                  }}
                  className={`px-2 py-1.5 text-[10px] font-bold tracking-wider rounded font-mono uppercase truncate border transition-all duration-150 cursor-pointer ${
                    activeTab === 'abilities' 
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]' 
                      : 'bg-slate-900 text-slate-400 border-slate-700/80 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  Player Abilities
                </button>
                <button
                  onClick={() => {
                    setActiveTab('weapons');
                    onSetBuildMode(null); // turn building mode off
                  }}
                  className={`px-2 py-1.5 text-[10px] font-bold tracking-wider rounded font-mono uppercase truncate border transition-all duration-150 cursor-pointer ${
                    activeTab === 'weapons' 
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]' 
                      : 'bg-slate-900 text-slate-400 border-slate-700/80 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  Guns Shop
                </button>
                <button
                  onClick={() => {
                    setActiveTab('build');
                  }}
                  className={`px-2 py-1.5 text-[10px] font-bold tracking-wider rounded font-mono uppercase truncate border transition-all duration-150 cursor-pointer ${
                    activeTab === 'build' 
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]' 
                      : 'bg-slate-900 text-slate-400 border-slate-700/80 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  Defense Build
                </button>
              </div>

              {/* Banked state indicator inside tab block */}
              <div className="flex items-center shrink-0 gap-1 text-[11px] font-mono text-yellow-400 bg-yellow-400/5 px-2 py-0.5 rounded border border-yellow-500/20">
                <span>E-Bank: {coinsBanked}</span>
              </div>
            </div>

            {/* TAB CONTENT: STATS UPGRADES */}
            {activeTab === 'stats' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 h-44 overflow-y-auto pr-1">
                {waveActive && (
                  <div className="col-span-full bg-red-950/40 border border-red-900/40 text-red-400 text-[10px] font-sans py-2 px-3 rounded text-center uppercase tracking-wider font-bold mb-1 flex items-center justify-center gap-1.5 animate-pulse">
                    <Lock className="w-3.5 h-3.5 text-red-500" /> Stats upgrades locked during wave!
                  </div>
                )}
                {Object.values(upgrades)
                  .filter((upg: any) => upg.id === UpgradeType.DAMAGE || upg.id === UpgradeType.RELOAD_SPEED)
                  .map((upg: any) => {
                    const isMax = upg.level >= upg.maxLevel;
                    const canAfford = coinsBanked >= upg.cost;
                    const isDisabled = !canAfford || waveActive;

                    return (
                      <div 
                        key={upg.id} 
                        className="bg-slate-900/90 border border-slate-800 p-2 rounded flex flex-col justify-between hover:border-slate-700 transition-all text-xs"
                      >
                        <div>
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-slate-200 text-xs font-semibold">{upg.name}</span>
                            <span className="text-[10px] font-mono text-cyan-400">Lv {upg.level}/{upg.maxLevel}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight mt-1">{upg.description}</p>
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-800/60 pt-1.5 mt-2">
                          {/* Render Levels Indicator Blocks */}
                          <div className="flex gap-0.5">
                            {Array.from({ length: upg.maxLevel }).map((_, idx) => (
                              <div 
                                key={idx} 
                                className={`w-1.5 h-1.5 rounded-xs ${
                                  idx < upg.level 
                                    ? 'bg-cyan-400' 
                                    : 'bg-slate-800'
                                }`} 
                              />
                            ))}
                          </div>

                          {/* Cost logic button */}
                          {isMax ? (
                            <span className="text-[10px] text-emerald-400 uppercase font-bold font-mono flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> MAXED
                            </span>
                          ) : (
                            <button
                              onClick={() => onBuyUpgrade(upg.id)}
                              disabled={isDisabled}
                              className={`py-1 px-3 text-[10px] font-bold font-mono rounded transition-all ${
                                !isDisabled 
                                  ? 'bg-yellow-500 text-slate-950 hover:bg-yellow-400' 
                                  : 'bg-slate-850 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {waveActive ? 'LOCKED' : `${upg.cost} coins`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* TAB CONTENT: ABILITIES */}
            {activeTab === 'abilities' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 h-44 overflow-y-auto pr-1">
                {waveActive && (
                  <div className="col-span-full bg-red-950/40 border border-red-900/40 text-red-400 text-[10px] font-sans py-2 px-3 rounded text-center uppercase tracking-wider font-bold mb-1 flex items-center justify-center gap-1.5 animate-pulse">
                    <Lock className="w-3.5 h-3.5 text-red-500" /> Ability upgrades locked during wave!
                  </div>
                )}
                {Object.values(upgrades)
                  .filter((upg: any) => [UpgradeType.MAX_HEALTH, UpgradeType.MOVE_SPEED, UpgradeType.MAGNET_RADIUS, UpgradeType.AUTO_COLLECT, UpgradeType.TELEPORT].includes(upg.id))
                  .map((upg: any) => {
                    const isMax = upg.level >= upg.maxLevel;
                    const canAfford = coinsBanked >= upg.cost;
                    const isDisabled = !canAfford || waveActive;

                    return (
                      <div 
                        key={upg.id} 
                        className="bg-slate-900/90 border border-slate-800 p-2 rounded flex flex-col justify-between hover:border-slate-700 transition-all text-xs"
                      >
                        <div>
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-slate-200 text-xs font-semibold">{upg.name}</span>
                            <span className="text-[10px] font-mono text-cyan-400">Lv {upg.level}/{upg.maxLevel}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight mt-1">{upg.description}</p>
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-800/60 pt-1.5 mt-2">
                          {/* Render Levels Indicator Blocks */}
                          <div className="flex gap-0.5">
                            {Array.from({ length: upg.maxLevel }).map((_, idx) => (
                              <div 
                                key={idx} 
                                className={`w-1.5 h-1.5 rounded-xs ${
                                  idx < upg.level 
                                    ? 'bg-cyan-400' 
                                    : 'bg-slate-800'
                                }`} 
                              />
                            ))}
                          </div>

                          {/* Cost logic button */}
                          {isMax ? (
                            <span className="text-[10px] text-emerald-400 uppercase font-bold font-mono flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> MAXED
                            </span>
                          ) : (
                            <button
                              onClick={() => onBuyUpgrade(upg.id)}
                              disabled={isDisabled}
                              className={`py-1 px-3 text-[10px] font-bold font-mono rounded transition-all ${
                                !isDisabled 
                                  ? 'bg-yellow-500 text-slate-950 hover:bg-yellow-400' 
                                  : 'bg-slate-850 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {waveActive ? 'LOCKED' : `${upg.cost} coins`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* TAB CONTENT: WEAPONS SHOP */}
            {activeTab === 'weapons' && (
              <div className="grid grid-cols-1 gap-2 h-44 overflow-y-auto pr-1">
                {waveActive && (
                  <div className="bg-red-950/40 border border-red-900/40 text-red-400 text-[10px] font-sans py-2 px-3 rounded text-center uppercase tracking-wider font-bold mb-1 flex items-center justify-center gap-1.5 animate-pulse">
                    <Lock className="w-3.5 h-3.5 text-red-500" /> Weapons locker locked during wave!
                  </div>
                )}
                {weaponDetails.map((wd, index) => {
                  const weaponData = weapons[wd.type];
                  const isUnlocked = weaponData ? weaponData.unlocked : (wd.type === WeaponType.PISTOL);
                  const cost = weaponData ? weaponData.cost : 0;
                  const canAfford = coinsBanked >= cost;
                  const isActive = index === activeWeaponIndex;

                  return (
                    <div 
                      key={wd.type}
                      className={`p-2 rounded border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:border-slate-700 transition-all text-xs ${
                        isActive 
                          ? 'bg-cyan-950/20 border-cyan-500/50' 
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-100 font-bold text-xs">{wd.name}</span>
                          {isActive && <span className="bg-cyan-500/10 text-cyan-400 text-[8px] px-1.5 py-0.5 rounded border border-cyan-500/20 font-bold font-mono">EQUIPPED</span>}
                          {isUnlocked && !isActive && <span className="bg-emerald-500/10 text-emerald-400 text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold font-mono">UNLOCKED</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{wd.desc}</p>
                      </div>

                      {!isUnlocked ? (
                        <button
                          onClick={() => !waveActive && onBuyWeapon && onBuyWeapon(wd.type)}
                          disabled={!canAfford || waveActive}
                          className={`py-1 px-4 text-[10px] font-bold font-mono rounded transition-all shrink-0 ${
                            canAfford && !waveActive
                              ? 'bg-yellow-500 text-slate-950 hover:bg-yellow-400 cursor-pointer' 
                              : 'bg-slate-850 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Buy for {cost} c
                        </button>
                      ) : (
                        <button
                          onClick={() => !isActive && onSelectWeapon(index)}
                          disabled={isActive}
                          className={`py-1 px-4 text-[10px] font-bold font-mono rounded transition-all shrink-0 ${
                            isActive 
                              ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-500/40 cursor-not-allowed font-medium' 
                              : 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer'
                          }`}
                        >
                          {isActive ? 'ACTIVE' : 'EQUIP'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB CONTENT: DEFENSE BUILDERS */}
            {activeTab === 'build' && (
              <div className="flex flex-col space-y-2">
                <div className="grid grid-cols-2 gap-3 h-32">
                  
                  {/* MACHINE GUN TURRET */}
                  <div className={`p-2.5 rounded border flex flex-col justify-between transition-all ${
                    selectedTowerToBuild === TowerType.MACHINE_GUN
                      ? 'bg-blue-950/40 border-blue-500'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}>
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-100 font-bold text-xs">MG Turret</span>
                        <span className="font-mono text-amber-400 text-[11px] font-bold">Cost: 160</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        Rapid fires golden kinetic bullets at crawler targets within 18 meters.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        if (selectedTowerToBuild === TowerType.MACHINE_GUN) {
                          onSetBuildMode(null);
                        } else {
                          onSetBuildMode(TowerType.MACHINE_GUN);
                        }
                      }}
                      className={`w-full py-1 text-[11px] font-bold tracking-wider rounded font-mono ${
                        selectedTowerToBuild === TowerType.MACHINE_GUN
                          ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {selectedTowerToBuild === TowerType.MACHINE_GUN ? 'CANCEL PREVIEW' : 'CLICK TO BUILD'}
                    </button>
                  </div>

                  {/* SNIPER HEAVY REIL RAIL CORE */}
                  <div className={`p-2.5 rounded border flex flex-col justify-between transition-all ${
                    selectedTowerToBuild === TowerType.SNIPER
                      ? 'bg-purple-950/40 border-purple-500'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}>
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-100 font-bold text-xs">Sniper Core</span>
                        <span className="font-mono text-amber-400 text-[11px] font-bold">Cost: 320</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        Extremely long range heavy rail weapon (35m range). Slow fire rate.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        if (selectedTowerToBuild === TowerType.SNIPER) {
                          onSetBuildMode(null);
                        } else {
                          onSetBuildMode(TowerType.SNIPER);
                        }
                      }}
                      className={`w-full py-1 text-[11px] font-bold tracking-wider rounded font-mono ${
                        selectedTowerToBuild === TowerType.SNIPER
                          ? 'bg-red-650 hover:bg-red-500 text-white animate-pulse'
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                    >
                      {selectedTowerToBuild === TowerType.SNIPER ? 'CANCEL PREVIEW' : 'CLICK TO BUILD'}
                    </button>
                  </div>

                </div>

                {/* Bulding ghost helper instructions overlay inside build mode */}
                {selectedTowerToBuild && (
                  <div className="bg-amber-950/40 border border-amber-500/20 text-[10px] font-mono p-2 rounded text-amber-300 flex flex-col space-y-0.5 animate-pulse text-center">
                    <span>BUILD MODE ACTIVE - LOCKING MOUSE</span>
                    <span className="opacity-80">Look at the ground and LEFT-CLICK to place. RIGHT-CLICK or ESC to cancel.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sub-Panel: Right: Vital Health metrics & Ammo Weapon configurations */}
          <div className="w-full md:max-w-sm flex flex-col space-y-3">
            
            {/* Health Bars block */}
            <div className="bg-slate-950/85 border border-slate-800 rounded-lg p-4 space-y-3 pointer-events-auto">
              
              {/* PLayer Shield / HP bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-cyan-400 uppercase tracking-widest font-semibold">Player Nanite Shield</span>
                  <span className="font-mono font-bold text-white">{playerHealth} <span className="text-slate-500 text-[10px]">/ {maxPlayerHealth} HP</span></span>
                </div>
                <div className="w-full bg-slate-900 border border-slate-800 h-3 rounded overflow-hidden">
                  <div 
                    className="bg-cyan-500 h-full transition-all duration-150 rounded"
                    style={{ width: `${playerHPPercent}%` }}
                  />
                </div>
              </div>

              {/* Main Core Energy level bar */}
              <div className="space-y-1.5 border-t border-slate-900 pt-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-pink-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-pink-400" /> CENTRAL POWER CORE HEALTH
                  </span>
                  <span className="font-mono font-bold text-white">{coreHealth} <span className="text-slate-500 text-[10px]">/ {maxCoreHealth} HP</span></span>
                </div>
                <div className="w-full bg-slate-900 border border-slate-800 h-4.5 rounded overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-200 rounded ${
                      coreHPPercent < 30 ? 'bg-red-650 animate-pulse' : 'bg-pink-600'
                    }`}
                    style={{ width: `${coreHPPercent}%` }}
                  />
                </div>
              </div>

            </div>

            {/* Core Weapon and Ammo status section */}
            <div className="bg-slate-950/85 border border-slate-800 rounded-lg p-4 space-y-3.5 pointer-events-auto">
              <div className="flex gap-2">
                {weaponDetails.map((wd, index) => {
                  const isActive = index === activeWeaponIndex;
                  const weaponData = weapons[wd.type];
                  const isUnlocked = weaponData ? weaponData.unlocked : (wd.type === WeaponType.PISTOL);

                  if (!isUnlocked) {
                    return (
                      <div 
                        key={wd.type}
                        className="flex-1 py-1 px-1 rounded flex flex-col items-center justify-center border text-center transition-all bg-slate-900/40 border-slate-850/60 text-slate-500 opacity-60"
                        title={`Unlock ${wd.name} in the Guns Shop on the left!`}
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-600 mb-0.5" />
                        <span className="text-[10px] font-black leading-none uppercase truncate tracking-tight text-slate-500">{wd.name.split(' ')[0]}</span>
                        <span className="text-[9px] font-mono text-slate-600/80 mt-1">LOCKED</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={wd.type}
                      onClick={() => onSelectWeapon(index)}
                      className={`flex-1 py-2 px-1 rounded flex flex-col items-center justify-center border text-center transition-all cursor-pointer pointer-events-auto ${
                        isActive 
                          ? 'bg-slate-900 border-cyan-500/80 text-white shadow-md shadow-cyan-950/50' 
                          : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Key {wd.hotkey}</span>
                      <span className="text-xs font-bold leading-tight uppercase tracking-tight truncate mt-0.5 max-w-[95%]">{wd.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Weapon Ammo count display */}
              <div className="bg-slate-900 p-3 rounded border border-slate-855 flex justify-between items-center font-mono">
                <div>
                  <h4 className="text-xs uppercase text-slate-400 tracking-wider">Active Weapon</h4>
                  <div className="text-sm font-extrabold text-white uppercase mt-0.5">{activeWeapon.name}</div>
                  <p className="text-[10px] text-slate-500 tracking-tight leading-none mt-1">{activeWeapon.desc}</p>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className="text-[10px] uppercase text-slate-400 tracking-wider">Ammo clip</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    {activeWeaponAmmo.isReloading ? (
                      <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> RELOADING
                      </span>
                    ) : (
                      <>
                        <span className="text-2xl font-black text-white">{activeWeaponAmmo.ammo}</span>
                        <span className="text-xs text-slate-500">/ {
                          activeWeapon.type === WeaponType.PISTOL ? 12 : (activeWeapon.type === WeaponType.RIFLE ? 30 : 6)
                        }</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>

        </footer>
      )}

      {/* 7. FIGHTING PHASE BOTTOM-CENTER HUD */}
      {gameStarted && !isGameOver && waveActive && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center min-w-[325px] sm:min-w-[420px] max-w-lg">
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-4 w-full flex flex-col space-y-3 pointer-events-auto shadow-2xl relative">
            
            {/* Wave Status inside Combat HUD */}
            <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded-md border border-slate-850/80">
              <span className="text-[10px] font-mono text-cyan-400 font-black uppercase tracking-wider animate-pulse">WAVE {currentWave} SECURING</span>
              <span className="text-[10px] font-mono text-slate-100 font-extrabold">{activeEnemies} / {totalWaveEnemies} BEASTS REMAINING</span>
            </div>

            {/* Player Shields */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] uppercase">
                <span className="font-mono text-cyan-400 tracking-widest font-extrabold">Player Nanite Shield</span>
                <span className="font-mono font-extrabold text-white text-xs">{playerHealth} <span className="text-slate-500 text-[10px]">/ {maxPlayerHealth} HP</span></span>
              </div>
              <div className="w-full bg-slate-900 border border-slate-800/60 h-2.5 rounded overflow-hidden">
                <div 
                  className="bg-cyan-500 h-full transition-all duration-150 rounded"
                  style={{ width: `${playerHPPercent}%` }}
                />
              </div>
            </div>

            {/* Central Power Core */}
            <div className="space-y-1 pt-1.5 border-t border-slate-900/60">
              <div className="flex justify-between items-center text-[10px] uppercase">
                <span className="font-mono text-pink-400 tracking-widest font-extrabold flex items-center gap-1">
                  <Zap className="w-3 h-3 text-pink-405 animate-pulse" /> CENTRAL GENERATOR CORE
                </span>
                <span className="font-mono font-extrabold text-white text-xs">{coreHealth} <span className="text-slate-500 text-[10px]">/ {maxCoreHealth} HP</span></span>
              </div>
              <div className="w-full bg-slate-900 border border-slate-800/60 h-4 rounded overflow-hidden">
                <div 
                  className={`h-full transition-all duration-200 rounded ${
                    coreHPPercent < 30 ? 'bg-red-605 animate-pulse' : 'bg-pink-600'
                  }`}
                  style={{ width: `${coreHPPercent}%` }}
                />
              </div>
            </div>

            {/* Weapon & Ammo clip HUD segment */}
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-900/60 font-mono text-[10px]">
              <span className="text-slate-400 font-extrabold uppercase truncate max-w-[150px]">{activeWeapon.name.split(' (')[0]}</span>
              <div className="flex items-center gap-1.5">
                {activeWeaponAmmo.isReloading ? (
                  <span className="text-amber-400 font-black tracking-wider uppercase animate-pulse flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> RELOADING
                  </span>
                ) : (
                  <span className="text-cyan-405 font-black">{activeWeaponAmmo.ammo} <span className="text-slate-500 text-[8px]">/ {
                    activeWeapon.type === WeaponType.PISTOL ? 12 : (activeWeapon.type === WeaponType.RIFLE ? 30 : 6)
                  } SHELLS</span></span>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
export default GameUI;
