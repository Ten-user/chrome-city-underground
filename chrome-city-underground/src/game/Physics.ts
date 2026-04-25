import * as THREE from 'three';
import { AABB, clamp, HALF_WORLD } from './Utils';

export interface Collider {
  aabb: AABB;
  height: number;
  type: 'building' | 'vehicle' | 'tree' | 'wall' | 'container';
  mesh?: THREE.Object3D;
}

export class Physics {
  colliders: Collider[] = [];
  private raycaster = new THREE.Raycaster();

  addCollider(collider: Collider) {
    this.colliders.push(collider);
  }

  removeCollider(mesh: THREE.Object3D) {
    this.colliders = this.colliders.filter(c => c.mesh !== mesh);
  }

  clear() {
    this.colliders = [];
  }

  checkCollision(x: number, z: number, radius: number, excludeMesh?: THREE.Object3D): Collider | null {
    for (const c of this.colliders) {
      if (c.mesh === excludeMesh) continue;
      const closestX = clamp(x, c.aabb.minX, c.aabb.maxX);
      const closestZ = clamp(z, c.aabb.minZ, c.aabb.maxZ);
      const dx = x - closestX;
      const dz = z - closestZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < radius) {
        return c;
      }
    }
    return null;
  }

  resolveCollision(x: number, z: number, radius: number, excludeMesh?: THREE.Object3D): { x: number; z: number } {
    let resolvedX = x;
    let resolvedZ = z;

    for (const c of this.colliders) {
      if (c.mesh === excludeMesh) continue;
      const closestX = clamp(resolvedX, c.aabb.minX, c.aabb.maxX);
      const closestZ = clamp(resolvedZ, c.aabb.minZ, c.aabb.maxZ);
      const dx = resolvedX - closestX;
      const dz = resolvedZ - closestZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < radius && dist > 0.001) {
        const overlap = radius - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        resolvedX += nx * overlap;
        resolvedZ += nz * overlap;
      } else if (dist < 0.001) {
        const pushDist = radius + 0.1;
        const cx = (c.aabb.minX + c.aabb.maxX) / 2;
        const cz = (c.aabb.minZ + c.aabb.maxZ) / 2;
        const pdx = resolvedX - cx;
        const pdz = resolvedZ - cz;
        const pd = Math.sqrt(pdx * pdx + pdz * pdz);
        if (pd > 0.001) {
          resolvedX += (pdx / pd) * pushDist;
          resolvedZ += (pdz / pd) * pushDist;
        } else {
          resolvedX += pushDist;
        }
      }
    }

    // World bounds
    resolvedX = clamp(resolvedX, -HALF_WORLD + radius, HALF_WORLD - radius);
    resolvedZ = clamp(resolvedZ, -HALF_WORLD + radius, HALF_WORLD - radius);

    return { x: resolvedX, z: resolvedZ };
  }

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): { point: THREE.Vector3; collider: Collider } | null {
    let closest: { point: THREE.Vector3; collider: Collider; dist: number } | null = null;

    for (const c of this.colliders) {
      const cx = (c.aabb.minX + c.aabb.maxX) / 2;
      const cz = (c.aabb.minZ + c.aabb.maxZ) / 2;
      const halfW = (c.aabb.maxX - c.aabb.minX) / 2;
      const halfD = (c.aabb.maxZ - c.aabb.minZ) / 2;
      const cy = c.height / 2;
      const halfH = c.height / 2;

      const boxMin = new THREE.Vector3(cx - halfW, cy - halfH, cz - halfD);
      const boxMax = new THREE.Vector3(cx + halfW, cy + halfH, cz + halfD);
      const box = new THREE.Box3(boxMin, boxMax);

      this.raycaster.set(origin, direction);
      this.raycaster.far = maxDistance;
      const intersection = this.raycaster.ray.intersectBox(box, new THREE.Vector3());

      if (intersection) {
        const dist = intersection.distanceTo(origin);
        if (dist > 0.5 && (!closest || dist < closest.dist)) {
          closest = { point: intersection, collider: c, dist };
        }
      }
    }

    return closest ? { point: closest.point, collider: closest.collider } : null;
  }

  getGroundHeight(x: number, _z: number): number {
    // Simple ground - everything at y=0 unless on a road
    // Could be extended for terrain
    return 0;
  }

  getCollidersInRange(x: number, z: number, range: number): Collider[] {
    return this.colliders.filter(c => {
      const cx = (c.aabb.minX + c.aabb.maxX) / 2;
      const cz = (c.aabb.minZ + c.aabb.maxZ) / 2;
      const dx = x - cx;
      const dz = z - cz;
      return Math.sqrt(dx * dx + dz * dz) < range;
    });
  }
}
