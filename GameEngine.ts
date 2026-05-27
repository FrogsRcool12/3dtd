/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Engine,
  Scene,
  Vector3,
  Color3,
  Color4,
  StandardMaterial,
  MeshBuilder,
  Mesh,
  HemisphericLight,
  DirectionalLight,
  Ray,
  Nullable
} from '@babylonjs/core';
import { GameState, WeaponType, UpgradeType, TowerType } from '../types';
import { PlayerManager } from './PlayerManager';
import { EnemyManager, Enemy } from './EnemyManager';
import { DefenseManager } from './DefenseManager';
import { CoinManager } from './CoinManager';

export class GameEngine {
  private engine: Engine;
  private scene: Scene;

  // Sub Managers
  public player!: PlayerManager;
  public enemies!: EnemyManager;
  public defenses!: DefenseManager;
  public coins!: CoinManager;

  // Environment elements
  private ground!: Mesh;
  private coreMesh!: Mesh;
  private coreOrbitRing1!: Mesh;
  private coreOrbitRing2!: Mesh;
  private coreHealth: number = 1000;
  private maxCoreHealth: number = 1000;
  private coreMaterial!: StandardMaterial;

  // UI state bridge
  private stateChangeCallback: (state: GameState) => void;
  private stateThrottleTimer: number = 0;
  private waveStartCountdown: number = 10; // seconds before first wave
  private waveCountTimer: number = 10.0;
  private currentWaveIndex: number = 1;
  private score: number = 0;
  private walletCarried: number = 0;
  private walletBanked: number = 50;
  private isPaused: boolean = false;
  private isGameOver: boolean = false;
  private isRespawning: boolean = false;
  private respawnTimeRemaining: number = 0.0;

  // Placing defense towers variables
  private isBuildMode: boolean = false;
  private buildTowerType: TowerType | null = null;
  private groundHeightOffset: number = 0.1;

  constructor(canvas: HTMLCanvasElement, onStateChange: (state: GameState) => void) {
    this.stateChangeCallback = onStateChange;

    // 1. Instantiate the Babylon Engine & Scene
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.02, 0.03, 0.08, 1.0); // Polished deep cosmic space slate backdrop (never clashes with HUD UI)

    // Configure depth/stencil buffers so that rendering group 1 (tactical x-ray outlines for mobs)
    // always draws on top of everything inside rendering group 0 (walls, towers).
    this.scene.setRenderingAutoClearDepthStencil(1, true, true, false);

    // 2. Setup Lighting & Atmosphere
    this.createLights();

    // 3. Setup Ground & Environment
    this.createGround();
    this.createCentralCore();
    this.createEnvironmentPillars();

    // 4. Initialize Manager Modules
    this.player = new PlayerManager(this.scene);
    this.enemies = new EnemyManager(this.scene);
    this.defenses = new DefenseManager(this.scene);
    this.coins = new CoinManager(this.scene);

    // 5. Setup Interactive Event Listeners
    this.setupInteractions();

    // 6. Spawn Core Banking visual indicator
    this.createCoreTriggerZoneRing();

    // 7. Start standard render loop
    this.engine.runRenderLoop(() => {
      if (this.isPaused || this.isGameOver) {
        this.scene.render();
        return;
      }
      this.update();
      this.scene.render();
    });

    // Handle Window resize events
    window.addEventListener('resize', this.handleResize);

    // Initial Trigger UI synchronization
    this.pushUIState();
  }

  private handleResize = () => {
    this.engine.resize();
  };

  private createLights() {
    // Hemispheric ambient lighting (sky/ground bounce colors)
    const hemiLight = new HemisphericLight('hemi_ambient', new Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.85; // Atmospheric neon night intensity
    hemiLight.groundColor = new Color3(0.04, 0.05, 0.12); // Deep navy space bounce
    hemiLight.diffuse = new Color3(0.75, 0.82, 0.98); // Cool cosmic ambient starlight

    // Directional celestial lighting for crisp geometry shadows representing a solar sun
    const dirLight = new DirectionalLight('dir_shadows', new Vector3(-1, -2, -1), this.scene);
    dirLight.position = new Vector3(20, 40, 20);
    dirLight.intensity = 1.0; 
    dirLight.diffuse = new Color3(0.88, 0.92, 1.0); // Radiant stellar white-blue star
  }

  private createGround() {
    // Elegant dark space graphite/titanium ground (harmonizes with sci-fi themes)
    this.ground = MeshBuilder.CreateGround('battle_ground', {
      width: 150,
      height: 150,
    }, this.scene);

    const groundMat = new StandardMaterial('ground_mat', this.scene);
    groundMat.diffuseColor = new Color3(0.08, 0.09, 0.15); // Dark slate cosmic cyber tile
    groundMat.specularColor = new Color3(0.12, 0.13, 0.22); // Subtle specular reflective finish
    this.ground.material = groundMat;
  }

  private createCentralCore() {
    // The prime central elevated steel carbon castle platform (8x8x3) that player defends
    const baseBox = MeshBuilder.CreateBox('core_base', {
      width: 8.0,
      height: 3.0,
      depth: 8.0,
    }, this.scene);
    baseBox.position.set(0, 1.5, 0);

    const baseMat = new StandardMaterial('core_base_mat', this.scene);
    baseMat.diffuseColor = new Color3(0.15, 0.18, 0.25); // Sleek dark metallic carbon-steel base
    baseMat.specularColor = new Color3(0.25, 0.25, 0.28);
    baseBox.material = baseMat;

    // High-tech carbon trim elements (crenellations/merlons) along the top edges
    const parapetBorderMat = new StandardMaterial('parapet_mat', this.scene);
    parapetBorderMat.diffuseColor = new Color3(0.2, 0.24, 0.32); // Radiant titanium accent panels
    parapetBorderMat.specularColor = new Color3(0.3, 0.3, 0.35);

    // Corner defensive towers extending above platform
    const towerPositions = [
      { x: -3.6, z: -3.5 },
      { x: 3.6, z: -3.5 },
      { x: -3.6, z: 3.5 },
      { x: 3.6, z: 3.5 },
    ];
    towerPositions.forEach((tp, index) => {
      const cornerTower = MeshBuilder.CreateBox(`corner_tower_${index}`, {
        width: 1.2,
        height: 3.8,
        depth: 1.1
      }, this.scene);
      cornerTower.position.set(tp.x, 1.9, tp.z);
      cornerTower.material = parapetBorderMat;
    });

    // Side walls or crenellations along edges:
    // South side (Z = -3.85)
    const crenellS1 = MeshBuilder.CreateBox('crenell_s1', { width: 1.2, height: 0.6, depth: 0.3 }, this.scene);
    crenellS1.position.set(-1.8, 3.3, -3.85);
    crenellS1.material = parapetBorderMat;
    const crenellS2 = MeshBuilder.CreateBox('crenell_s2', { width: 1.2, height: 0.6, depth: 0.3 }, this.scene);
    crenellS2.position.set(1.8, 3.3, -3.85);
    crenellS2.material = parapetBorderMat;

    // North side (Z = 3.85) - leave some middle room for ladder climbing at X=0
    const crenellN1 = MeshBuilder.CreateBox('crenell_n1', { width: 1.2, height: 0.6, depth: 0.3 }, this.scene);
    crenellN1.position.set(-2.0, 3.3, 3.85);
    crenellN1.material = parapetBorderMat;
    const crenellN2 = MeshBuilder.CreateBox('crenell_n2', { width: 1.2, height: 0.6, depth: 0.3 }, this.scene);
    crenellN2.position.set(2.0, 3.3, 3.85);
    crenellN2.material = parapetBorderMat;

    // West side (X = -3.85)
    const crenellW1 = MeshBuilder.CreateBox('crenell_w1', { width: 0.3, height: 0.6, depth: 1.2 }, this.scene);
    crenellW1.position.set(-3.85, 3.3, -1.8);
    crenellW1.material = parapetBorderMat;
    const crenellW2 = MeshBuilder.CreateBox('crenell_w2', { width: 0.3, height: 0.6, depth: 1.2 }, this.scene);
    crenellW2.position.set(-3.85, 3.3, 1.8);
    crenellW2.material = parapetBorderMat;

    // East side (X = 3.85)
    const crenellE1 = MeshBuilder.CreateBox('crenell_e1', { width: 0.3, height: 0.6, depth: 1.2 }, this.scene);
    crenellE1.position.set(3.85, 3.3, -1.8);
    crenellE1.material = parapetBorderMat;
    const crenellE2 = MeshBuilder.CreateBox('crenell_e2', { width: 0.3, height: 0.6, depth: 1.2 }, this.scene);
    crenellE2.position.set(3.85, 3.3, 1.8);
    crenellE2.material = parapetBorderMat;

    // Build a visible 3D metal ladder on the back North face of the castle (Z = 4.0)
    const ladderGroup = new Mesh('castle_ladder', this.scene);
    const ladderMat = new StandardMaterial('ladder_mat', this.scene);
    ladderMat.diffuseColor = new Color3(0.5, 0.5, 0.55); // Grey metallic ladder rungs
    ladderMat.specularColor = new Color3(0.8, 0.8, 0.8);

    // Left rail
    const leftRail = MeshBuilder.CreateBox('ladder_rail_l', { width: 0.05, height: 3.2, depth: 0.05 }, this.scene);
    leftRail.position.set(-0.45, 1.5, 4.05);
    leftRail.material = ladderMat;
    leftRail.parent = ladderGroup;

    // Right rail
    const rightRail = MeshBuilder.CreateBox('ladder_rail_r', { width: 0.05, height: 3.2, depth: 0.05 }, this.scene);
    rightRail.position.set(0.45, 1.5, 4.05);
    rightRail.material = ladderMat;
    rightRail.parent = ladderGroup;

    // 10 Horizontal rungs
    for (let r = 0; r < 10; r++) {
      const rungY = 0.15 + r * 0.3;
      const rung = MeshBuilder.CreateCylinder(`ladder_rung_${r}`, { diameter: 0.035, height: 0.85 }, this.scene);
      rung.rotation.z = Math.PI / 2; // turn horizontal
      rung.position.set(0, rungY, 4.05);
      rung.material = ladderMat;
      rung.parent = ladderGroup;
    }

    // Glowing rotating energy core (low-poly segments sphere for diamond aura) raised to float above castle top
    this.coreMesh = MeshBuilder.CreateSphere('glowing_core', { segments: 4, diameter: 1.85 }, this.scene);
    this.coreMesh.position.set(0, 4.4, 0);

    this.coreMaterial = new StandardMaterial('glowing_core_mat', this.scene);
    this.coreMaterial.diffuseColor = new Color3(0.0, 0.9, 1.0); // electric neon cyan
    this.coreMaterial.emissiveColor = new Color3(0.0, 0.4, 0.6);
    this.coreMesh.material = this.coreMaterial;

    // Beautiful concentric metallic orbital shields floating around core raised above castle top
    this.coreOrbitRing1 = MeshBuilder.CreateTorus('orbit_ring_1', {
      diameter: 3.2,
      thickness: 0.15,
      tessellation: 8, // minimalist low poly
    }, this.scene);
    this.coreOrbitRing1.position.set(0, 4.4, 0);
    this.coreOrbitRing1.material = parapetBorderMat;

    this.coreOrbitRing2 = MeshBuilder.CreateTorus('orbit_ring_2', {
      diameter: 2.5,
      thickness: 0.12,
      tessellation: 6,
    }, this.scene);
    this.coreOrbitRing2.position.set(0, 4.4, 0);
    this.coreOrbitRing2.material = parapetBorderMat;
  }

  private createEnvironmentPillars() {
    // Build 4 large technological pillars on corners to give scale to map
    const corners = [
      new Vector3(45, 0, 45),
      new Vector3(-45, 0, 45),
      new Vector3(45, 0, -45),
      new Vector3(-45, 0, -45)
    ];

    const pillarMat = new StandardMaterial('pillar_mat', this.scene);
    pillarMat.diffuseColor = new Color3(0.08, 0.1, 0.12);
    
    corners.forEach((pos, i) => {
      const p = MeshBuilder.CreateCylinder(`env_pillar_${i}`, {
        diameterTop: 1.5,
        diameterBottom: 2.5,
        height: 12.0,
      }, this.scene);
      p.position.copyFrom(pos);
      p.position.y = 6.0;
      p.material = pillarMat;

      // Add a small glowing crystal beacon on top of each pillar
      const beacon = MeshBuilder.CreateSphere(`env_beac_${i}`, { diameter: 1.2 }, this.scene);
      beacon.position.copyFrom(pos);
      beacon.position.y = 12.5;
      const bMat = new StandardMaterial(`beac_m_${i}`, this.scene);
      bMat.emissiveColor = new Color3(0, 0.6, 0.8);
      beacon.material = bMat;
    });
  }

  private createCoreTriggerZoneRing() {
    // Highlight base perimeter with a futuristic neon indicator ring
    const ring = MeshBuilder.CreateTorus('deposit_perimeter', {
      diameter: 7.2,
      thickness: 0.08,
      tessellation: 32,
    }, this.scene);
    ring.position.set(0, 0.1, 0);

    const rMat = new StandardMaterial('deposit_perimeter_mat', this.scene);
    rMat.emissiveColor = new Color3(0, 0.4, 0.6);
    rMat.diffuseColor = Color3.Black();
    ring.material = rMat;
  }

  private setupInteractions() {
    // Listen to mouse clicking for shooting or placing defense towers
    let isMouseDown = false;

    window.addEventListener('mousedown', (e) => {
      const canvas = this.scene.getEngine().getRenderingCanvas();
      if (document.pointerLockElement !== canvas) return;

      if (e.button === 0) { // Left-click
        if (this.isBuildMode && this.buildTowerType) {
          // Place defense tower!
          const groundPt = this.getGroundAimPoint();
          if (groundPt) {
            const cost = this.defenses.towerDefs[this.buildTowerType].cost;
            if (this.walletBanked >= cost) {
              this.walletBanked -= cost;
              this.defenses.placeTower(groundPt, this.buildTowerType);
              this.triggerTowerPlacementPulse(groundPt);
              
              // Done building automatically
              this.isBuildMode = false;
              this.buildTowerType = null;
              this.pushUIState();
            }
          }
        } else {
          // Normal Firing
          isMouseDown = true;
          this.player.setShootingState(true);
        }
      } else if (e.button === 2) { // Right-click (cancels building)
        if (this.isBuildMode) {
          this.isBuildMode = false;
          this.buildTowerType = null;
          this.defenses.removeGhostPreview();
          this.pushUIState();
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        isMouseDown = false;
        this.player.setShootingState(false);
      }
    });

    // Cancel building via Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isBuildMode) {
        this.isBuildMode = false;
        this.buildTowerType = null;
        this.defenses.removeGhostPreview();
        this.pushUIState();
      }
    });
  }

  // Get mapped location player aiming on the ground for build previews/tower placement
  private getGroundAimPoint(): Nullable<Vector3> {
    const engine = this.scene.getEngine();
    const pickResult = this.scene.pick(
      engine.getRenderWidth() / 2,
      engine.getRenderHeight() / 2,
      (mesh) => mesh === this.ground || mesh.name === 'core_base'
    );

    if (pickResult && pickResult.hit && pickResult.pickedPoint) {
      return pickResult.pickedPoint;
    }
    return null;
  }

  // Toggle user build mode from UI
  public setBuildMode(type: TowerType | null) {
    if (this.isGameOver) return;

    if (type === null) {
      this.isBuildMode = false;
      this.buildTowerType = null;
      this.defenses.removeGhostPreview();
    } else {
      this.isBuildMode = true;
      this.buildTowerType = type;
    }
    this.pushUIState();
  }

  // Visual expansion rings when elements are placed or coined!
  private triggerTowerPlacementPulse(pos: Vector3) {
    const pulseRing = MeshBuilder.CreateCylinder('pulse', {
      height: 0.1,
      diameter: 0.1,
    }, this.scene);
    pulseRing.position.copyFrom(pos);
    pulseRing.position.y = 0.2;

    const pMat = new StandardMaterial('p_pulse_mat', this.scene);
    pMat.emissiveColor = new Color3(0, 1.0, 0.5); // green pulse
    pMat.diffuseColor = Color3.Black();
    pulseRing.material = pMat;

    let scale = 1.0;
    const interval = setInterval(() => {
      scale += 0.8;
      pulseRing.scaling.x = scale;
      pulseRing.scaling.z = scale;
      pMat.alpha = Math.max(0, 1.0 - scale / 10);

      if (scale >= 10.0) {
        clearInterval(interval);
        pulseRing.dispose();
        pMat.dispose();
      }
    }, 20);
  }

  // Core banking gold coin visuals
  private triggerCoreDepositPulse() {
    const pulse = MeshBuilder.CreateCylinder('dep_ring', {
      height: 0.1,
      diameter: 7.2,
    }, this.scene);
    pulse.position.set(0, 0.2, 0);

    const dMat = new StandardMaterial('d_pulse_mat', this.scene);
    dMat.emissiveColor = new Color3(1.0, 0.85, 0); // shining golden base pulse
    dMat.diffuseColor = Color3.Black();
    pulse.material = dMat;

    let scale = 1.0;
    const pulseTimer = setInterval(() => {
      scale += 0.2;
      pulse.scaling.x = scale;
      pulse.scaling.z = scale;
      dMat.alpha = Math.max(0, 1.0 - scale / 4);

      if (scale >= 4.0) {
        clearInterval(pulseTimer);
        pulse.dispose();
        dMat.dispose();
      }
    }, 16);
  }

  // Set visual color depending on Core Health
  private updateCoreVisualHealth() {
    const healthRatio = this.coreHealth / this.maxCoreHealth;
    
    // Smooth shift neon cyan -> deep toxic red
    this.coreMaterial.diffuseColor = new Color3(1.0 - healthRatio, healthRatio, healthRatio * 0.5);
    this.coreMaterial.emissiveColor = new Color3((1.0 - healthRatio) * 0.5, healthRatio * 0.4, healthRatio * 0.6);
  }

  // Core gameplay logic tick
  private update() {
    const deltaTime = Math.min(0.05, this.scene.getEngine().getDeltaTime() / 1000.0); // lock extreme lag jumps

    // Rotate core meshes beautifully
    if (this.coreMesh) {
      this.coreMesh.rotation.y += deltaTime * 0.8;
      this.coreMesh.rotation.x += deltaTime * 0.25;

      this.coreOrbitRing1.rotation.x += deltaTime * 1.5;
      this.coreOrbitRing1.rotation.y += deltaTime * 0.6;

      this.coreOrbitRing2.rotation.y -= deltaTime * 1.8;
      this.coreOrbitRing2.rotation.z += deltaTime * 0.8;
    }

    // 1. Wave Scheduler
    // Automatic timer-based wave triggers has been disabled and replaced with manual button presses in the HUD UI.

    // 2. Manage Player State / Respawning countdowns
    if (this.isRespawning) {
      this.respawnTimeRemaining -= deltaTime;
      if (this.respawnTimeRemaining <= 0) {
        this.isRespawning = false;
        this.player.respawn(Vector3.Zero());
        this.walletCarried = 0; // carried coins dropped are lost unless picked up from floor
        this.pushUIState();
      }
    }

    // 3. Update Sub-systems
    const activeEnemiesList = this.enemies.getEnemies();

    this.player.update(deltaTime, activeEnemiesList);
    
    this.enemies.update(
      deltaTime,
      this.player.mesh.position,
      Vector3.Zero(), // Central Core is at (0, 0, 0)
      
      // Damage Player
      (dmg) => {
        this.player.takeDamage(dmg);
        this.pushUIState();
        
        // Trigger Respawn Scheduler if died
        if (this.player.isPlayerDead() && !this.isRespawning) {
          this.isRespawning = true;
          this.respawnTimeRemaining = 3.0; // 3 seconds respawn countdown

          // Drop all carried coins at coordinates
          if (this.walletCarried > 0) {
            this.coins.dropAllCoins(this.player.mesh.position, this.walletCarried);
            this.walletCarried = 0;
          }
          this.pushUIState();
        }
      },

      // Damage Core
      (dmg) => {
        this.coreHealth = Math.max(0, this.coreHealth - dmg);
        this.updateCoreVisualHealth();
        this.pushUIState();

        if (this.coreHealth <= 0) {
          this.triggerGameOver();
        }
      },

      // Spawning Enemy Hook
      (pos) => {
        this.pushUIState();
      },

      // Enemy Killed Hook (Drops coin with gold value)
      (enemy) => {
        let coinValue = 3; // Start game easier: 3 coins instead of 1 for basic
        if (enemy.type === 'boss') coinValue = 50; // Doubled
        else if (enemy.type === 'tank') coinValue = 12; // Doubled
        else if (enemy.type === 'fast') coinValue = 6; // Tripled

        this.coins.spawnCoin(enemy.mesh.position, coinValue);
        this.score += coinValue * 10;
        this.pushUIState();
      }
    );

    // Update Auto Defense Turrets
    this.defenses.update(deltaTime, activeEnemiesList);

    // Update Coins Magnet and Auto-Collection physics
    const currentMagnetUpgradeRadius = 3.0 + (this.player.levelUpgrades[UpgradeType.MAGNET_RADIUS] - 1) * 2.3; // start 3m, grow +2.3m per level
    const currentAutoCollectActive = this.player.levelUpgrades[UpgradeType.AUTO_COLLECT] > 0;

    this.coins.update(
      deltaTime,
      this.player.mesh.position,
      currentMagnetUpgradeRadius,
      currentAutoCollectActive,
      
      // Collect coin callback
      (value) => {
        this.walletCarried += value;
        this.pushUIState();
      }
    );

    // 4. Base Banking Detection (Player stands near central core, OR anywhere on the elevated main tower)
    if (!this.player.isPlayerDead()) {
      const playerPos = this.player.mesh.position;
      const onTowerPlatform = Math.abs(playerPos.x) <= 4.2 && Math.abs(playerPos.z) <= 4.2 && playerPos.y >= 2.5;
      const distanceToCore = Vector3.Distance(playerPos, Vector3.Zero());
      const isNearCoreOnGround = distanceToCore <= 4.0;

      if ((onTowerPlatform || isNearCoreOnGround) && this.walletCarried > 0) {
        // Trigger bank deposit!
        this.walletBanked += this.walletCarried;
        this.walletCarried = 0;
        this.triggerCoreDepositPulse();
        this.pushUIState();
      }
    }

    // 5. Handle Wave Clear Transitions
    if (this.enemies.waveActive === false && this.enemies.getActiveCount() === 0 && this.enemies.getTotalWaveEnemies() > 0) {
      // Current Wave Cleared! Increment wave index and award bonus!
      this.currentWaveIndex++;
      this.walletBanked += this.currentWaveIndex * 15; // wave bonus coins!
      this.enemies.totalWaveCountEnemies = 0; // reset active count
      this.waveCountTimer = 0; // prep phase has no time limit
      this.pushUIState();
    }

    // 6. Ghost Preview Placement Positioning for Build Mode
    if (this.isBuildMode && this.buildTowerType) {
      const groundAim = this.getGroundAimPoint();
      this.defenses.updateGhostPreview(groundAim, this.buildTowerType);
    } else {
      this.defenses.removeGhostPreview();
    }

    // Rate throttle React UI state push (ticks approx 12 times a second)
    this.stateThrottleTimer += deltaTime;
    if (this.stateThrottleTimer >= 0.1) {
      this.stateThrottleTimer = 0;
      this.pushUIState();
    }
  }

  // Trigger ending logic
  private triggerGameOver() {
    this.isGameOver = true;
    this.pushUIState();
  }

  // State builder and publisher to React components
  private pushUIState() {
    const wp = this.player.getActiveWeapon();
    const activeAmmo = this.player.getActiveWeaponAmmo();
    const isReloading = this.player.reloadingStatus[wp.id];

    // Build the dynamic system upgrades parameters
    const upgradesDefObj = {
      [UpgradeType.DAMAGE]: {
        id: UpgradeType.DAMAGE,
        name: 'Quantum Coils (Damage)',
        description: 'Increases weapon damage output by +25% per level.',
        cost: 20 + this.player.levelUpgrades[UpgradeType.DAMAGE] * 15,
        level: this.player.levelUpgrades[UpgradeType.DAMAGE],
        maxLevel: 10,
        value: 1.0 + (this.player.levelUpgrades[UpgradeType.DAMAGE] - 1) * 0.25
      },
      [UpgradeType.MAX_HEALTH]: {
        id: UpgradeType.MAX_HEALTH,
        name: 'Nanite Shell (Max HP)',
        description: 'Boosts maximum shield capacity by +25 HP.',
        cost: 15 + this.player.levelUpgrades[UpgradeType.MAX_HEALTH] * 12,
        level: this.player.levelUpgrades[UpgradeType.MAX_HEALTH],
        maxLevel: 10,
        value: 100 + (this.player.levelUpgrades[UpgradeType.MAX_HEALTH] - 1) * 25
      },
      [UpgradeType.RELOAD_SPEED]: {
        id: UpgradeType.RELOAD_SPEED,
        name: 'Rapid Charger (Reload)',
        description: 'Accelerates weapon reloading speeds by +20% per level.',
        cost: 25 + this.player.levelUpgrades[UpgradeType.RELOAD_SPEED] * 15,
        level: this.player.levelUpgrades[UpgradeType.RELOAD_SPEED],
        maxLevel: 5,
        value: 1.0 + (this.player.levelUpgrades[UpgradeType.RELOAD_SPEED] - 1) * 0.20
      },
      [UpgradeType.MOVE_SPEED]: {
        id: UpgradeType.MOVE_SPEED,
        name: 'Solenoid Liners (Speed)',
        description: 'Enhances player sprint and horizontal velocities by +16% per level.',
        cost: 15 + this.player.levelUpgrades[UpgradeType.MOVE_SPEED] * 10,
        level: this.player.levelUpgrades[UpgradeType.MOVE_SPEED],
        maxLevel: 5,
        value: 1.0 + (this.player.levelUpgrades[UpgradeType.MOVE_SPEED] - 1) * 0.16
      },
      [UpgradeType.MAGNET_RADIUS]: {
        id: UpgradeType.MAGNET_RADIUS,
        name: 'Flux Magnet (Radius)',
        description: 'Expands gravity matrix magnet core radius by +2.3m.',
        cost: 10 + this.player.levelUpgrades[UpgradeType.MAGNET_RADIUS] * 8,
        level: this.player.levelUpgrades[UpgradeType.MAGNET_RADIUS],
        maxLevel: 6,
        value: 3.0 + (this.player.levelUpgrades[UpgradeType.MAGNET_RADIUS] - 1) * 2.3
      },
      [UpgradeType.AUTO_COLLECT]: {
        id: UpgradeType.AUTO_COLLECT,
        name: 'Void Drone (Auto-Collect)',
        description: 'Deploy auto-collection drone representing gravitational fields. Gathers coins automatically.',
        cost: 120, // expensive but very useful late-game
        level: this.player.levelUpgrades[UpgradeType.AUTO_COLLECT],
        maxLevel: 1,
        value: this.player.levelUpgrades[UpgradeType.AUTO_COLLECT]
      },
      [UpgradeType.TELEPORT]: {
        id: UpgradeType.TELEPORT,
        name: 'Warp Node (Base Teleport)',
        description: 'Enables base teleportation capability. Press the "T" key to return to base anytime.',
        cost: 150,
        level: this.player.levelUpgrades[UpgradeType.TELEPORT],
        maxLevel: 1,
        value: this.player.levelUpgrades[UpgradeType.TELEPORT]
      }
    } as Record<UpgradeType, any>;

    // Build the weapons status records
    const weaponRec = {
      [WeaponType.PISTOL]: {
        ammo: this.player.currentWeaponAmmo[WeaponType.PISTOL],
        isReloading: this.player.reloadingStatus[WeaponType.PISTOL],
        unlocked: this.player.unlockedWeapons[WeaponType.PISTOL],
        cost: this.player.weaponCosts[WeaponType.PISTOL]
      },
      [WeaponType.RIFLE]: {
        ammo: this.player.currentWeaponAmmo[WeaponType.RIFLE],
        isReloading: this.player.reloadingStatus[WeaponType.RIFLE],
        unlocked: this.player.unlockedWeapons[WeaponType.RIFLE],
        cost: this.player.weaponCosts[WeaponType.RIFLE]
      },
      [WeaponType.SHOTGUN]: {
        ammo: this.player.currentWeaponAmmo[WeaponType.SHOTGUN],
        isReloading: this.player.reloadingStatus[WeaponType.SHOTGUN],
        unlocked: this.player.unlockedWeapons[WeaponType.SHOTGUN],
        cost: this.player.weaponCosts[WeaponType.SHOTGUN]
      }
    } as Record<WeaponType, any>;

    const hasEnoughForBuildType = this.buildTowerType 
      ? this.walletBanked >= this.defenses.towerDefs[this.buildTowerType].cost 
      : false;

    this.stateChangeCallback({
      playerHealth: this.player.health,
      maxPlayerHealth: this.player.maxHealth,
      coreHealth: this.coreHealth,
      maxCoreHealth: this.maxCoreHealth,
      coinsCarried: this.walletCarried,
      coinsBanked: this.walletBanked,
      currentWave: this.currentWaveIndex,
      waveActive: this.enemies.waveActive,
      waveCountdown: Math.ceil(this.waveCountTimer),
      activeEnemies: this.enemies.getActiveCount(),
      totalWaveEnemies: this.enemies.getTotalWaveEnemies(),
      activeWeaponIndex: this.player.currentWeaponIndex,
      weapons: weaponRec,
      upgrades: upgradesDefObj,
      score: this.score,
      isGameOver: this.isGameOver,
      isPaused: this.isPaused,
      respawning: this.isRespawning,
      respawnTimer: Math.ceil(this.respawnTimeRemaining),
      selectedTowerToBuild: this.buildTowerType,
      canBuild: hasEnoughForBuildType
    });
  }

  // Shop purchase helper functions
  public triggerNextWave() {
    if (this.isGameOver || this.enemies.waveActive) return;
    this.enemies.startWave(this.currentWaveIndex);
    this.pushUIState();
  }

  public buyWeapon(type: WeaponType) {
    if (this.isGameOver) return;
    if (this.enemies.waveActive) return; // Lock weapon purchases during active wave!

    const cost = this.player.weaponCosts[type];
    if (this.walletBanked >= cost && !this.player.unlockedWeapons[type]) {
      this.walletBanked -= cost;
      this.player.unlockedWeapons[type] = true;
      const idx = this.player.getWeaponIndex(type);
      if (idx !== -1) {
        this.player.selectWeapon(idx);
      }
      this.pushUIState();
    }
  }

  public buyUpgrade(type: UpgradeType) {
    if (this.isGameOver) return;
    if (this.enemies.waveActive) return; // Lock character upgrades during waves!

    const currentLevel = this.player.levelUpgrades[type];
    
    // Check max level limits
    let maxLevel = 10;
    if (type === UpgradeType.RELOAD_SPEED || type === UpgradeType.MOVE_SPEED) maxLevel = 5;
    if (type === UpgradeType.MAGNET_RADIUS) maxLevel = 6;
    if (type === UpgradeType.AUTO_COLLECT) maxLevel = 1;
    if (type === UpgradeType.TELEPORT) maxLevel = 1;

    if (currentLevel >= maxLevel) return;

    // Calculate dynamic cost
    let cost = 0;
    if (type === UpgradeType.DAMAGE) cost = 20 + currentLevel * 15;
    else if (type === UpgradeType.MAX_HEALTH) cost = 15 + currentLevel * 12;
    else if (type === UpgradeType.RELOAD_SPEED) cost = 25 + currentLevel * 15;
    else if (type === UpgradeType.MOVE_SPEED) cost = 15 + currentLevel * 10;
    else if (type === UpgradeType.MAGNET_RADIUS) cost = 10 + currentLevel * 8;
    else if (type === UpgradeType.AUTO_COLLECT) cost = 120;
    else if (type === UpgradeType.TELEPORT) cost = 150;

    if (this.walletBanked >= cost) {
      this.walletBanked -= cost;
      this.player.applyUpgrade(type, currentLevel + 1);
      this.pushUIState();
    }
  }

  public togglePauseButton() {
    this.isPaused = !this.isPaused;
    this.pushUIState();
  }

  // Clear environment items and rebuild for fresh game restart!
  public restartGame() {
    this.coreHealth = this.maxCoreHealth;
    this.walletCarried = 0;
    this.walletBanked = 50;
    this.currentWaveIndex = 1;
    this.waveCountTimer = 10.0;
    this.score = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.isRespawning = false;
    this.isBuildMode = false;
    this.buildTowerType = null;

    // Re-initialize players levels
    this.player.levelUpgrades = {
      [UpgradeType.DAMAGE]: 1,
      [UpgradeType.MAX_HEALTH]: 1,
      [UpgradeType.RELOAD_SPEED]: 1,
      [UpgradeType.MOVE_SPEED]: 1,
      [UpgradeType.MAGNET_RADIUS]: 1,
      [UpgradeType.AUTO_COLLECT]: 0,
      [UpgradeType.TELEPORT]: 0
    };
    this.player.maxHealth = 100;

    // Clear assets
    this.enemies.clearAll();
    this.defenses.clearAll();
    this.coins.clearAll();
    this.player.clearAll();

    this.player.respawn(Vector3.Zero());
    this.updateCoreVisualHealth();
    this.pushUIState();
  }

  public dispose() {
    window.removeEventListener('resize', this.handleResize);
    this.scene.dispose();
    this.engine.dispose();
  }
}
