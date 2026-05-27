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
  ArcRotateCamera,
  Nullable
} from '@babylonjs/core';
import { Weapon, WeaponType, UpgradeType, Upgrade } from '../types';
import { Enemy } from './EnemyManager';

export interface PlayerBullet {
  mesh: Mesh;
  velocity: Vector3;
  damage: number;
  rangeRemaining: number;
  type: WeaponType;
}

export class PlayerManager {
  public mesh!: Mesh;
  private gunMesh!: Mesh;
  private gunGlowMaterial!: StandardMaterial;
  private material!: StandardMaterial;
  private isDead: boolean = false;
  private shieldBubbleMesh: Nullable<Mesh> = null;
  public spawnShieldTimeRemaining: number = 5.0; // 5 seconds initial protection on first spawn!

  // Camera link
  private camera!: ArcRotateCamera;
  
  // Bullets list
  private activeBullets: PlayerBullet[] = [];
  private bulletMaterial!: StandardMaterial;

  // Keyboard controls
  private keys: Record<string, boolean> = {};
  
  // Game variables
  public health: number = 100;
  public maxHealth: number = 100;
  public levelUpgrades = {
    [UpgradeType.DAMAGE]: 1,
    [UpgradeType.MAX_HEALTH]: 1,
    [UpgradeType.RELOAD_SPEED]: 1,
    [UpgradeType.MOVE_SPEED]: 1,
    [UpgradeType.MAGNET_RADIUS]: 1,
    [UpgradeType.AUTO_COLLECT]: 0,
    [UpgradeType.TELEPORT]: 0
  } as Record<UpgradeType, number>;

  // Combat Stats
  public currentWeaponIndex: number = 0;
  private weaponsList: Weapon[] = [];
  public currentWeaponAmmo = {
    [WeaponType.PISTOL]: 12,
    [WeaponType.RIFLE]: 30,
    [WeaponType.SHOTGUN]: 6
  } as Record<WeaponType, number>;
  public reloadingStatus = {
    [WeaponType.PISTOL]: false,
    [WeaponType.RIFLE]: false,
    [WeaponType.SHOTGUN]: false
  } as Record<WeaponType, boolean>;
  private lastFiredTimes = {
    [WeaponType.PISTOL]: 0,
    [WeaponType.RIFLE]: 0,
    [WeaponType.SHOTGUN]: 0
  } as Record<WeaponType, number>;

  public unlockedWeapons = {
    [WeaponType.PISTOL]: true,
    [WeaponType.RIFLE]: false,
    [WeaponType.SHOTGUN]: false
  } as Record<WeaponType, boolean>;

  public weaponCosts = {
    [WeaponType.PISTOL]: 0,
    [WeaponType.RIFLE]: 100,
    [WeaponType.SHOTGUN]: 140
  } as Record<WeaponType, number>;

  // Jump physics
  private verticalVelocity: number = 0;
  private isGrounded: boolean = true;
  private gravity: number = -18.0;
  private jumpForce: number = 7.5;

  constructor(private scene: Scene) {
    this.initWeapons();
    this.setupCamera();
    this.createPlayerAvatar();
    this.setupListeners();
  }

  private initWeapons() {
    this.weaponsList = [
      {
        id: WeaponType.PISTOL,
        name: 'Quantum Sidearm (Pistol)',
        damage: 24,
        fireRate: 250, // fires every 0.25s
        clipSize: 12,
        reloadTime: 1200, // 1.2s
        spread: 0.02,
        range: 40,
        projectiles: 1,
        color: '#3498db'
      },
      {
        id: WeaponType.RIFLE,
        name: 'Auto Pulsar (Rifle)',
        damage: 16,
        fireRate: 90, // fully automatic: feels rapid!
        clipSize: 30,
        reloadTime: 1800, // 1.8s
        spread: 0.06,
        range: 55,
        projectiles: 1,
        color: '#2ecc71'
      },
      {
        id: WeaponType.SHOTGUN,
        name: 'Core Breaker (Shotgun)',
        damage: 18, // 5 shells x 18 = 90 max dmg up close
        fireRate: 850, // 0.85s delay
        clipSize: 6,
        reloadTime: 2400, // 2.4s
        spread: 0.18,
        range: 16,
        projectiles: 5,
        color: '#e67e22'
      }
    ];

    // Build bullet visual material
    this.bulletMaterial = new StandardMaterial('bullet_mat', this.scene);
    this.bulletMaterial.emissiveColor = new Color3(1.0, 0.9, 0.2); // Golden energy bullets
    this.bulletMaterial.diffuseColor = Color3.Yellow();
  }

  private createPlayerAvatar() {
    this.material = new StandardMaterial('player_mat', this.scene);
    this.material.diffuseColor = new Color3(0.1, 0.6, 0.9); // Energetic blue suit
    this.material.specularColor = new Color3(1, 1, 1);
    this.material.emissiveColor = new Color3(0.05, 0.15, 0.3);

    // Compound character node
    this.mesh = MeshBuilder.CreateBox('player_core', { width: 0.8, height: 1.8, depth: 0.8 }, this.scene);
    this.mesh.position.set(0, 3.9, 3.2); // Start on top of the elevated Grey Brick Castle platform (3m top + 0.9m height)
    this.mesh.material = this.material;
    this.mesh.isVisible = false; // Hide body in first person view

    // Glowing helmet visor strip (gives futuristic feeling)
    const visor = MeshBuilder.CreateBox('helmet_visor', { width: 0.9, height: 0.25, depth: 0.3 }, this.scene);
    visor.position.y = 0.65;
    visor.position.z = 0.35;
    const visorMat = new StandardMaterial('visor_mat', this.scene);
    visorMat.emissiveColor = new Color3(0, 1.0, 1.0); // glowing neon cyan visor
    visor.material = visorMat;
    visor.parent = this.mesh;
    visor.isVisible = false; // Hide visor in first person view

    // Mounted Laser Gun - parented to camera so it aims where you point
    this.gunMesh = MeshBuilder.CreateCylinder('player_laser_gun', { diameterBottom: 0.14, diameterTop: 0.1, height: 1.1 }, this.scene);
    this.gunMesh.parent = this.camera;
    this.gunMesh.position.set(0.32, -0.26, 1.05);
    this.gunMesh.rotation.set(Math.PI / 2, -0.06, 0.05); // pointing forward, slightly inwards

    const gunMat = new StandardMaterial('gun_mat', this.scene);
    gunMat.diffuseColor = new Color3(0.12, 0.14, 0.18); // Sleek dark metallic color
    gunMat.specularColor = new Color3(0.7, 0.7, 0.7);
    this.gunMesh.material = gunMat;

    // Beautiful circular glowing energy collar wrapping the barrel (replaces bulky box coordinates)
    const gunPowerStrip = MeshBuilder.CreateCylinder('gun_power_strip', { diameter: 0.144, height: 0.15 }, this.scene);
    gunPowerStrip.parent = this.gunMesh;
    gunPowerStrip.position.set(0, -0.15, 0); // positioned as a sleek status reactor band
    
    this.gunGlowMaterial = new StandardMaterial('gun_glow_mat', this.scene);
    this.gunGlowMaterial.emissiveColor = new Color3(0.0, 0.85, 1.0); // Neon cyan by default
    this.gunGlowMaterial.diffuseColor = new Color3(0.0, 0.4, 0.5);
    gunPowerStrip.material = this.gunGlowMaterial;

    // Create a beautiful, semi-transparent neon blue shield bubble around the player mesh
    this.shieldBubbleMesh = MeshBuilder.CreateSphere('player_shield_bubble', { diameter: 2.2 }, this.scene);
    this.shieldBubbleMesh.parent = this.mesh;
    this.shieldBubbleMesh.position.set(0, 0, 0);
    const shieldMat = new StandardMaterial('player_shield_mat', this.scene);
    shieldMat.diffuseColor = new Color3(0.0, 0.5, 1.0);
    shieldMat.emissiveColor = new Color3(0.0, 0.3, 0.8);
    shieldMat.alpha = 0.35;
    shieldMat.disableDepthWrite = true;
    this.shieldBubbleMesh.material = shieldMat;
    // Enabled by default since first spawn has a 5-second shield protection
    this.shieldBubbleMesh.setEnabled(true);
  }

  private setupCamera() {
    // First-person camera centered inside the player
    this.camera = new ArcRotateCamera(
      'fp_camera',
      -Math.PI / 2, // alpha heading facing forward (positive Z)
      Math.PI / 2, // beta angle looking horizontally ahead
      0.01, // extremely small radius for first-person perspective
      new Vector3(0, 1.6, 8),
      this.scene
    );
    
    // Set tight limits for first-person locking
    this.camera.lowerRadiusLimit = 0.01;
    this.camera.upperRadiusLimit = 0.01;
    this.camera.lowerBetaLimit = 0.2; // limit looking straight down
    this.camera.upperBetaLimit = Math.PI - 0.2; // limit looking straight up
    
    // Crucial: Set near clipping plane very close so the weapon doesn't clip
    this.camera.minZ = 0.05;
    
    this.scene.activeCamera = this.camera;
  }

  private setupListeners() {
    // WASD controller keys mapping
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;

      // Handle Weapon hotkeys 1, 2, 3
      if (k === '1') this.selectWeapon(0);
      else if (k === '2') this.selectWeapon(1);
      else if (k === '3') this.selectWeapon(2);
      
      // Manual Reload Key (R)
      if (k === 'r') this.reloadActiveWeapon();

      // Teleport to Base Key (T)
      if (k === 't') {
        if (this.levelUpgrades[UpgradeType.TELEPORT] > 0) {
          const playerPos = this.mesh.position;
          const onTowerPlatform = Math.abs(playerPos.x) <= 4.2 && Math.abs(playerPos.z) <= 4.2 && playerPos.y >= 2.5;
          if (!onTowerPlatform && !this.isDead) {
            this.mesh.position.set(0, 3.9, 3.2);
            this.verticalVelocity = 0;
            this.isGrounded = true;
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    const canvas = this.scene.getEngine().getRenderingCanvas();

    // Pointer lock mouse click binding
    this.scene.onPointerDown = (evt) => {
      // Allow mouse lock if gameplay active
      if (this.isDead) return;
      if (canvas && document.pointerLockElement !== canvas) {
        try {
          const promise = canvas.requestPointerLock() as any;
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {});
          }
        } catch (e) {}
      }
    };

    // First person mouse look listener
    window.addEventListener('mousemove', (e) => {
      if (this.isDead || this.scene.isDisposed) return;
      if (canvas && document.pointerLockElement === canvas) {
        const sensitivity = 0.0022; // smooth FPS style sensitivity
        this.camera.alpha -= e.movementX * sensitivity;
        this.camera.beta = Math.max(
          this.camera.lowerBetaLimit || 0.2,
          Math.min(this.camera.upperBetaLimit || Math.PI - 0.2, this.camera.beta - e.movementY * sensitivity)
        );
      }
    });
  }

  public getActiveWeapon(): Weapon {
    return this.weaponsList[this.currentWeaponIndex];
  }

  public getActiveWeaponAmmo() {
    return this.currentWeaponAmmo[this.getActiveWeapon().id];
  }

  public getWeaponIndex(type: WeaponType): number {
    return this.weaponsList.findIndex(w => w.id === type);
  }

  public selectWeapon(index: number) {
    if (this.isDead || index < 0 || index >= this.weaponsList.length) return;
    const wp = this.weaponsList[index];
    if (!this.unlockedWeapons[wp.id]) return; // No-op if locked!
    this.currentWeaponIndex = index;

    // Update gun holographic glow strip color dynamically matching the weapon theme
    if (this.gunGlowMaterial) {
      if (index === 0) {
        this.gunGlowMaterial.emissiveColor = new Color3(0.0, 0.85, 1.0); // Pistol: bright cyan glow
      } else if (index === 1) {
        this.gunGlowMaterial.emissiveColor = new Color3(0.1, 1.0, 0.25); // Rifle: neon radioactive green glow
      } else if (index === 2) {
        this.gunGlowMaterial.emissiveColor = new Color3(1.0, 0.45, 0.0); // Shotgun: hot orange combustion glow
      }
    }
  }

  public reloadActiveWeapon() {
    if (this.isDead) return;
    const wp = this.getActiveWeapon();
    if (this.reloadingStatus[wp.id] || this.currentWeaponAmmo[wp.id] === wp.clipSize) return;

    this.reloadingStatus[wp.id] = true;

    // Apply upgrade factor to reload speed level
    // multiplier = e.g., 1 / (1 + reloadLv * 0.15)
    const reloadLevel = this.levelUpgrades[UpgradeType.RELOAD_SPEED];
    const reloadRateFactor = 1.0 + (reloadLevel - 1) * 0.20; // 20% faster reloading per level
    const adjustedReloadMs = wp.reloadTime / reloadRateFactor;

    setTimeout(() => {
      if (!this.isDead) { // prevent glitch reloading if player died during wait
        this.currentWeaponAmmo[wp.id] = wp.clipSize;
      }
      this.reloadingStatus[wp.id] = false;
    }, adjustedReloadMs);
  }

  // Combat upgrade modifier accessors
  public applyUpgrade(type: UpgradeType, currentLevel: number) {
    this.levelUpgrades[type] = currentLevel;
    if (type === UpgradeType.MAX_HEALTH) {
      // Re-trigger player core health scaling
      const baseHP = 100;
      const additional = (currentLevel - 1) * 25;
      const prevMax = this.maxHealth;
      this.maxHealth = baseHP + additional;
      this.health += (this.maxHealth - prevMax); // heal by delta
    }
  }

  public takeDamage(amount: number) {
    if (this.isDead) return;
    if (this.spawnShieldTimeRemaining > 0) return; // Immune to all damage while shield is active!
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.die();
    }
  }

  public isPlayerDead(): boolean {
    return this.isDead;
  }

  private die() {
    this.isDead = true;
    this.mesh.setEnabled(false); // hide character visual layers
    this.gunMesh.setEnabled(false); // hide first person gun mesh
    if (this.shieldBubbleMesh) {
      this.shieldBubbleMesh.setEnabled(false);
    }
  }

  public respawn(corePos: Vector3) {
    this.isDead = false;
    this.health = this.maxHealth;
    
    // Give 5 seconds of total shield protection on respawn!
    this.spawnShieldTimeRemaining = 5.0;
    if (this.shieldBubbleMesh) {
      this.shieldBubbleMesh.setEnabled(true);
      this.shieldBubbleMesh.scaling.set(1, 1, 1);
    }
    
    // Clear and reset ammunition stores
    this.currentWeaponAmmo[WeaponType.PISTOL] = this.weaponsList[0].clipSize;
    this.currentWeaponAmmo[WeaponType.RIFLE] = this.weaponsList[1].clipSize;
    this.currentWeaponAmmo[WeaponType.SHOTGUN] = this.weaponsList[2].clipSize;
    this.reloadingStatus[WeaponType.PISTOL] = false;
    this.reloadingStatus[WeaponType.RIFLE] = false;
    this.reloadingStatus[WeaponType.SHOTGUN] = false;

    // Teleport close to center base tower safely (start on top of the elevated grey brick castle platform)
    this.mesh.position.copyFrom(corePos);
    this.mesh.position.y = 3.9;
    this.mesh.position.z += 3.2;
    this.mesh.setEnabled(true);
    this.gunMesh.setEnabled(true); // make sure gun mesh is visible on respawn

    // Reset camera look direction to straight forward
    this.camera.alpha = -Math.PI / 2;
    this.camera.beta = Math.PI / 2;

    this.verticalVelocity = 0;
    this.isGrounded = true;
  }

  // Triggers bullet shooting
  public shoot() {
    if (this.isDead) return;
    if (this.keys['shift']) return; // Cannot shoot while sprinting (Shift key is pressed)
    const wp = this.getActiveWeapon();

    // Check reloading or empty ammo
    if (this.reloadingStatus[wp.id]) return;
    if (this.currentWeaponAmmo[wp.id] <= 0) {
      this.reloadActiveWeapon();
      return;
    }

    const now = Date.now();
    if (now - this.lastFiredTimes[wp.id] < wp.fireRate) return;
    this.lastFiredTimes[wp.id] = now;

    this.currentWeaponAmmo[wp.id]--;

    // Spawns corresponding projectile meshes (cyan or orange spheres)
    const baseDamage = wp.damage;
    const damageLevel = this.levelUpgrades[UpgradeType.DAMAGE];
    const damageMultiplier = 1.0 + (damageLevel - 1) * 0.25; // +25% player dmg per level
    const finalDamage = Math.round(baseDamage * damageMultiplier);

    // Compute central direction of camera horizontally/vertically using forward ray (allows pointing gun in exact camera look dir)
    const targetDir = this.camera.getForwardRay().direction.clone();
    targetDir.normalize();

    // Create muzzle position of the bullet at player gun
    const gunMuzzlePos = this.gunMesh.absolutePosition.clone();

    // Spawn projectiles quantity based on weapon type (Pistol/Rifle=1, Shotgun=5)
    for (let i = 0; i < wp.projectiles; i++) {
       const spreadDir = targetDir.clone();

      // Implement weapon spread accuracy offsets
      if (wp.spread > 0) {
        spreadDir.x += (Math.random() - 0.5) * wp.spread;
        spreadDir.y += (Math.random() - 0.5) * wp.spread;
        spreadDir.z += (Math.random() - 0.5) * wp.spread;
        spreadDir.normalize();
      }

      const bulletMesh = MeshBuilder.CreateSphere(`bullet_${Date.now()}_${Math.random()}`, {
        diameter: 0.22,
      }, this.scene);

      bulletMesh.material = this.bulletMaterial;
      bulletMesh.position.copyFrom(gunMuzzlePos);

      // Bullet speed: fast visual representation
      const bulletVelocity = spreadDir.scale(35.0); // 35 m/s velocity

      this.activeBullets.push({
        mesh: bulletMesh,
        velocity: bulletVelocity,
        damage: finalDamage,
        rangeRemaining: wp.range,
        type: wp.id,
      });
    }

    // Gun visual shell ejection recoil wobble (recovered smoothly in update loop)
    this.gunMesh.position.z -= 0.22;
  }

  // Physics, movement, and collision ticks
  public update(deltaTime: number, enemies: Enemy[]) {
    if (this.isDead) return;

    // Move gun out of view when sprinting, or let it lerp back from recoil
    const isSprinting = this.keys['shift'];
    const targetGunY = isSprinting ? -1.2 : -0.26;
    const targetGunZ = isSprinting ? 0.35 : 1.05;
    
    const lerpRate = Math.min(1.0, 12.0 * deltaTime);
    this.gunMesh.position.y += (targetGunY - this.gunMesh.position.y) * lerpRate;
    this.gunMesh.position.z += (targetGunZ - this.gunMesh.position.z) * lerpRate;

    // Tick spawn shield timer
    if (this.spawnShieldTimeRemaining > 0) {
      this.spawnShieldTimeRemaining = Math.max(0, this.spawnShieldTimeRemaining - deltaTime);
      if (this.spawnShieldTimeRemaining <= 0) {
        if (this.shieldBubbleMesh) {
          this.shieldBubbleMesh.setEnabled(false);
        }
      } else {
        if (this.shieldBubbleMesh) {
          // Subtle pulsation animation so the shield looks active and alive
          const pulse = 1.0 + Math.sin(Date.now() / 150) * 0.05;
          this.shieldBubbleMesh.scaling.set(pulse, pulse, pulse);
        }
      }
    }

    // Core movement calculation parameters
    const mvLevel = this.levelUpgrades[UpgradeType.MOVE_SPEED];
    const movementSpeedMult = 1.0 + (mvLevel - 1) * 0.16; // +16% runspeed per level
    
    // Sprint multipliers
    const baseSpeed = 5.6;
    const currentSpeed = (isSprinting ? baseSpeed * 1.5 : baseSpeed) * movementSpeedMult;

    // Movement Vectors based on horizontal Camera facing directions using forward ray
    const forwardVec = this.camera.getForwardRay().direction.clone();
    forwardVec.y = 0; // lock to ground plane horizontal movement
    forwardVec.normalize();

    const rightVec = Vector3.Cross(Vector3.Up(), forwardVec);
    rightVec.normalize();

    const moveDirection = Vector3.Zero();

    if (this.keys['w'] || this.keys['arrowup']) {
      moveDirection.addInPlace(forwardVec);
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      moveDirection.addInPlace(forwardVec.scale(-1));
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      moveDirection.addInPlace(rightVec.scale(-1)); // Corrected: A moves Left
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      moveDirection.addInPlace(rightVec); // Corrected: D moves Right
    }

    moveDirection.normalize();

    // Check jumping controls
    if (this.keys[' '] && this.isGrounded) {
      this.verticalVelocity = this.jumpForce;
      this.isGrounded = false;
    }

    // 1. Ladder climbing mechanics
    // Ladder is situated on the back/North face of the castle at Z = 4.0, X = 0.0 (extending from Y = 0 to 3.0)
    const isNearLadderX = this.mesh.position.x >= -0.85 && this.mesh.position.x <= 0.85;
    const isNearLadderZ = this.mesh.position.z >= 3.65 && this.mesh.position.z <= 4.65;
    const isNearLadder = isNearLadderX && isNearLadderZ && this.mesh.position.y <= 4.2;

    let onLadderClimbing = false;

    if (isNearLadder) {
      if (this.keys['w'] || this.keys['arrowup']) {
        onLadderClimbing = true;
        this.mesh.position.y += 4.5 * deltaTime;
        this.verticalVelocity = 0;
        this.isGrounded = true;
        // Step forward onto platform surface when reaching near the top ledge
        if (this.mesh.position.y >= 3.8) {
          this.mesh.position.z -= 0.85; // move forward onto the shelf
          this.mesh.position.y = 3.9;
        }
      } else if (this.keys['s'] || this.keys['arrowdown']) {
        onLadderClimbing = true;
        this.mesh.position.y -= 4.5 * deltaTime;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    }

    // 2. Apply GRAVITY vertical simulation (only if not actively climbing ladder)
    if (!onLadderClimbing) {
      this.verticalVelocity += this.gravity * deltaTime;
      this.mesh.position.y += this.verticalVelocity * deltaTime;
    }

    // 3. Dynamic surface contact floor check
    // The grey brick castle platform is centered at Z=[-4, 4], X=[-4, 4] with top surface height = 3.0
    const isInsideCastleX = this.mesh.position.x >= -4.0 && this.mesh.position.x <= 4.0;
    const isInsideCastleZ = this.mesh.position.z >= -4.0 && this.mesh.position.z <= 4.0;
    const standingOnCastle = isInsideCastleX && isInsideCastleZ;

    // Y eye height offset is 0.9. If they represent inside castle, Y limit is 3.9; otherwise 0.9 on the floor
    const currentPlatformHeight = standingOnCastle ? 3.0 : 0.0;
    const terrainGroundLimit = currentPlatformHeight + 0.9;

    if (this.mesh.position.y <= terrainGroundLimit) {
      this.mesh.position.y = terrainGroundLimit;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }

    // Apply WASD horizontal translation
    if (moveDirection.length() > 0.01) {
      // Calculate resulting coordinates
      const translation = moveDirection.scale(currentSpeed * deltaTime);
      this.mesh.position.addInPlace(translation);

      // Smooth rotate player facing model matching movement walking direction
      const angle = Math.atan2(moveDirection.x, moveDirection.z);
      this.mesh.rotation.y = angle;
    } else {
      // If idle, face the camera direction horizontal axis so player shoots accurately forward!
      const angle = Math.atan2(forwardVec.x, forwardVec.z);
      this.mesh.rotation.y = angle;
    }

    // Keep player in bounds (ground diameter is 150m, so bounds are -75 to 75. Clamp to [-73, 73])
    const mapLimit = 73;
    if (this.mesh.position.x < -mapLimit) this.mesh.position.x = -mapLimit;
    if (this.mesh.position.x > mapLimit) this.mesh.position.x = mapLimit;
    if (this.mesh.position.z < -mapLimit) this.mesh.position.z = -mapLimit;
    if (this.mesh.position.z > mapLimit) this.mesh.position.z = mapLimit;

    // Lock camera target inside first-person look-node (eye level)
    this.camera.target.copyFrom(this.mesh.position);
    this.camera.target.y += 0.7;

    // Update Projectiles active list
    for (let i = this.activeBullets.length - 1; i >= 0; i--) {
      const b = this.activeBullets[i];
      const deltaDist = b.velocity.scale(deltaTime);
      b.mesh.position.addInPlace(deltaDist);
      b.rangeRemaining -= deltaDist.length();

      // Check collision/penetration sweeps through active enemies bounding box
      let hitRegistered = false;
      
      for (const enemy of enemies) {
        if (enemy.isDead()) continue;
        const dist = Vector3.Distance(b.mesh.position, enemy.getCenterPosition());
        const collisionThreshold = enemy.type === 'boss' ? 2.5 : 1.1;

        if (dist <= collisionThreshold) {
          enemy.takeDamage(b.damage);
          hitRegistered = true;
          break;
        }
      }

      // Check bullet age or hit
      if (hitRegistered || b.rangeRemaining <= 0 || b.mesh.position.y <= 0) {
        b.mesh.dispose();
        this.activeBullets.splice(i, 1);
      }
    }

    // Automatic Fully Automatic Shooting Tick (hold of Rifle key triggers continuous shot)
    if (this.keys['shoot'] || this.scene.getEngine().getRenderingCanvas() && this.keys['click_shot']) {
      this.shoot();
    }
  }

  // Setup auxiliary automatic weapon fire mouse click listener inside parent App orchestrator
  public setShootingState(firing: boolean) {
    if (firing) {
      this.keys['shoot'] = true;
    } else {
      this.keys['shoot'] = false;
    }
  }

  public clearAll() {
    this.activeBullets.forEach(b => b.mesh.dispose());
    this.activeBullets = [];
    this.mesh.setEnabled(true);
    this.gunMesh.setEnabled(true);
    this.health = this.maxHealth;
    this.isDead = false;
  }
}
