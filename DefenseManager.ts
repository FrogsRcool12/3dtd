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
  Nullable,
  Ray
} from '@babylonjs/core';
import { TowerType, TowerDef } from '../types';

export interface PlacedTower {
  id: string;
  type: TowerType;
  mesh: Mesh;          // Base container
  headMesh: Mesh;      // Rotating head
  damage: number;
  fireRate: number;    // Fire speed delay (ms)
  range: number;
  lastFired: number;   // Timestamp
}

interface DefenseBullet {
  mesh: Mesh;
  velocity: Vector3;
  damage: number;
  rangeRemaining: number;
}

export class DefenseManager {
  private towers: PlacedTower[] = [];
  private ghostMesh: Nullable<Mesh> = null;
  private ghostMaterial: StandardMaterial;
  private towerMaterial: StandardMaterial;
  private sniperMaterial: StandardMaterial;
  private laserMaterial: StandardMaterial;
  private bulletMaterial: StandardMaterial;
  private activeBullets: DefenseBullet[] = [];
  
  // Custom Tower Definitions
  public readonly towerDefs = {
    [TowerType.MACHINE_GUN]: {
      id: TowerType.MACHINE_GUN,
      name: 'MG Turret',
      description: 'Rapid fires light armor-piercing kinetic bullets at targets.',
      cost: 160,
      damage: 8,
      fireRate: 220, // fires every 0.22s
      range: 18,
      color: '#3b82f6',
    },
    [TowerType.SNIPER]: {
      id: TowerType.SNIPER,
      name: 'Sniper Core',
      description: 'Ultra long-range electromagnetic heavy railgun.',
      cost: 320,
      damage: 55,
      fireRate: 2400, // fires every 2.4s
      range: 35,
      color: '#a855f7',
    },
  } as Record<TowerType, TowerDef>;

  constructor(private scene: Scene) {
    // Setup materials
    this.ghostMaterial = new StandardMaterial('ghost_mat', this.scene);
    this.ghostMaterial.diffuseColor = new Color3(0, 0.8, 1);
    this.ghostMaterial.alpha = 0.4;
    this.ghostMaterial.emissiveColor = new Color3(0, 0.4, 0.5);

    this.towerMaterial = new StandardMaterial('turret_mat', this.scene);
    this.towerMaterial.diffuseColor = new Color3(0.15, 0.2, 0.3); // Steel blue
    this.towerMaterial.specularColor = new Color3(0.5, 0.5, 0.5);

    this.sniperMaterial = new StandardMaterial('sniper_turret_mat', this.scene);
    this.sniperMaterial.diffuseColor = new Color3(0.25, 0.15, 0.35); // Sleek dark violet
    this.sniperMaterial.emissiveColor = new Color3(0.08, 0, 0.15);

    this.laserMaterial = new StandardMaterial('turret_laser', this.scene);
    this.laserMaterial.emissiveColor = new Color3(1, 1, 0); // tracer color yellow/orange
    this.laserMaterial.diffuseColor = new Color3(1, 0.5, 0);

    this.bulletMaterial = new StandardMaterial('turret_bullet_mat', this.scene);
    this.bulletMaterial.emissiveColor = new Color3(1.0, 0.9, 0.2); // Golden energy bullets, same as player
    this.bulletMaterial.diffuseColor = Color3.Yellow();
  }

  // Handle building ghost preview based on camera aiming ground ray
  public updateGhostPreview(groundPoint: Nullable<Vector3>, type: TowerType) {
    if (!groundPoint) {
      if (this.ghostMesh) {
        this.ghostMesh.dispose();
        this.ghostMesh = null;
      }
      return;
    }

    if (!this.ghostMesh || this.ghostMesh.name !== `ghost_${type}`) {
      if (this.ghostMesh) {
        this.ghostMesh.dispose();
      }

      // Create a logical visual representation for preview
      const container = new Mesh(`ghost_${type}`, this.scene);
      
      const base = MeshBuilder.CreateCylinder('g_base', {
        diameterTop: 1.2,
        diameterBottom: 1.5,
        height: 0.8,
      }, this.scene);
      base.material = this.ghostMaterial;
      base.parent = container;

      const body = MeshBuilder.CreateBox('g_body', {
        size: 0.7,
      }, this.scene);
      body.position.y = 0.75;
      body.material = this.ghostMaterial;
      body.parent = container;

      const barrel = MeshBuilder.CreateCylinder('g_barrel', {
        diameter: 0.25,
        height: 0.9,
      }, this.scene);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = 0.5;
      barrel.position.y = 0.75;
      barrel.material = this.ghostMaterial;
      barrel.parent = container;

      this.ghostMesh = container;
    }

    this.ghostMesh.position.copyFrom(groundPoint);
    this.ghostMesh.position.y = groundPoint.y + 0.4; // support multi-elevation positioning
  }

  // Confirm building and construct tower
  public placeTower(position: Vector3, type: TowerType): PlacedTower {
    const def = this.towerDefs[type];
    const towerId = `tower_${Date.now()}_${Math.random()}`;
    const baseContainer = new Mesh(towerId, this.scene);
    
    // Base Structure
    const base = MeshBuilder.CreateCylinder('base_cyl', {
      diameterTop: type === TowerType.SNIPER ? 0.9 : 1.3,
      diameterBottom: type === TowerType.SNIPER ? 1.4 : 1.6,
      height: type === TowerType.SNIPER ? 2.5 : 1.0,
    }, this.scene);
    base.material = type === TowerType.SNIPER ? this.sniperMaterial : this.towerMaterial;
    base.parent = baseContainer;
    
    // Rotating Turret Head
    const head = MeshBuilder.CreateBox('head_box', {
      width: type === TowerType.SNIPER ? 0.7 : 1.0,
      height: type === TowerType.SNIPER ? 0.7 : 0.6,
      depth: type === TowerType.SNIPER ? 1.1 : 1.0,
    }, this.scene);
    head.position.y = type === TowerType.SNIPER ? 1.5 : 0.8;
    head.material = type === TowerType.SNIPER ? this.sniperMaterial : this.towerMaterial;
    head.parent = baseContainer;

    // Dual Gun Barrels or Single Long Rail Gun
    if (type === TowerType.MACHINE_GUN) {
      // Left Barrel
      const barrelL = MeshBuilder.CreateCylinder('barrel_l', { diameter: 0.18, height: 0.8 }, this.scene);
      barrelL.rotation.x = Math.PI / 2;
      barrelL.position.x = -0.25;
      barrelL.position.z = 0.5;
      barrelL.position.y = 0.8;
      barrelL.material = this.towerMaterial;
      barrelL.parent = baseContainer;

      // Right Barrel
      const barrelR = MeshBuilder.CreateCylinder('barrel_r', { diameter: 0.18, height: 0.8 }, this.scene);
      barrelR.rotation.x = Math.PI / 2;
      barrelR.position.x = 0.25;
      barrelR.position.z = 0.5;
      barrelR.position.y = 0.8;
      barrelR.material = this.towerMaterial;
      barrelR.parent = baseContainer;
    } else {
      // Sniper Barrel (Long glowing tip)
      const barrel = MeshBuilder.CreateCylinder('barrel_sniper', { diameter: 0.15, height: 1.8 }, this.scene);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = 0.8;
      barrel.position.y = 1.5;
      barrel.material = this.sniperMaterial;
      barrel.parent = baseContainer;

      // Sniper scope/antenna structure
      const antenna = MeshBuilder.CreateBox('sniper_ant', { width: 0.1, height: 0.5, depth: 0.1 }, this.scene);
      antenna.position.y = 1.9;
      antenna.position.z = -0.2;
      antenna.material = this.sniperMaterial;
      antenna.parent = baseContainer;
    }

    baseContainer.position.copyFrom(position);
    // Move base to floor height depending on type, supporting multi-elevation vertical offset
    baseContainer.position.y = position.y + (type === TowerType.SNIPER ? 1.25 : 0.5);

    // Clean up ghost preview
    this.removeGhostPreview();

    const placed: PlacedTower = {
      id: towerId,
      type: type,
      mesh: baseContainer,
      headMesh: head,
      damage: def.damage,
      fireRate: def.fireRate,
      range: def.range,
      lastFired: 0
    };

    this.towers.push(placed);
    return placed;
  }

  public removeGhostPreview() {
    if (this.ghostMesh) {
      this.ghostMesh.dispose();
      this.ghostMesh = null;
    }
  }

  // Tower targeting, turning, and shooting
  public update(
    deltaTime: number,
    enemies: { getCenterPosition: () => Vector3; takeDamage: (dmg: number) => void; isDead: () => boolean; type?: string }[]
  ) {
    const now = Date.now();

    for (const tower of this.towers) {
      // 1. Find target (closest active enemy in horizontal range)
      let targetEnemy: any = null;
      let minDistance = tower.range;

      const towerPos = tower.mesh.position;

      for (const enemy of enemies) {
        if (enemy.isDead()) continue;
        const enemyPos = enemy.getCenterPosition();
        const dist = Vector3.Distance(towerPos, enemyPos);

        if (dist < minDistance) {
          minDistance = dist;
          targetEnemy = enemy;
        }
      }

      // If target exists, aim and shoot
      if (targetEnemy) {
        const enemyPos = targetEnemy.getCenterPosition();
        const targetDir = enemyPos.subtract(tower.headMesh.absolutePosition);
        
        // Horizontal look direction calculation
        const angleY = Math.atan2(targetDir.x, targetDir.z);
        
        // Interpolate or snap rotation
        tower.headMesh.rotation.y = angleY - tower.mesh.rotation.y;

        // Pitch elevation toward target height
        const horizontalDist = Math.sqrt(targetDir.x * targetDir.x + targetDir.z * targetDir.z);
        const angleX = -Math.atan2(targetDir.y, horizontalDist);
        tower.headMesh.rotation.x = angleX;

        // Auto-firing mechanism
        if (now - tower.lastFired >= tower.fireRate) {
          tower.lastFired = now;

          // Compute shot direction
          const shotDir = targetDir.clone();
          shotDir.normalize();

          // Spawn a physical golden bullet sphere
          const bulletMesh = MeshBuilder.CreateSphere(`t_bullet_${Date.now()}_${Math.random()}`, {
            diameter: tower.type === TowerType.SNIPER ? 0.35 : 0.22,
          }, this.scene);

          bulletMesh.material = this.bulletMaterial;
          bulletMesh.position.copyFrom(tower.headMesh.absolutePosition);

          // Add minor vertical offset so bullets come out neat
          bulletMesh.position.y += 0.15;

          // Velocity: 25m/s for MG, 45m/s for Sniper
          const speed = tower.type === TowerType.SNIPER ? 45.0 : 25.0;
          const bulletVelocity = shotDir.scale(speed);

          this.activeBullets.push({
            mesh: bulletMesh,
            velocity: bulletVelocity,
            damage: tower.damage,
            rangeRemaining: tower.range,
          });

          // Render visual muzzle flash tracer for feedback
          this.drawTracer(tower.headMesh.absolutePosition, tower.headMesh.absolutePosition.add(shotDir.scale(1.5)), tower.type);
        }
      } else {
        // Idle slowly rotates the gun head
        tower.headMesh.rotation.y += deltaTime * 0.3;
        tower.headMesh.rotation.x = 0;
      }
    }

    // Update active turret bullet physics and collision sweeping
    for (let i = this.activeBullets.length - 1; i >= 0; i--) {
      const b = this.activeBullets[i];
      const deltaDist = b.velocity.scale(deltaTime);
      b.mesh.position.addInPlace(deltaDist);
      b.rangeRemaining -= deltaDist.length();

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

      // Cleanup bullet if it hit, went out of bounds/range, or touched floor
      if (hitRegistered || b.rangeRemaining <= 0 || b.mesh.position.y <= -0.1) {
        b.mesh.dispose();
        this.activeBullets.splice(i, 1);
      }
    }
  }

  // Tracers visual flash
  private drawTracer(start: Vector3, end: Vector3, type: TowerType) {
    // Elegant line tracer
    const laser = MeshBuilder.CreateCylinder(`laser_${Math.random()}`, {
      height: Vector3.Distance(start, end),
      diameter: type === TowerType.SNIPER ? 0.15 : 0.08,
    }, this.scene);

    laser.material = this.laserMaterial;

    // Center it between start and end
    laser.position = Vector3.Center(start, end);

    // Coordinate rotation so cylinder faces target
    laser.lookAt(end);
    laser.rotate(Vector3.Right(), Math.PI / 2);

    // Scale color/material depending on type
    const customMat = new StandardMaterial('l_mat', this.scene);
    if (type === TowerType.SNIPER) {
      customMat.emissiveColor = new Color3(1, 0, 1); // Neon Pink/Purple tracer
    } else {
      customMat.emissiveColor = new Color3(0, 1, 1); // Cyan tracer
    }
    laser.material = customMat;

    // Self-destruct laser after 80ms
    setTimeout(() => {
      laser.dispose();
      customMat.dispose();
    }, 80);
  }

  public clearAll() {
    this.towers.forEach(t => t.mesh.dispose());
    this.towers = [];
    this.activeBullets.forEach(b => b.mesh.dispose());
    this.activeBullets = [];
    this.removeGhostPreview();
  }
}
