/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Scene, Vector3, Mesh, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';

export interface CoinInstance {
  mesh: Mesh;
  value: number;
  physicsVelocity: Vector3;
  age: number;
}

export class CoinManager {
  private coins: CoinInstance[] = [];
  private material: StandardMaterial;
  private autoCollectTimer: number = 0;

  constructor(private scene: Scene) {
    this.material = new StandardMaterial('coin_mat', this.scene);
    this.material.diffuseColor = new Color3(1, 0.84, 0); // Gold
    this.material.emissiveColor = new Color3(0.5, 0.42, 0);
    this.material.specularColor = new Color3(1, 0.9, 0.5);
  }

  public spawnCoin(position: Vector3, value: number) {
    // Create custom gold gem shape (rotated diamond box)
    const coinMesh = MeshBuilder.CreateBox(`coin_${Date.now()}_${Math.random()}`, {
      size: 0.45,
    }, this.scene);
    coinMesh.rotation.x = Math.PI / 4;
    coinMesh.rotation.z = Math.PI / 4;

    coinMesh.position = position.clone();
    coinMesh.position.y = 0.3; // slightly above ground
    coinMesh.material = this.material;

    // Give it a little upward pop velocity when spawned
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 1;
    const popVelocity = new Vector3(
      Math.cos(angle) * speed,
      Math.random() * 3 + 3,
      Math.sin(angle) * speed
    );

    this.coins.push({
      mesh: coinMesh,
      value: value,
      physicsVelocity: popVelocity,
      age: 0,
    });
  }

  public update(
    deltaTime: number,
    playerPosition: Vector3,
    magnetRadius: number,
    autoCollect: boolean,
    onCollect: (amount: number) => void
  ) {
    const groundLevel = 0.3;
    const friction = 3; // apply friction when sliding on the floor

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      const mesh = coin.mesh;

      // Track coin age and handle decay lifetime (disappear after 120 seconds)
      coin.age += deltaTime;
      const maxAge = 120.0;
      if (coin.age >= maxAge) {
        mesh.dispose();
        this.coins.splice(i, 1);
        continue;
      }

      // Visual feedback: shrink and flash in the last 10 seconds before fading out completely
      if (coin.age > maxAge - 10.0) {
        const timeRemaining = maxAge - coin.age;
        const blinkFreq = timeRemaining < 3.0 ? 0.08 : 0.25;
        const show = Math.floor(timeRemaining / blinkFreq) % 2 === 0;
        mesh.setEnabled(show);

        const scale = Math.max(0.1, timeRemaining / 10.0);
        mesh.scaling.set(scale, scale, scale);
      } else {
        mesh.setEnabled(true);
      }

      // Handle simple pop physics
      if (coin.physicsVelocity.y !== 0 || coin.physicsVelocity.x !== 0 || coin.physicsVelocity.z !== 0) {
        // Gravity
        coin.physicsVelocity.y -= 9.81 * deltaTime;
        mesh.position.addInPlace(coin.physicsVelocity.scale(deltaTime));

        // Floor collision
        if (mesh.position.y <= groundLevel) {
          mesh.position.y = groundLevel;
          // Apply horizontal friction when scraping floor
          coin.physicsVelocity.y = 0;
          coin.physicsVelocity.x -= coin.physicsVelocity.x * friction * deltaTime;
          coin.physicsVelocity.z -= coin.physicsVelocity.z * friction * deltaTime;

          // Stop completely if very slow
          if (Math.abs(coin.physicsVelocity.x) < 0.1 && Math.abs(coin.physicsVelocity.z) < 0.1) {
            coin.physicsVelocity = Vector3.Zero();
          }
        }
      }

      // Rotate coin
      mesh.rotation.y += deltaTime * 2.5;

      // Player attraction vector
      const distToPlayer = Vector3.Distance(mesh.position, playerPosition);

      // Determine magnet effectiveness
      // Auto-collect has unlimited magnet attraction but moves slightly slower or acts like magnet
      const isAttracted = autoCollect || distToPlayer <= magnetRadius;

      if (isAttracted) {
        // Fly towards player
        const dir = playerPosition.subtract(mesh.position);
        dir.y += 0.5; // pull toward chest height
        dir.normalize();

        // Speed increases as it gets closer
        const pullSpeed = autoCollect 
          ? Math.max(10, 20 - distToPlayer) 
          : Math.max(5, (magnetRadius - distToPlayer) * 3 + 4);

        mesh.position.addInPlace(dir.scale(pullSpeed * deltaTime));

        // Collection trigger radius
        if (distToPlayer <= 1.2) {
          onCollect(coin.value);
          mesh.dispose();
          this.coins.splice(i, 1);
        }
      }
    }
  }

  // Drop all carrying coins on death
  public dropAllCoins(playerPosition: Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      this.spawnCoin(playerPosition, 1);
    }
  }

  // Clear coin assets
  public clearAll() {
    this.coins.forEach(c => c.mesh.dispose());
    this.coins = [];
  }
}
