import * as THREE from 'three';
import { InputManager } from './Input';
import { Physics } from './Physics';
import { clamp, lerp, smoothDamp } from './Utils';

export class Player {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3 = new THREE.Vector3();
  rotation: number = 0;
  pitch: number = 0;
  yaw: number = 0;
  camera: THREE.PerspectiveCamera;
  isFirstPerson = false;

  health = 100;
  maxHealth = 100;
  armor = 0;
  maxArmor = 100;
  money = 500;

  // Stats
  shootingSkill = 1;
  drivingSkill = 1;
  stamina = 100;
  maxStamina = 100;
  stealth = 1;

  // State
  isOnGround = true;
  isSprinting = false;
  isCrouching = false;
  isInVehicle = false;
  currentVehicle: any = null;
  isDead = false;

  // Internal
  private walkSpeed = 8;
  private sprintSpeed = 14;
  private crouchSpeed = 4;
  private jumpForce = 10;
  private gravity = 25;
  private cameraDistance = 6;
  private cameraHeight = 3;
  private cameraSmoothVelocityX = { value: 0 };
  private cameraSmoothVelocityY = { value: 0 };
  private cameraSmoothVelocityZ = { value: 0 };
  private bobTimer = 0;
  private shootCooldown = 0;

  // Body parts
  private body!: THREE.Mesh;
  private head!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.position = new THREE.Vector3(30, 0, 30);
    this.mesh = new THREE.Group();
    this.createBody();
    this.mesh.position.copy(this.position);
  }

  private createBody() {
    const skinColor = 0x8B6914;
    const shirtColor = 0x1a1a2e;
    const pantsColor = 0x2a2a3a;

    // Body (torso)
    this.body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.0, 0.5),
      new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 })
    );
    this.body.position.y = 1.5;
    this.body.castShadow = true;
    this.mesh.add(this.body);

    // Head
    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 10, 10),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 })
    );
    this.head.position.y = 2.25;
    this.head.castShadow = true;
    this.mesh.add(this.head);

    // Left Arm
    this.leftArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.8, 0.25),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 })
    );
    this.leftArm.position.set(-0.55, 1.5, 0);
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    // Right Arm
    this.rightArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.8, 0.25),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 })
    );
    this.rightArm.position.set(0.55, 1.5, 0);
    this.rightArm.castShadow = true;
    this.mesh.add(this.rightArm);

    // Left Leg
    this.leftLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.9, 0.3),
      new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 })
    );
    this.leftLeg.position.set(-0.2, 0.45, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    // Right Leg
    this.rightLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.9, 0.3),
      new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 })
    );
    this.rightLeg.position.set(0.2, 0.45, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    // Player glow ring (for visibility)
    const ringGeo = new THREE.RingGeometry(0.6, 0.8, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.mesh.add(ring);
  }

  update(delta: number, input: InputManager, physics: Physics) {
    if (this.isDead) return;

    // Always consume mouse delta to prevent accumulation
    const mouseDelta = input.consumeMouseDelta();

    if (this.isInVehicle) {
      this.yaw -= mouseDelta.dx * 0.002;
      this.pitch -= mouseDelta.dy * 0.002;
      this.pitch = clamp(this.pitch, -Math.PI / 3, Math.PI / 3);
      this.updateVehicleCamera(delta);
      return;
    }

    // Camera rotation
    this.yaw -= mouseDelta.dx * 0.002;
    this.pitch -= mouseDelta.dy * 0.002;
    this.pitch = clamp(this.pitch, -Math.PI / 3, Math.PI / 3);

    // Movement direction
    const moveDir = new THREE.Vector3(0, 0, 0);
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    if (input.state.forward) moveDir.add(forward);
    if (input.state.backward) moveDir.sub(forward);
    if (input.state.left) moveDir.sub(right);
    if (input.state.right) moveDir.add(right);

    if (moveDir.length() > 0) moveDir.normalize();

    // Speed
    this.isSprinting = input.state.sprint && moveDir.length() > 0;
    this.isCrouching = input.state.crouch;

    let speed = this.walkSpeed;
    if (this.isSprinting) {
      speed = this.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - delta * 15);
      if (this.stamina <= 0) {
        speed = this.walkSpeed;
        this.isSprinting = false;
      }
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + delta * 8);
    }
    if (this.isCrouching) speed = this.crouchSpeed;

    // Apply movement
    this.velocity.x = moveDir.x * speed;
    this.velocity.z = moveDir.z * speed;

    // Jump
    if (input.state.jump && this.isOnGround) {
      this.velocity.y = this.jumpForce;
      this.isOnGround = false;
    }

    // Gravity
    if (!this.isOnGround) {
      this.velocity.y -= this.gravity * delta;
    }

    // Update position
    const newX = this.position.x + this.velocity.x * delta;
    const newZ = this.position.z + this.velocity.z * delta;
    const newY = this.position.y + this.velocity.y * delta;

    // Collision
    const resolved = physics.resolveCollision(newX, newZ, 0.5);
    this.position.x = resolved.x;
    this.position.z = resolved.z;
    this.position.y = Math.max(0, newY);

    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.isOnGround = true;
    }

    // Rotation
    if (moveDir.length() > 0.1) {
      this.rotation = Math.atan2(moveDir.x, moveDir.z);
    }

    // Update mesh
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;

    // Walking animation
    if (moveDir.length() > 0.1) {
      const animSpeed = this.isSprinting ? 12 : 6;
      this.bobTimer += delta * animSpeed;
      const bob = Math.sin(this.bobTimer) * 0.1;
      this.mesh.position.y += Math.abs(bob);

      // Leg animation
      this.leftLeg.rotation.x = Math.sin(this.bobTimer) * 0.5;
      this.rightLeg.rotation.x = -Math.sin(this.bobTimer) * 0.5;
      this.leftArm.rotation.x = -Math.sin(this.bobTimer) * 0.3;
      this.rightArm.rotation.x = Math.sin(this.bobTimer) * 0.3;
    } else {
      this.bobTimer = 0;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
    }

    // Crouch
    if (this.isCrouching) {
      this.body.scale.y = 0.7;
      this.head.position.y = 1.9;
    } else {
      this.body.scale.y = 1;
      this.head.position.y = 2.25;
    }

    // Camera
    this.updateCamera(delta);

    // Shoot cooldown
    if (this.shootCooldown > 0) this.shootCooldown -= delta;
  }

  private updateCamera(delta: number) {
    if (this.isFirstPerson) {
      this.camera.position.set(
        this.position.x,
        this.position.y + 2.1,
        this.position.z
      );
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.mesh.visible = false;
    } else {
      this.mesh.visible = true;
      const camX = this.position.x + Math.sin(this.yaw) * this.cameraDistance * Math.cos(this.pitch);
      const camY = this.position.y + this.cameraHeight + Math.sin(this.pitch) * this.cameraDistance;
      const camZ = this.position.z + Math.cos(this.yaw) * this.cameraDistance * Math.cos(this.pitch);

      this.camera.position.x = smoothDamp(this.camera.position.x, camX, this.cameraSmoothVelocityX, 0.1, delta);
      this.camera.position.y = smoothDamp(this.camera.position.y, camY, this.cameraSmoothVelocityY, 0.1, delta);
      this.camera.position.z = smoothDamp(this.camera.position.z, camZ, this.cameraSmoothVelocityZ, 0.1, delta);

      this.camera.lookAt(this.position.x, this.position.y + 1.5, this.position.z);
    }
  }

  private updateVehicleCamera(delta: number) {
    if (!this.currentVehicle) return;
    const v = this.currentVehicle;
    const behindDist = 10;
    const heightOffset = 4;

    const camX = v.mesh.position.x - Math.sin(v.rotation) * behindDist;
    const camY = v.mesh.position.y + heightOffset;
    const camZ = v.mesh.position.z - Math.cos(v.rotation) * behindDist;

    this.camera.position.x = lerp(this.camera.position.x, camX, delta * 5);
    this.camera.position.y = lerp(this.camera.position.y, camY, delta * 5);
    this.camera.position.z = lerp(this.camera.position.z, camZ, delta * 5);

    this.camera.lookAt(v.mesh.position.x, v.mesh.position.y + 1, v.mesh.position.z);
    this.mesh.visible = false;
  }

  takeDamage(amount: number) {
    if (this.armor > 0) {
      const armorDamage = Math.min(this.armor, amount * 0.7);
      this.armor -= armorDamage;
      amount -= armorDamage;
    }
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
    }
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addArmor(amount: number) {
    this.armor = Math.min(this.maxArmor, this.armor + amount);
  }

  addMoney(amount: number) {
    this.money += amount;
  }

  respawn() {
    this.health = this.maxHealth;
    this.armor = 0;
    this.isDead = false;
    this.position.set(40, 0, 40);
    this.velocity.set(0, 0, 0);
    this.mesh.position.copy(this.position);
  }

  toggleView() {
    this.isFirstPerson = !this.isFirstPerson;
  }

  getPosition(): THREE.Vector3 {
    if (this.isInVehicle && this.currentVehicle) {
      return this.currentVehicle.mesh.position.clone();
    }
    return this.position.clone();
  }

  getForward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  getShootOrigin(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.position.y + 1.8, this.position.z);
  }

  getShootDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir.normalize();
  }

  canShoot(): boolean {
    return this.shootCooldown <= 0 && !this.isDead;
  }

  setShootCooldown(time: number) {
    this.shootCooldown = time;
  }
}
