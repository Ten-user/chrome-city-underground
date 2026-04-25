import * as THREE from 'three';
import { Physics, Collider } from './Physics';
import { InputManager } from './Input';
import { NEON_GREEN, NEON_ORANGE, NEON_PURPLE, clamp, lerp, randomChoice } from './Utils';

export interface VehicleType {
  name: string;
  maxSpeed: number;
  acceleration: number;
  handling: number;
  health: number;
  color: number;
  bodyW: number;
  bodyH: number;
  bodyD: number;
  wheelRadius: number;
  nitrousMax: number;
  mass: number;
}

export const VEHICLE_TYPES: Record<string, VehicleType> = {
  muscle: {
    name: 'V8 Ghost',
    maxSpeed: 55,
    acceleration: 25,
    handling: 2.2,
    health: 200,
    color: 0xcc2200,
    bodyW: 2.2, bodyH: 1.2, bodyD: 5,
    wheelRadius: 0.4,
    nitrousMax: 100,
    mass: 1500,
  },
  tuner: {
    name: 'Drift King',
    maxSpeed: 45,
    acceleration: 20,
    handling: 3.5,
    health: 150,
    color: 0x0088ff,
    bodyW: 2.0, bodyH: 1.0, bodyD: 4.5,
    wheelRadius: 0.35,
    nitrousMax: 120,
    mass: 1100,
  },
  supercar: {
    name: 'Phantom X',
    maxSpeed: 80,
    acceleration: 35,
    handling: 1.8,
    health: 120,
    color: 0xffcc00,
    bodyW: 2.1, bodyH: 0.8, bodyD: 4.8,
    wheelRadius: 0.35,
    nitrousMax: 80,
    mass: 1200,
  },
  motorcycle: {
    name: 'Night Rider',
    maxSpeed: 60,
    acceleration: 30,
    handling: 4.0,
    health: 80,
    color: 0x111111,
    bodyW: 0.8, bodyH: 0.8, bodyD: 2.5,
    wheelRadius: 0.35,
    nitrousMax: 60,
    mass: 300,
  },
  truck: {
    name: 'Iron Horse',
    maxSpeed: 30,
    acceleration: 12,
    handling: 1.2,
    health: 400,
    color: 0x445544,
    bodyW: 2.8, bodyH: 2.0, bodyD: 7,
    wheelRadius: 0.55,
    nitrousMax: 50,
    mass: 4000,
  },
};

export class Vehicle {
  mesh: THREE.Group;
  type: VehicleType;
  position: THREE.Vector3;
  rotation: number = 0;
  speed: number = 0;
  steerAngle: number = 0;
  health: number;
  maxHealth: number;
  nitrous: number;
  isOccupied = false;
  driver: any = null;
  isDestroyed = false;
  collider: Collider | null = null;
  private wheels: THREE.Mesh[] = [];
  private exhaustParticles: THREE.Points | null = null;
  private isDrifting = false;
  private driftFactor = 0;
  private brakeLights: THREE.Mesh[] = [];
  private headLights: THREE.Object3D[] = [];

  constructor(type: VehicleType, x: number, z: number, rotation = 0) {
    this.type = type;
    this.position = new THREE.Vector3(x, 0, z);
    this.rotation = rotation;
    this.health = type.health;
    this.maxHealth = type.health;
    this.nitrous = type.nitrousMax;
    this.mesh = new THREE.Group();
    this.createVehicleMesh();
    this.mesh.position.set(x, type.wheelRadius + type.bodyH / 2, z);
    this.mesh.rotation.y = rotation;
  }

  private createVehicleMesh() {
    const t = this.type;

    // Main body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: t.color,
      roughness: 0.3,
      metalness: 0.7,
    });
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(t.bodyW, t.bodyH * 0.6, t.bodyD),
      bodyMat
    );
    body.position.y = t.bodyH * 0.3;
    body.castShadow = true;
    this.mesh.add(body);

    // Cabin / roof
    if (t.name !== 'Night Rider') {
      const cabinH = t.bodyH * 0.5;
      const cabinMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.7,
      });
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(t.bodyW * 0.9, cabinH, t.bodyD * 0.5),
        cabinMat
      );
      cabin.position.set(0, t.bodyH * 0.6 + cabinH / 2, -t.bodyD * 0.1);
      cabin.castShadow = true;
      this.mesh.add(cabin);
    }

    // Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const wheelGeo = new THREE.CylinderGeometry(t.wheelRadius, t.wheelRadius, 0.25, 12);
    const wheelPositions = this.getWheelPositions();

    for (const wp of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wp.x, wp.y, wp.z);
      wheel.castShadow = true;
      this.mesh.add(wheel);
      this.wheels.push(wheel);
    }

    // Headlights
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffcc,
      emissiveIntensity: 0.5,
    });
    for (const dx of [-t.bodyW * 0.35, t.bodyW * 0.35]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.2, 0.1),
        headlightMat.clone()
      );
      hl.position.set(dx, t.bodyH * 0.3, t.bodyD / 2);
      this.mesh.add(hl);
      this.headLights.push(hl as any);
    }

    // Brake lights
    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
    });
    for (const dx of [-t.bodyW * 0.35, t.bodyW * 0.35]) {
      const bl = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.2, 0.1),
        brakeMat.clone()
      );
      bl.position.set(dx, t.bodyH * 0.3, -t.bodyD / 2);
      this.mesh.add(bl);
      this.brakeLights.push(bl);
    }
  }

  private getWheelPositions(): { x: number; y: number; z: number }[] {
    const t = this.type;
    const wx = t.bodyW / 2 + 0.1;
    const wy = -t.bodyH * 0.3;
    const frontZ = t.bodyD * 0.35;
    const rearZ = -t.bodyD * 0.35;

    return [
      { x: -wx, y: wy, z: frontZ },
      { x: wx, y: wy, z: frontZ },
      { x: -wx, y: wy, z: rearZ },
      { x: wx, y: wy, z: rearZ },
    ];
  }

  addToScene(scene: THREE.Scene, physics: Physics) {
    scene.add(this.mesh);
    this.collider = {
      aabb: {
        minX: this.position.x - this.type.bodyW,
        minZ: this.position.z - this.type.bodyD,
        maxX: this.position.x + this.type.bodyW,
        maxZ: this.position.z + this.type.bodyD,
      },
      height: this.type.bodyH * 1.5,
      type: 'vehicle',
      mesh: this.mesh,
    };
    physics.addCollider(this.collider);
  }

  removeFromScene(scene: THREE.Scene, physics: Physics) {
    scene.remove(this.mesh);
    if (this.collider) {
      physics.removeCollider(this.mesh);
    }
  }

  update(delta: number, input: InputManager | null, physics: Physics, rainFactor: number) {
    if (this.isDestroyed) return;

    if (this.isOccupied && input) {
      this.updateDriving(delta, input, physics, rainFactor);
    } else {
      // Decelerate when not being driven
      this.speed *= (1 - 2 * delta);
      if (Math.abs(this.speed) < 0.1) this.speed = 0;
      this.steerAngle *= (1 - 5 * delta);
    }

    // Update mesh position
    this.mesh.position.x = this.position.x;
    this.mesh.position.y = this.type.wheelRadius + this.type.bodyH / 2;
    this.mesh.position.z = this.position.z;
    this.mesh.rotation.y = this.rotation;

    // Update collider
    if (this.collider) {
      const hw = this.type.bodyW / 2 + 0.5;
      const hd = this.type.bodyD / 2 + 0.5;
      // Rotate AABB around vehicle position
      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);
      const extents = [
        { x: -hw, z: -hd }, { x: hw, z: -hd },
        { x: -hw, z: hd }, { x: hw, z: hd }
      ];
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const e of extents) {
        const rx = e.x * cos - e.z * sin + this.position.x;
        const rz = e.x * sin + e.z * cos + this.position.z;
        minX = Math.min(minX, rx);
        minZ = Math.min(minZ, rz);
        maxX = Math.max(maxX, rx);
        maxZ = Math.max(maxZ, rz);
      }
      this.collider.aabb = { minX, minZ, maxX, maxZ };
    }

    // Spin wheels
    const wheelRotSpeed = this.speed * 2;
    for (const w of this.wheels) {
      w.rotation.x += wheelRotSpeed * delta;
    }

    // Headlights on at night (controlled externally)
    // Brake lights
    const isBraking = input?.state.backward || input?.state.handbrake;
    for (const bl of this.brakeLights) {
      const mat = bl.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = isBraking ? 2 : 0.3;
    }
  }

  private updateDriving(delta: number, input: InputManager, physics: Physics, rainFactor: number) {
    const t = this.type;
    const friction = 1 - (0.5 + rainFactor * 0.5) * delta;

    // Acceleration
    if (input.state.forward) {
      this.speed += t.acceleration * delta;
    } else if (input.state.backward) {
      this.speed -= t.acceleration * 0.6 * delta;
    }

    // Nitrous
    if (input.state.nitrous && this.nitrous > 0 && this.speed > 5) {
      this.speed += t.acceleration * 2 * delta;
      this.nitrous = Math.max(0, this.nitrous - 30 * delta);
    } else {
      this.nitrous = Math.min(t.nitrousMax, this.nitrous + 5 * delta);
    }

    // Speed limits
    this.speed = clamp(this.speed, -t.maxSpeed * 0.3, t.maxSpeed);

    // Handbrake / drift
    if (input.state.handbrake && Math.abs(this.speed) > 5) {
      this.isDrifting = true;
      this.driftFactor = Math.min(1, this.driftFactor + delta * 3);
      this.speed *= (1 - 1.5 * delta);
    } else {
      this.isDrifting = false;
      this.driftFactor = Math.max(0, this.driftFactor - delta * 2);
    }

    // Steering
    const steerSpeed = t.handling * (1 - this.driftFactor * 0.5);
    const steerInput = (input.state.left ? 1 : 0) + (input.state.right ? -1 : 0);
    this.steerAngle = lerp(this.steerAngle, steerInput * 0.8, delta * steerSpeed * 3);

    // Apply steering
    if (Math.abs(this.speed) > 1) {
      const turnRate = this.steerAngle * (this.speed / t.maxSpeed) * steerSpeed;
      this.rotation += turnRate * delta;
    }

    // Apply friction
    this.speed *= friction;

    // Movement
    const moveX = Math.sin(this.rotation) * this.speed * delta;
    const moveZ = Math.cos(this.rotation) * this.speed * delta;

    const newX = this.position.x + moveX;
    const newZ = this.position.z + moveZ;

    // Collision check
    const collision = physics.checkCollision(newX, newZ, Math.max(t.bodyW, t.bodyD) / 2, this.mesh);
    if (collision) {
      this.speed *= -0.3;
      this.takeDamage(Math.abs(this.speed) * 2);
    } else {
      this.position.x = newX;
      this.position.z = newZ;
    }

    // World bounds
    const hw = 950;
    this.position.x = clamp(this.position.x, -hw, hw);
    this.position.z = clamp(this.position.z, -hw, hw);
  }

  takeDamage(amount: number) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isDestroyed = true;
    }
  }

  setHeadlightsOn(on: boolean) {
    for (const hl of this.headLights) {
      const mat = (hl as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = on ? 2.0 : 0.5;
      }
    }
  }

  getSpeedKmh(): number {
    return Math.abs(this.speed) * 3.6;
  }
}

export class VehicleSpawner {
  static spawnTrafficVehicles(scene: THREE.Scene, physics: Physics, world: any): Vehicle[] {
    const vehicles: Vehicle[] = [];
    const types = Object.values(VEHICLE_TYPES);

    for (let i = 0; i < 25; i++) {
      const type = randomChoice(types);
      const roadPos = world.getNearestRoadPosition(
        (Math.random() - 0.5) * 1600,
        (Math.random() - 0.5) * 1600
      );
      const rotation = roadPos.direction === 'ns' ? 0 : Math.PI / 2;
      const v = new Vehicle(type, roadPos.x, roadPos.z, rotation);
      v.addToScene(scene, physics);
      vehicles.push(v);
    }

    return vehicles;
  }
}
