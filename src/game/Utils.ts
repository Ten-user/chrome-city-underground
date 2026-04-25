import * as THREE from 'three';

export const NEON_GREEN = 0x00ff88;
export const NEON_ORANGE = 0xff6600;
export const NEON_PURPLE = 0x8800ff;
export const WORLD_SIZE = 2000;
export const HALF_WORLD = WORLD_SIZE / 2;

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function distance2D(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

export function angleBetween(x1: number, z1: number, x2: number, z2: number): number {
  return Math.atan2(x2 - x1, z2 - z1);
}

export function smoothDamp(current: number, target: number, velocity: { value: number }, smoothTime: number, dt: number, maxSpeed = Infinity): number {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const maxChange = maxSpeed * smoothTime;
  change = clamp(change, -maxChange, maxChange);
  const temp = (velocity.value + omega * change) * dt;
  velocity.value = (velocity.value - omega * temp) * exp;
  return target + (change + temp) * exp;
}

export function createBoxMesh(
  w: number, h: number, d: number,
  color: number,
  x: number, y: number, z: number,
  castShadow = true,
  receiveShadow = true
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

export function createCylinderMesh(
  radiusTop: number, radiusBottom: number, height: number,
  color: number,
  x: number, y: number, z: number,
  segments = 8
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createSphereMesh(
  radius: number, color: number,
  x: number, y: number, z: number,
  segments = 16
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, segments, segments);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function formatMoney(amount: number): string {
  return '$' + amount.toLocaleString();
}

export function formatSpeed(unitsPerSec: number): string {
  return Math.round(unitsPerSec * 3.6).toString() + ' km/h';
}

export interface AABB {
  minX: number; minZ: number;
  maxX: number; maxZ: number;
}

export function pointInAABB(x: number, z: number, box: AABB): boolean {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

export function worldToDistrict(x: number, z: number): string {
  const cx = x + HALF_WORLD;
  const cz = z + HALF_WORLD;
  if (cx < WORLD_SIZE * 0.35 && cz < WORLD_SIZE * 0.35) return 'downtown';
  if (cx > WORLD_SIZE * 0.65 && cz > WORLD_SIZE * 0.65) return 'industrial';
  if (cx > WORLD_SIZE * 0.85 || cz > WORLD_SIZE * 0.85 || cx < WORLD_SIZE * 0.15 || cz < WORLD_SIZE * 0.15) return 'rural';
  return 'suburban';
}
