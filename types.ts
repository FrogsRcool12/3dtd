/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum WeaponType {
  PISTOL = 'pistol',
  RIFLE = 'rifle',
  SHOTGUN = 'shotgun'
}

export interface Weapon {
  id: WeaponType;
  name: string;
  damage: number;
  fireRate: number;      // delay in ms
  clipSize: number;
  reloadTime: number;    // delay in ms
  spread: number;
  range: number;
  projectiles: number;
  color: string;
}

export enum UpgradeType {
  DAMAGE = 'damage',
  MAX_HEALTH = 'maxHealth',
  RELOAD_SPEED = 'reloadSpeed',
  MOVE_SPEED = 'moveSpeed',
  MAGNET_RADIUS = 'magnetRadius',
  AUTO_COLLECT = 'autoCollect',
  TELEPORT = 'teleport'
}

export interface Upgrade {
  id: UpgradeType;
  name: string;
  description: string;
  cost: number;
  level: number;
  maxLevel: number;
  value: number;         // current multiplier or boost value
}

export enum TowerType {
  MACHINE_GUN = 'machine_gun',
  SNIPER = 'sniper'
}

export interface TowerDef {
  id: TowerType;
  name: string;
  description: string;
  cost: number;
  damage: number;
  fireRate: number;      // delay in ms
  range: number;
  color: string;
}

export interface GameState {
  playerHealth: number;
  maxPlayerHealth: number;
  coreHealth: number;
  maxCoreHealth: number;
  coinsCarried: number;
  coinsBanked: number;
  currentWave: number;
  waveActive: boolean;
  waveCountdown: number; // time left before next wave (seconds)
  activeEnemies: number;
  totalWaveEnemies: number;
  activeWeaponIndex: number;
  weapons: Record<WeaponType, { ammo: number; isReloading: boolean; unlocked: boolean; cost: number }>;
  upgrades: Record<UpgradeType, Upgrade>;
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
  respawning: boolean;
  respawnTimer: number;
  selectedTowerToBuild: TowerType | null;
  canBuild: boolean;
}
