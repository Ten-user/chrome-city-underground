import * as THREE from 'three';
import { Physics } from './Physics';
import { NEON_GREEN, NEON_ORANGE, NEON_PURPLE, clamp, randomChoice, randomRange } from './Utils';

export interface WeaponType {
  name: string;
  damage: number;
  fireRate: number; // shots per second
  range: number;
  spread: number;
  ammo: number;
  maxAmmo: number;
  reloadTime: number;
  automatic: boolean;
  color: number;
}

export const WEAPON_TYPES: Record<string, WeaponType> = {
  pistol: {
    name: '9mm Pistol',
    damage: 15,
    fireRate: 4,
    range: 80,
    spread: 0.02,
    ammo: Infinity,
    maxAmmo: Infinity,
    reloadTime: 0,
    automatic: false,
    color: 0x888888,
  },
  smg: {
    name: 'Street Sweeper SMG',
    damage: 10,
    fireRate: 12,
    range: 50,
    spread: 0.05,
    ammo: 120,
    maxAmmo: 120,
    reloadTime: 2,
    automatic: true,
    color: 0x555555,
  },
  assault: {
    name: 'AR-7 Assault Rifle',
    damage: 20,
    fireRate: 8,
    range: 100,
    spread: 0.03,
    ammo: 90,
    maxAmmo: 90,
    reloadTime: 2.5,
    automatic: true,
    color: 0x333333,
  },
  shotgun: {
    name: 'Boomstick Shotgun',
    damage: 50,
    fireRate: 1.5,
    range: 25,
    spread: 0.12,
    ammo: 20,
    maxAmmo: 20,
    reloadTime: 3,
    automatic: false,
    color: 0x664422,
  },
  sniper: {
    name: 'Phantom Sniper',
    damage: 80,
    fireRate: 0.8,
    range: 250,
    spread: 0.005,
    ammo: 15,
    maxAmmo: 15,
    reloadTime: 3.5,
    automatic: false,
    color: 0x2a2a3a,
  },
};

export interface WeaponPickup {
  mesh: THREE.Mesh;
  weaponType: string;
  position: THREE.Vector3;
  collected: boolean;
  respawnTimer: number;
}

export class Combat {
  scene: THREE.Scene;
  physics: Physics;
  currentWeaponIndex = 0;
  weapons: string[] = ['pistol'];
  ammo: Record<string, number> = { pistol: Infinity, smg: 0, assault: 0, shotgun: 0, sniper: 0 };
  isReloading = false;
  reloadTimer = 0;
  private shootTimer = 0;
  private muzzleFlash: THREE.PointLight | null = null;
  private tracers: { mesh: THREE.Mesh; life: number; velocity: THREE.Vector3 }[] = [];
  private bloodParticles: { mesh: THREE.Mesh; life: number; velocity: THREE.Vector3 }[] = [];
  private weaponMesh: THREE.Group | null = null;
  pickups: WeaponPickup[] = [];

  constructor(scene: THREE.Scene, physics: Physics) {
    this.scene = scene;
    this.physics = physics;

    // Muzzle flash light
    this.muzzleFlash = new THREE.PointLight(0xffaa44, 0, 10);
    scene.add(this.muzzleFlash);

    this.spawnWeaponPickups();
  }

  getCurrentWeapon(): WeaponType {
    const weaponKey = this.weapons[this.currentWeaponIndex];
    return WEAPON_TYPES[weaponKey];
  }

  getCurrentWeaponKey(): string {
    return this.weapons[this.currentWeaponIndex];
  }

  switchWeapon(index: number) {
    if (index >= 0 && index < this.weapons.length) {
      this.currentWeaponIndex = index;
      this.isReloading = false;
    }
  }

  nextWeapon() {
    this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weapons.length;
    this.isReloading = false;
  }

  addWeapon(weaponKey: string) {
    if (!this.weapons.includes(weaponKey)) {
      this.weapons.push(weaponKey);
      this.ammo[weaponKey] = WEAPON_TYPES[weaponKey].maxAmmo;
    } else {
      this.ammo[weaponKey] = Math.min(
        WEAPON_TYPES[weaponKey].maxAmmo * 2,
        this.ammo[weaponKey] + WEAPON_TYPES[weaponKey].maxAmmo
      );
    }
  }

  shoot(origin: THREE.Vector3, direction: THREE.Vector3, playerPos: THREE.Vector3): { hit: boolean; hitPoint: THREE.Vector3; hitCollider: any } | null {
    const weapon = this.getCurrentWeapon();
    const weaponKey = this.getCurrentWeaponKey();

    if (this.isReloading) return null;
    if (this.shootTimer > 0) return null;
    if (this.ammo[weaponKey] <= 0) {
      this.startReload();
      return null;
    }

    // Consume ammo
    if (this.ammo[weaponKey] !== Infinity) {
      this.ammo[weaponKey]--;
    }

    // Set cooldown
    this.shootTimer = 1 / weapon.fireRate;

    // Apply spread
    const spread = weapon.spread;
    const spreadDir = direction.clone();
    spreadDir.x += (Math.random() - 0.5) * spread;
    spreadDir.y += (Math.random() - 0.5) * spread;
    spreadDir.z += (Math.random() - 0.5) * spread;
    spreadDir.normalize();

    // Muzzle flash
    if (this.muzzleFlash) {
      this.muzzleFlash.position.copy(origin).add(spreadDir.clone().multiplyScalar(1));
      this.muzzleFlash.intensity = 50;
    }

    // Tracer
    this.createTracer(origin, spreadDir, weapon.range);

    // Raycast
    const hit = this.physics.raycast(origin, spreadDir, weapon.range);

    if (hit) {
      // Hit effect
      this.createBloodEffect(hit.point);
      return { hit: true, hitPoint: hit.point, hitCollider: hit.collider };
    }

    return { hit: false, hitPoint: origin.clone().add(spreadDir.multiplyScalar(weapon.range)), hitCollider: null };
  }

  startReload() {
    const weaponKey = this.getCurrentWeaponKey();
    const weapon = this.getCurrentWeapon();
    if (this.ammo[weaponKey] === Infinity) return;
    if (this.ammo[weaponKey] >= weapon.maxAmmo) return;
    if (this.isReloading) return;

    this.isReloading = true;
    this.reloadTimer = weapon.reloadTime;
  }

  update(delta: number) {
    // Shoot timer
    if (this.shootTimer > 0) this.shootTimer -= delta;

    // Muzzle flash decay
    if (this.muzzleFlash && this.muzzleFlash.intensity > 0) {
      this.muzzleFlash.intensity *= Math.max(0, 1 - delta * 20);
    }

    // Reload
    if (this.isReloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const weaponKey = this.getCurrentWeaponKey();
        this.ammo[weaponKey] = WEAPON_TYPES[weaponKey].maxAmmo;
      }
    }

    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= delta;
      t.mesh.position.add(t.velocity.clone().multiplyScalar(delta));
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = t.life / 0.15;

      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }

    // Update blood particles
    for (let i = this.bloodParticles.length - 1; i >= 0; i--) {
      const p = this.bloodParticles[i];
      p.life -= delta;
      p.velocity.y -= 10 * delta;
      p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.bloodParticles.splice(i, 1);
      }
    }

    // Update pickups
    for (const pickup of this.pickups) {
      if (pickup.collected) {
        pickup.respawnTimer -= delta;
        if (pickup.respawnTimer <= 0) {
          pickup.collected = false;
          pickup.mesh.visible = true;
        }
      } else {
        // Bob animation
        pickup.mesh.position.y = 1 + Math.sin(Date.now() * 0.003) * 0.3;
        pickup.mesh.rotation.y += delta * 2;
      }
    }
  }

  private createTracer(origin: THREE.Vector3, direction: THREE.Vector3, range: number) {
    const tracerLen = 2;
    const geo = new THREE.CylinderGeometry(0.02, 0.02, tracerLen, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 1,
    });
    const tracer = new THREE.Mesh(geo, mat);

    // Orient tracer
    tracer.position.copy(origin).add(direction.clone().multiplyScalar(tracerLen / 2));
    tracer.lookAt(origin.clone().add(direction.clone().multiplyScalar(range)));
    tracer.rotateX(Math.PI / 2);

    this.scene.add(tracer);
    this.tracers.push({
      mesh: tracer,
      life: 0.15,
      velocity: direction.clone().multiplyScalar(range * 3),
    });
  }

  private createBloodEffect(position: THREE.Vector3) {
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.SphereGeometry(0.05, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xcc0000,
        transparent: true,
        opacity: 1,
      });
      const particle = new THREE.Mesh(geo, mat);
      particle.position.copy(position);
      this.scene.add(particle);

      this.bloodParticles.push({
        mesh: particle,
        life: 0.5 + Math.random() * 0.5,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          Math.random() * 5,
          (Math.random() - 0.5) * 5
        ),
      });
    }
  }

  private spawnWeaponPickups() {
    const pickupTypes = ['smg', 'assault', 'shotgun', 'sniper'];
    const colors: Record<string, number> = {
      smg: NEON_GREEN,
      assault: NEON_ORANGE,
      shotgun: NEON_PURPLE,
      sniper: 0xff0000,
    };

    for (let i = 0; i < 20; i++) {
      const weaponType = randomChoice(pickupTypes);
      const x = randomRange(-800, 800);
      const z = randomRange(-800, 800);

      const geo = new THREE.BoxGeometry(0.8, 0.4, 0.4);
      const mat = new THREE.MeshStandardMaterial({
        color: colors[weaponType],
        emissive: colors[weaponType],
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.7,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 1, z);
      this.scene.add(mesh);

      this.pickups.push({
        mesh,
        weaponType,
        position: new THREE.Vector3(x, 0, z),
        collected: false,
        respawnTimer: 0,
      });
    }
  }

  checkPickup(playerPos: THREE.Vector3): string | null {
    for (const pickup of this.pickups) {
      if (pickup.collected) continue;
      const dx = playerPos.x - pickup.position.x;
      const dz = playerPos.z - pickup.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 2) {
        pickup.collected = true;
        pickup.mesh.visible = false;
        pickup.respawnTimer = 60; // 1 minute respawn
        return pickup.weaponType;
      }
    }
    return null;
  }

  getAmmoCount(): number {
    return this.ammo[this.getCurrentWeaponKey()];
  }

  getMaxAmmo(): number {
    return this.getCurrentWeapon().maxAmmo;
  }
}
