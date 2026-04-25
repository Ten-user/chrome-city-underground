import * as THREE from 'three';
import { Physics, Collider } from './Physics';
import { distance2D, angleBetween, randomRange, randomChoice, NEON_GREEN, NEON_ORANGE, NEON_PURPLE } from './Utils';

export interface AIEntity {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  type: 'thug' | 'soldier' | 'elite' | 'boss' | 'civilian' | 'police';
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'dead';
  weapon: string;
  damage: number;
  fireRate: number;
  shootTimer: number;
  alertRange: number;
  attackRange: number;
  patrolTarget: THREE.Vector3 | null;
  isEnemy: boolean;
  collider: Collider | null;
  territoryX: number;
  territoryZ: number;
  territoryRadius: number;
}

export class AISystem {
  scene: THREE.Scene;
  physics: Physics;
  entities: AIEntity[] = [];
  private removeQueue: AIEntity[] = [];

  constructor(scene: THREE.Scene, physics: Physics) {
    this.scene = scene;
    this.physics = physics;
  }

  spawnEnemies() {
    // Spawn gang territories
    const territories = [
      { x: -300, z: -300, radius: 150, type: 'thug' as const, count: 8 },
      { x: 300, z: -200, radius: 120, type: 'soldier' as const, count: 6 },
      { x: -200, z: 300, radius: 100, type: 'elite' as const, count: 4 },
      { x: 400, z: 400, radius: 80, type: 'boss' as const, count: 2 },
    ];

    for (const t of territories) {
      for (let i = 0; i < t.count; i++) {
        const x = t.x + randomRange(-t.radius, t.radius);
        const z = t.z + randomRange(-t.radius, t.radius);
        this.spawnEnemy(x, z, t.type, t.x, t.z, t.radius);
      }
    }
  }

  spawnCivilians() {
    for (let i = 0; i < 30; i++) {
      const x = randomRange(-800, 800);
      const z = randomRange(-800, 800);
      this.spawnCivilian(x, z);
    }
  }

  spawnEnemy(x: number, z: number, type: 'thug' | 'soldier' | 'elite' | 'boss', territoryX: number, territoryZ: number, territoryRadius: number) {
    const entity = this.createEntity(x, z, type, true, territoryX, territoryZ, territoryRadius);
    this.entities.push(entity);
    return entity;
  }

  spawnCivilian(x: number, z: number) {
    const entity = this.createEntity(x, z, 'civilian', false, x, z, 100);
    this.entities.push(entity);
    return entity;
  }

  spawnPolice(x: number, z: number) {
    const entity = this.createEntity(x, z, 'police', true, x, z, 200);
    this.entities.push(entity);
    return entity;
  }

  private createEntity(x: number, z: number, type: 'thug' | 'soldier' | 'elite' | 'boss' | 'civilian' | 'police', isEnemy: boolean, territoryX: number, territoryZ: number, territoryRadius: number): AIEntity {
    const mesh = new THREE.Group();

    let bodyColor: number;
    let height = 1.8;
    let health = 50;
    let weapon = 'pistol';
    let damage = 8;
    let fireRate = 2;
    let alertRange = 30;
    let attackRange = 25;

    switch (type) {
      case 'thug':
        bodyColor = randomChoice([0x4a2a2a, 0x2a2a4a, 0x3a3a3a]);
        health = 50;
        weapon = 'pistol';
        damage = 8;
        fireRate = 2;
        break;
      case 'soldier':
        bodyColor = randomChoice([0x2a3a2a, 0x3a2a3a]);
        health = 80;
        weapon = 'smg';
        damage = 12;
        fireRate = 5;
        break;
      case 'elite':
        bodyColor = 0x1a1a2a;
        health = 120;
        weapon = 'assault';
        damage = 18;
        fireRate = 6;
        alertRange = 40;
        attackRange = 35;
        break;
      case 'boss':
        bodyColor = 0x880000;
        height = 2.0;
        health = 200;
        weapon = 'assault';
        damage = 25;
        fireRate = 8;
        alertRange = 50;
        attackRange = 40;
        break;
      case 'civilian':
        bodyColor = randomChoice([0x5a5a6a, 0x6a5a4a, 0x4a6a5a, 0x7a6a5a]);
        health = 30;
        alertRange = 20;
        attackRange = 0;
        break;
      case 'police':
        bodyColor = 0x1a2a4a;
        health = 80;
        weapon = 'pistol';
        damage = 12;
        fireRate = 3;
        alertRange = 40;
        attackRange = 30;
        break;
    }

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.8, 0.4),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.8 })
    );
    body.position.y = 1.2;
    body.castShadow = true;
    mesh.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.7 })
    );
    head.position.y = 1.85;
    head.castShadow = true;
    mesh.add(head);

    // Legs
    for (const lx of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.7, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.8 })
      );
      leg.position.set(lx, 0.35, 0);
      leg.castShadow = true;
      mesh.add(leg);
    }

    // Health bar
    if (isEnemy && type !== 'civilian') {
      const healthBarBg = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7 })
      );
      healthBarBg.position.y = 2.3;
      mesh.add(healthBarBg);

      const healthBar = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9 })
      );
      healthBar.position.set(0, 2.3, 0.01);
      healthBar.name = 'healthBar';
      mesh.add(healthBar);
    }

    // Weapon for armed types
    if (isEnemy && type !== 'civilian') {
      const gunMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 })
      );
      gunMesh.position.set(0.35, 1.2, 0.2);
      mesh.add(gunMesh);
    }

    mesh.position.set(x, 0, z);
    this.scene.add(mesh);

    const entity: AIEntity = {
      mesh,
      position: new THREE.Vector3(x, 0, z),
      velocity: new THREE.Vector3(),
      rotation: Math.random() * Math.PI * 2,
      health,
      maxHealth: health,
      type,
      state: 'idle',
      weapon,
      damage,
      fireRate,
      shootTimer: 0,
      alertRange,
      attackRange,
      patrolTarget: null,
      isEnemy,
      collider: null,
      territoryX,
      territoryZ,
      territoryRadius,
    };

    const collider: Collider = {
      aabb: { minX: x - 0.4, minZ: z - 0.4, maxX: x + 0.4, maxZ: z + 0.4 },
      height: height,
      type: type === 'civilian' ? 'tree' : 'building',
      mesh,
    };
    entity.collider = collider;
    this.physics.addCollider(collider);

    return entity;
  }

  update(delta: number, playerPos: THREE.Vector3, playerIsInVehicle: boolean, playerSpeed: number) {
    for (const entity of this.entities) {
      if (entity.state === 'dead') continue;

      const distToPlayer = distance2D(
        entity.position.x, entity.position.z,
        playerPos.x, playerPos.z
      );

      // Update AI state
      if (entity.type === 'civilian') {
        this.updateCivilian(entity, delta, playerPos, distToPlayer);
      } else {
        this.updateEnemy(entity, delta, playerPos, distToPlayer);
      }

      // Update health bar
      const healthBar = entity.mesh.getObjectByName('healthBar') as THREE.Mesh | undefined;
      if (healthBar) {
        const ratio = entity.health / entity.maxHealth;
        healthBar.scale.x = Math.max(0, ratio);
        healthBar.position.x = -(1 - ratio) / 2;
        healthBar.lookAt(healthBar.getWorldPosition(new THREE.Vector3()).add(
          new THREE.Vector3(0, 0, -1).applyQuaternion(entity.mesh.quaternion).multiplyScalar(-1)
        ));
      }

      // Update position
      entity.mesh.position.copy(entity.position);
      entity.mesh.rotation.y = entity.rotation;

      // Update collider
      if (entity.collider) {
        entity.collider.aabb = {
          minX: entity.position.x - 0.4,
          minZ: entity.position.z - 0.4,
          maxX: entity.position.x + 0.4,
          maxZ: entity.position.z + 0.4,
        };
      }
    }

    // Remove dead entities (after a delay)
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.state === 'dead') {
        e.mesh.position.y -= delta * 0.5;
        if (e.mesh.position.y < -2) {
          this.scene.remove(e.mesh);
          if (e.collider) this.physics.removeCollider(e.mesh);
          this.entities.splice(i, 1);
        }
      }
    }
  }

  private updateEnemy(entity: AIEntity, delta: number, playerPos: THREE.Vector3, distToPlayer: number) {
    entity.shootTimer -= delta;

    switch (entity.state) {
      case 'idle':
        // Check if player is in range
        if (distToPlayer < entity.alertRange) {
          entity.state = 'chase';
        } else {
          // Wander
          this.wander(entity, delta);
        }
        break;

      case 'patrol':
        this.moveToPatrolTarget(entity, delta);
        if (distToPlayer < entity.alertRange) {
          entity.state = 'chase';
        }
        break;

      case 'chase':
        if (distToPlayer < entity.attackRange) {
          entity.state = 'attack';
        } else if (distToPlayer > entity.alertRange * 3) {
          entity.state = 'patrol';
        } else {
          this.moveToward(entity, playerPos.x, playerPos.z, delta, 5);
        }
        break;

      case 'attack':
        if (distToPlayer > entity.attackRange * 1.5) {
          entity.state = 'chase';
        } else if (entity.health < entity.maxHealth * 0.2) {
          entity.state = 'flee';
        } else {
          // Face player
          entity.rotation = angleBetween(entity.position.x, entity.position.z, playerPos.x, playerPos.z);

          // Shoot
          if (entity.shootTimer <= 0) {
            entity.shootTimer = 1 / entity.fireRate;
            return; // Signal to game engine that this entity is shooting
          }
        }
        break;

      case 'flee':
        this.moveAwayFrom(entity, playerPos.x, playerPos.z, delta, 7);
        if (distToPlayer > entity.alertRange * 2 || entity.health > entity.maxHealth * 0.5) {
          entity.state = 'chase';
        }
        break;
    }
  }

  private updateCivilian(entity: AIEntity, delta: number, playerPos: THREE.Vector3, distToPlayer: number) {
    if (entity.state === 'flee') {
      this.moveAwayFrom(entity, playerPos.x, playerPos.z, delta, 6);
      if (distToPlayer > 30) {
        entity.state = 'idle';
      }
    } else {
      this.wander(entity, delta);
    }
  }

  private wander(entity: AIEntity, delta: number) {
    if (!entity.patrolTarget || distance2D(entity.position.x, entity.position.z, entity.patrolTarget.x, entity.patrolTarget.z) < 2) {
      // New random target within territory
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * entity.territoryRadius * 0.5;
      entity.patrolTarget = new THREE.Vector3(
        entity.territoryX + Math.cos(angle) * dist,
        0,
        entity.territoryZ + Math.sin(angle) * dist
      );
    }

    this.moveToward(entity, entity.patrolTarget.x, entity.patrolTarget.z, delta, 2);
  }

  private moveToward(entity: AIEntity, targetX: number, targetZ: number, delta: number, speed: number) {
    const dx = targetX - entity.position.x;
    const dz = targetZ - entity.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.5) {
      entity.rotation = Math.atan2(dx, dz);
      entity.position.x += (dx / dist) * speed * delta;
      entity.position.z += (dz / dist) * speed * delta;
    }
  }

  private moveAwayFrom(entity: AIEntity, fromX: number, fromZ: number, delta: number, speed: number) {
    const dx = entity.position.x - fromX;
    const dz = entity.position.z - fromZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0) {
      entity.rotation = Math.atan2(dx, dz);
      entity.position.x += (dx / dist) * speed * delta;
      entity.position.z += (dz / dist) * speed * delta;
    }
  }

  private moveToPatrolTarget(entity: AIEntity, delta: number) {
    if (entity.patrolTarget) {
      this.moveToward(entity, entity.patrolTarget.x, entity.patrolTarget.z, delta, 3);
    } else {
      this.wander(entity, delta);
    }
  }

  damageEntity(entity: AIEntity, damage: number): boolean {
    entity.health -= damage;
    if (entity.health <= 0) {
      entity.health = 0;
      entity.state = 'dead';
      return true;
    }
    // Alert nearby enemies
    if (entity.state === 'idle' || entity.state === 'patrol') {
      entity.state = 'chase';
    }
    return false;
  }

  alertNearbyEnemies(x: number, z: number, range: number) {
    for (const entity of this.entities) {
      if (entity.state === 'dead' || entity.type === 'civilian') continue;
      const dist = distance2D(x, z, entity.position.x, entity.position.z);
      if (dist < range && (entity.state === 'idle' || entity.state === 'patrol')) {
        entity.state = 'chase';
      }
    }
  }

  makeCiviliansFlee(x: number, z: number, range: number) {
    for (const entity of this.entities) {
      if (entity.type !== 'civilian' || entity.state === 'dead') continue;
      const dist = distance2D(x, z, entity.position.x, entity.position.z);
      if (dist < range) {
        entity.state = 'flee';
      }
    }
  }

  getEntitiesInRange(x: number, z: number, range: number): AIEntity[] {
    return this.entities.filter(e =>
      e.state !== 'dead' &&
      distance2D(x, z, e.position.x, e.position.z) < range
    );
  }

  getNearestVehicle(x: number, z: number, vehicles: any[]): any | null {
    let best: any = null;
    let bestDist = 8; // Max distance to enter vehicle

    for (const v of vehicles) {
      if (v.isOccupied || v.isDestroyed) continue;
      const dist = distance2D(x, z, v.position.x, v.position.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = v;
      }
    }

    return best;
  }

  clearPolice() {
    const toRemove = this.entities.filter(e => e.type === 'police');
    for (const e of toRemove) {
      this.scene.remove(e.mesh);
      if (e.collider) this.physics.removeCollider(e.mesh);
    }
    this.entities = this.entities.filter(e => e.type !== 'police');
  }
}
