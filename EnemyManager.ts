/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Scene,
  Vector3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  TransformNode,
  Nullable
} from '@babylonjs/core';

export enum EnemyType {
  BASIC = 'basic',
  FAST = 'fast',
  TANK = 'tank',
  BOSS = 'boss'
}

export class Enemy {
  public mesh: TransformNode;
  private visualMesh: Mesh;
  private healthBarBg: Mesh;
  private healthBarFill: Mesh;
  private redMat: StandardMaterial;
  private greenMat: StandardMaterial;

  public maxHealth: number;
  public health: number;
  public speed: number;
  public damage: number;
  public speedMultiplier: number = 1.0;
  
  private targetCore: boolean = true;
  private attackCooldown: number = 1000; // ms between attacks
  private lastAttackTime: number = 0;
  private dead: boolean = false;
  private aggroRadius: number = 15;
  private attackRadius: number = 1.6;

  // Boss specific properties
  private bossAbilityTimer: number = 0;
  private shieldMesh: Nullable<Mesh> = null;
  private isShieldActive: boolean = false;

  constructor(
    private scene: Scene,
    public id: string,
    public type: EnemyType,
    spawnPos: Vector3,
    levelMultiplier: number,
    isBossWave: boolean = false
  ) {
    // 1. Determine Stats depending on Type & Level Multiplier
    switch (type) {
      case EnemyType.FAST:
        this.maxHealth = Math.round(30 * levelMultiplier);
        this.speed = 5.2;
        this.damage = 8;
        this.attackRadius = 1.2;
        break;
      case EnemyType.TANK:
        this.maxHealth = Math.round(180 * levelMultiplier);
        this.speed = 1.8;
        this.damage = 30;
        this.attackRadius = 2.2;
        break;
      case EnemyType.BOSS:
        this.maxHealth = Math.round(800 * levelMultiplier);
        this.speed = 2.5;
        this.damage = 60;
        this.attackRadius = 3.5;
        this.aggroRadius = 35; // aggro easily
        break;
      case EnemyType.BASIC:
      default:
        this.maxHealth = Math.round(12 * levelMultiplier);
        this.speed = 3.0;
        this.damage = 15;
        this.attackRadius = 1.5;
        break;
    }
    this.health = this.maxHealth;

    // 2. Build low-poly stylized character mesh
    this.mesh = new TransformNode(`enemy_root_${id}`, this.scene);
    this.mesh.position.copyFrom(spawnPos);
    this.mesh.position.y = 0.5;

    // Body material depending on type
    const bodyMat = new StandardMaterial(`mat_enemy_${id}`, this.scene);
    switch (type) {
      case EnemyType.FAST:
        bodyMat.diffuseColor = new Color3(0.2, 0.9, 0.2); // Neon Green
        bodyMat.emissiveColor = new Color3(0.1, 0.4, 0.1);
        break;
      case EnemyType.TANK:
        bodyMat.diffuseColor = new Color3(0.4, 0.1, 0.5); // Industrial Purple/Steel
        bodyMat.specularColor = new Color3(0.8, 0.8, 0.8);
        break;
      case EnemyType.BOSS:
        bodyMat.diffuseColor = new Color3(0.9, 0.1, 0.1); // Crimson Blood
        bodyMat.emissiveColor = new Color3(0.3, 0.05, 0.05);
        bodyMat.specularColor = new Color3(1, 1, 1);
        break;
      case EnemyType.BASIC:
      default:
        bodyMat.diffuseColor = new Color3(1.0, 0.35, 0.1); // Rust Orange
        bodyMat.emissiveColor = new Color3(0.2, 0.05, 0);
        break;
    }

    // Main physical mesh
    if (type === EnemyType.BOSS) {
      // Massive layered spiked mesh
      this.visualMesh = MeshBuilder.CreateBox(`vis_${id}`, { width: 3.0, height: 3.0, depth: 3.0 }, this.scene);
      this.visualMesh.position.y = 1.5;

      const eye = MeshBuilder.CreateBox(`vis_eye_${id}`, { width: 2.2, height: 0.4, depth: 0.4 }, this.scene);
      eye.position.y = 2.4;
      eye.position.z = 1.4;
      const eyeMat = new StandardMaterial('boss_eye', this.scene);
      eyeMat.emissiveColor = new Color3(1, 1, 0); // sinister yellow glowing visor band
      eye.material = eyeMat;
      eye.parent = this.mesh;
    } else if (type === EnemyType.TANK) {
      this.visualMesh = MeshBuilder.CreateBox(`vis_${id}`, { width: 1.5, height: 1.8, depth: 1.5 }, this.scene);
      this.visualMesh.position.y = 0.9;
    } else if (type === EnemyType.FAST) {
      // Low-poly gem shape (low-segments sphere) for swift runners
      this.visualMesh = MeshBuilder.CreateSphere(`vis_${id}`, { segments: 3, diameter: 0.95 }, this.scene);
      this.visualMesh.position.y = 0.45;
    } else {
      this.visualMesh = MeshBuilder.CreateCylinder(`vis_${id}`, { diameterTop: 0.6, diameterBottom: 1.0, height: 1.4 }, this.scene);
      this.visualMesh.position.y = 0.7;
    }
    
    this.visualMesh.material = bodyMat;
    this.visualMesh.parent = this.mesh;

    // Create tactical sonar wireframe mesh that renders on top of everything (holographic look through walls)
    const sonarMesh = this.visualMesh.clone(`sonar_${id}`);
    sonarMesh.parent = this.mesh;
    sonarMesh.scaling.scaleInPlace(1.04); // subtle offset to wrap nicely
    sonarMesh.renderingGroupId = 1; // renders in secondary layer above standard geometry
    
    const sonarMat = new StandardMaterial(`sonar_mat_${id}`, this.scene);
    sonarMat.diffuseColor = Color3.Black();
    sonarMat.emissiveColor = bodyMat.diffuseColor; // match threat theme
    sonarMat.wireframe = true;
    sonarMat.disableDepthWrite = true;
    sonarMesh.material = sonarMat;

    // 3. Setup Billboarding Health Bar plane directly overhead the mesh
    const barHeight = type === EnemyType.BOSS ? 4.0 : (type === EnemyType.TANK ? 2.5 : 2.0);
    const barWidth = type === EnemyType.BOSS ? 3.0 : 1.4;

    this.redMat = new StandardMaterial('hb_red', this.scene);
    this.redMat.emissiveColor = new Color3(0.6, 0.1, 0.1);
    this.redMat.diffuseColor = Color3.Black();

    this.greenMat = new StandardMaterial('hb_green', this.scene);
    this.greenMat.emissiveColor = new Color3(0.1, 0.8, 0.1);
    this.greenMat.diffuseColor = Color3.Black();

    // Health bar container node
    const hbContainer = new TransformNode(`hb_cont_${id}`, this.scene);
    hbContainer.position.y = barHeight;
    hbContainer.parent = this.mesh;
    hbContainer.billboardMode = Mesh.BILLBOARDMODE_ALL;

    this.healthBarBg = MeshBuilder.CreatePlane(`hb_bg_${id}`, { width: barWidth, height: 0.15 }, this.scene);
    this.healthBarBg.material = this.redMat;
    this.healthBarBg.parent = hbContainer;
    this.healthBarBg.isVisible = false; // Hide background red bar initially to prevent any red bleed!

    this.healthBarFill = MeshBuilder.CreatePlane(`hb_fill_${id}`, { width: barWidth, height: 0.15 }, this.scene);
    this.healthBarFill.material = this.greenMat;
    this.healthBarFill.position.z = -0.01; // slightly in-front to prevent visual fighting
    this.healthBarFill.parent = hbContainer;

    // Set initial position and scale (absolutely centered and full, zero red bleed)
    this.healthBarFill.scaling.x = 1.0;
    this.healthBarFill.position.x = 0.0;

    // Setup initial BOSS Shield Mesh
    if (this.type === EnemyType.BOSS) {
      this.shieldMesh = MeshBuilder.CreateSphere(`shield_${id}`, { diameter: 5.5 }, this.scene);
      const shieldMat = new StandardMaterial('sh_mat', this.scene);
      shieldMat.diffuseColor = new Color3(0, 0.5, 1);
      shieldMat.emissiveColor = new Color3(0, 0.2, 0.5);
      shieldMat.alpha = 0.35;
      this.shieldMesh.material = shieldMat;
      this.shieldMesh.parent = this.mesh;
      this.shieldMesh.position.y = 1.5;
      this.isShieldActive = true;
    }
  }

  public getCenterPosition(): Vector3 {
    // Return approximate center/chest height coordinates for targeting
    const center = this.mesh.position.clone();
    center.y += this.type === EnemyType.BOSS ? 1.5 : 0.8;
    return center;
  }

  public takeDamage(dmg: number) {
    if (this.dead) return;

    // Check boss energy shield block mechanic
    if (this.type === EnemyType.BOSS && this.isShieldActive) {
      // Explode the hit - block damage entirely but damage energy shield status
      // We can absorb 4 bullet hits or tick shield off
      this.isShieldActive = false;
      if (this.shieldMesh) {
        // disappear shield visually as a custom mechanic indicating vulnerable states!
        this.shieldMesh.setEnabled(false);
      }
      return; 
    }

    this.health = Math.max(0, this.health - dmg);
    this.healthBarBg.isVisible = true; // Show health bar background once hit

    // Update Health Bar Width and shift position so it contracts to the left
    const ratio = this.health / this.maxHealth;
    this.healthBarFill.scaling.x = ratio;
    const barWidth = this.type === EnemyType.BOSS ? 3.0 : 1.4;
    this.healthBarFill.position.x = (ratio - 1.0) * (barWidth / 2);

    if (this.health <= 0) {
      this.die();
    }
  }

  public isDead(): boolean {
    return this.dead;
  }

  private die() {
    this.dead = true;
    // Visually crumble or immediately remove
    this.mesh.dispose();
  }

  public update(
    deltaTime: number,
    playerPosition: Vector3,
    corePosition: Vector3,
    onDamagePlayer: (amount: number) => void,
    onDamageCore: (amount: number) => void
  ) {
    if (this.dead) return;

    const myPos = this.mesh.position;
    const distToPlayer = Vector3.Distance(myPos, playerPosition);
    const distToCore = Vector3.Distance(myPos, corePosition);

    let currentTarget: Vector3;
    let targetType: 'player' | 'core';

    // 1. Target Decision (Aggro range prioritizes player over core)
    let shouldTargetPlayer = distToPlayer <= this.aggroRadius && playerPosition.y < 5;

    // BUT if player is on the tower, and the mob is on the ground touching or near the platform, focus core instead!
    const isTouchingPlatform = Math.abs(myPos.x) >= 4.05 || Math.abs(myPos.z) >= 4.05;
    if (shouldTargetPlayer && playerPosition.y >= 2.5 && isTouchingPlatform) {
      shouldTargetPlayer = false; // block player override, focus core base!
    }

    if (shouldTargetPlayer) {
      currentTarget = playerPosition;
      targetType = 'player';
      this.targetCore = false;
    } else {
      currentTarget = corePosition;
      targetType = 'core';
      this.targetCore = true;
    }

    // 2. Navigation Movement towards Target
    const dir = currentTarget.subtract(myPos);
    dir.y = 0; // lock to horizontal plane
    const targetDist = dir.length();
    dir.normalize();

    // Rotate visual character towards movement direction
    if (dir.length() > 0.01) {
      const targetAngle = Math.atan2(dir.x, dir.z);
      this.mesh.rotation.y = targetAngle;
    }

    // Determine how close is too close (effective attack radius)
    let effectiveAttackRadius = this.attackRadius;
    if (targetType === 'core') {
      // Since platform boundary is at |X|=4.1 or |Z|=4.1, they can attack if they are within 0.85 units of the platform
      const isNearPlatformX = Math.abs(myPos.x) <= 4.65 && Math.abs(myPos.z) <= 4.15;
      const isNearPlatformZ = Math.abs(myPos.z) <= 4.65 && Math.abs(myPos.x) <= 4.15;
      if (isNearPlatformX || isNearPlatformZ || targetDist <= 4.8) {
        effectiveAttackRadius = 999999; // force attack trigger!
      } else {
        effectiveAttackRadius = 4.1 + this.attackRadius * 0.5;
      }
    } else {
      effectiveAttackRadius = this.attackRadius;
    }

    if (targetDist > effectiveAttackRadius) {
      // Wave motion wobbling animation (slight floating or shuffling)
      const shuffleY = Math.sin(Date.now() * 0.01) * 0.08;
      this.visualMesh.position.y = (this.type === EnemyType.BOSS ? 1.5 : (this.type === EnemyType.TANK ? 0.9 : (this.type === EnemyType.FAST ? 0.45 : 0.7))) + shuffleY;

      // Apply movement
      const moveAmount = dir.scale(this.speed * this.speedMultiplier * deltaTime);
      myPos.addInPlace(moveAmount);

      // Keep enemy in bounds (clamped to map width)
      const enemyMapLimit = 73;
      if (myPos.x < -enemyMapLimit) myPos.x = -enemyMapLimit;
      if (myPos.x > enemyMapLimit) myPos.x = enemyMapLimit;
      if (myPos.z < -enemyMapLimit) myPos.z = -enemyMapLimit;
      if (myPos.z > enemyMapLimit) myPos.z = enemyMapLimit;
    } else {
      // Attack Loop
      const now = Date.now();
      if (now - this.lastAttackTime >= this.attackCooldown) {
        this.lastAttackTime = now;
        
        // Attack visual lunge
        this.visualMesh.position.z += 0.45;
        setTimeout(() => { if (!this.dead) this.visualMesh.position.z = 0; }, 150);

        if (targetType === 'player') {
          onDamagePlayer(this.damage);
        } else {
          onDamageCore(this.damage);
        }
      }
    }

    // 3. Collision Constraint (Strict Clamping to keep mobs outside 8.12x8.12 main tower footprint)
    const minPadding = -4.12;
    const maxPadding = 4.12;
    if (myPos.x > minPadding && myPos.x < maxPadding && myPos.z > minPadding && myPos.z < maxPadding) {
      // It's inside the platform. Push it to the closest outer edge!
      const distToMinX = Math.abs(myPos.x - minPadding);
      const distToMaxX = Math.abs(maxPadding - myPos.x);
      const distToMinZ = Math.abs(myPos.z - minPadding);
      const distToMaxZ = Math.abs(maxPadding - myPos.z);
      
      const minDist = Math.min(distToMinX, distToMaxX, distToMinZ, distToMaxZ);
      if (minDist === distToMinX) {
        myPos.x = minPadding;
      } else if (minDist === distToMaxX) {
        myPos.x = maxPadding;
      } else if (minDist === distToMinZ) {
        myPos.z = minPadding;
      } else {
        myPos.z = maxPadding;
      }
    }

    // 4. Special Boss Shield Regeneration Mechanic
    if (this.type === EnemyType.BOSS) {
      this.bossAbilityTimer += deltaTime;
      if (this.bossAbilityTimer >= 7.0) { // Every 7 seconds regeneration of shield barrier occurs!
        this.bossAbilityTimer = 0;
        if (!this.isShieldActive) {
          this.isShieldActive = true;
          if (this.shieldMesh) {
            this.shieldMesh.setEnabled(true);
          }
        }
      }
    }
  }

  // Release assets
  public dispose() {
    this.mesh.dispose();
  }
}

export class EnemyManager {
  private activeEnemies: Enemy[] = [];
  private currentWaveNum: number = 0;
  private spawnQueue: EnemyType[] = [];
  public waveActive: boolean = false;
  private spawnInterval: number = 1000; // time in ms
  private lastSpawnTime: number = 0;
  private coreSpawnLocation: Vector3 = Vector3.Zero();
  
  // Total stats
  public enemiesKilled: number = 0;
  public totalWaveCountEnemies: number = 0;

  constructor(private scene: Scene) {}

  public getEnemies() {
    return this.activeEnemies;
  }

  public getActiveCount(): number {
    return this.activeEnemies.length;
  }

  public getTotalWaveEnemies(): number {
    return this.totalWaveCountEnemies;
  }

  // Wave initialization and scaling algorithms
  public startWave(waveIndex: number) {
    this.currentWaveNum = waveIndex;
    this.waveActive = true;
    this.spawnQueue = [];
    
    // Scale quantity linearly (Start game easier: fewer initial crawlers)
    let enemyCount = 4 + waveIndex * 3;
    const isBossWave = waveIndex % 5 === 0;

    if (isBossWave) {
      // Boss wave: includes Boss + supporting waves
      this.spawnQueue.push(EnemyType.BOSS);
      enemyCount = Math.round(enemyCount * 0.7); // slightly fewer normal minions with the big boss
    }

    // Mix up normal units
    for (let i = 0; i < enemyCount; i++) {
      const roll = Math.random();
      if (waveIndex < 2) {
        this.spawnQueue.push(EnemyType.BASIC);
      } else if (waveIndex < 4) {
        if (roll < 0.75) this.spawnQueue.push(EnemyType.BASIC);
        else this.spawnQueue.push(EnemyType.FAST);
      } else {
        // All enemy types mixed randomly
        if (roll < 0.5) this.spawnQueue.push(EnemyType.BASIC);
        else if (roll < 0.8) this.spawnQueue.push(EnemyType.FAST);
        else this.spawnQueue.push(EnemyType.TANK);
      }
    }

    // Shuffle spawning queue
    this.spawnQueue.sort(() => Math.random() - 0.5);

    this.totalWaveCountEnemies = this.spawnQueue.length;
    this.lastSpawnTime = Date.now();
    this.spawnInterval = Math.max(700, 2000 - waveIndex * 150); // spawn slightly slower for ease
  }

  // Handle ticking spawn queue & updating status
  public update(
    deltaTime: number,
    playerPosition: Vector3,
    corePosition: Vector3,
    onDamagePlayer: (amount: number) => void,
    onDamageCore: (amount: number) => void,
    onEnemySpawn: (pos: Vector3) => void,
    onEnemyKilled: (enemy: Enemy) => void
  ) {
    // 1. Spawning Tick
    if (this.waveActive && this.spawnQueue.length > 0) {
      const now = Date.now();
      if (now - this.lastSpawnTime >= this.spawnInterval) {
        this.lastSpawnTime = now;
        
        const nextType = this.spawnQueue.shift();
        if (nextType) {
          const spawnPos = this.getRandomSpawnPosition(corePosition);
          // Scale HP slightly per level (Start game easier: lower health/damage scaling)
          const levelMultiplier = 1.0 + (this.currentWaveNum - 1) * 0.10;
          
          const uniqueId = `${Date.now()}_${Math.random()}`;
          const enemy = new Enemy(this.scene, uniqueId, nextType, spawnPos, levelMultiplier);
          this.activeEnemies.push(enemy);

          onEnemySpawn(spawnPos);
        }
      }
    }

    // 2. Active enemies AI loop update
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      if (enemy.isDead()) {
        onEnemyKilled(enemy);
        this.enemiesKilled++;
        this.activeEnemies.splice(i, 1);
        continue;
      }

      enemy.update(deltaTime, playerPosition, corePosition, onDamagePlayer, onDamageCore);
    }

    // 3. Verify wave over
    if (this.waveActive && this.spawnQueue.length === 0 && this.activeEnemies.length === 0) {
      this.waveActive = false;
    }
  }

  // Fetch spawning ring coordinates around map boundaries
  private getRandomSpawnPosition(center: Vector3): Vector3 {
    const minRadius = 55;
    const maxRadius = 65;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * (maxRadius - minRadius) + minRadius;

    return new Vector3(
      center.x + Math.cos(angle) * radius,
      0,
      center.z + Math.sin(angle) * radius
    );
  }

  public clearAll() {
    this.activeEnemies.forEach(e => e.dispose());
    this.activeEnemies = [];
    this.spawnQueue = [];
    this.waveActive = false;
  }
}
