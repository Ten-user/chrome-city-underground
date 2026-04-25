import * as THREE from 'three';
import { InputManager } from './Input';
import { Physics } from './Physics';
import { World } from './World';
import { Player } from './Player';
import { Vehicle, VehicleSpawner, VEHICLE_TYPES } from './Vehicle';
import { Combat } from './Combat';
import { AISystem } from './AI';
import { PoliceSystem } from './Police';
import { Weather } from './Weather';
import { MissionSystem } from './Mission';
import { HUD } from './HUD';
import { distance2D, clamp } from './Utils';

export class GameEngine {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  clock!: THREE.Clock;
  input!: InputManager;
  physics!: Physics;
  world!: World;
  player!: Player;
  vehicles: Vehicle[] = [];
  combat!: Combat;
  ai!: AISystem;
  police!: PoliceSystem;
  weather!: Weather;
  missions!: MissionSystem;
  hud!: HUD;

  isRunning = false;
  isPaused = false;
  private animFrameId = 0;
  private canvas!: HTMLCanvasElement;
  private prevShootState = false;
  private wasNight = false;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Ensure canvas has proper dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Clock
    this.clock = new THREE.Clock();

    // Input
    this.input = new InputManager();
    this.input.init(canvas);

    // Physics
    this.physics = new Physics();

    // World
    this.world = new World(this.scene, this.physics);
    this.world.generate();

    // Player
    const spawn = this.world.getSpawnPoint();
    this.player = new Player(this.camera);
    this.player.position.set(spawn.x, 0, spawn.z);
    this.player.mesh.position.copy(this.player.position);
    this.scene.add(this.player.mesh);

    // Set initial camera position
    this.camera.position.set(spawn.x, 5, spawn.z + 10);
    this.camera.lookAt(spawn.x, 1.5, spawn.z);

    // Create safe house marker at spawn
    this.createSafeHouseMarker(spawn.x, spawn.z);

    // Vehicles
    this.vehicles = VehicleSpawner.spawnTrafficVehicles(this.scene, this.physics, this.world);

    // Combat
    this.combat = new Combat(this.scene, this.physics);

    // AI
    this.ai = new AISystem(this.scene, this.physics);
    this.ai.spawnEnemies();
    this.ai.spawnCivilians();

    // Police
    this.police = new PoliceSystem(this.ai);

    // Weather
    this.weather = new Weather(this.scene);

    // Missions
    this.missions = new MissionSystem(this.scene);

    // HUD
    this.hud = new HUD();

    // Window resize
    window.addEventListener('resize', this.onResize);

    // Prevent context menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.isRunning = true;
    this.gameLoop();
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private gameLoop = () => {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(this.gameLoop);

    const delta = Math.min(this.clock.getDelta(), 0.05);

    if (!this.isPaused) {
      this.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  };

  update(delta: number) {
    // Input
    this.input.update();

    // Weather
    this.weather.update(delta, this.player.getPosition());

    // Player
    this.player.update(delta, this.input, this.physics);

    // Vehicle interaction
    this.handleVehicleInteraction();

    // Vehicles
    for (const v of this.vehicles) {
      const vInput = v.isOccupied ? this.input : null;
      v.update(delta, vInput, this.physics, this.weather.getRainFactor());
      v.setHeadlightsOn(this.weather.isNight());
    }

    // Combat
    this.handleCombat(delta);
    this.combat.update(delta);

    // AI
    this.ai.update(delta, this.player.getPosition(), this.player.isInVehicle, Math.abs(this.player.isInVehicle ? (this.player.currentVehicle?.speed || 0) : 0));

    // Enemy shooting
    this.handleEnemyShooting(delta);

    // Police
    this.police.update(delta, this.player.getPosition(), Math.abs(this.player.isInVehicle ? (this.player.currentVehicle?.speed || 0) : 0));

    // Missions
    this.handleMissions(delta);

    // Weapon pickups
    const pickup = this.combat.checkPickup(this.player.getPosition());
    if (pickup) {
      this.combat.addWeapon(pickup);
    }

    // Day/night world updates (only when state changes)
    const isNight = this.weather.isNight();
    if (isNight !== this.wasNight) {
      this.wasNight = isNight;
      this.world.setNightMode(isNight);
    }

    // HUD
    this.hud.updateDamageFlash(delta);
    this.updateHUD();

    // Player death
    if (this.player.isDead) {
      // Auto respawn after 3 seconds
      if (!this.playerRespawnTimer) this.playerRespawnTimer = 3;
      this.playerRespawnTimer -= delta;
      if (this.playerRespawnTimer <= 0) {
        this.player.respawn();
        this.playerRespawnTimer = 0;
        this.police.clearWanted();
        // Exit vehicle if dead in one
        if (this.player.isInVehicle && this.player.currentVehicle) {
          this.player.currentVehicle.isOccupied = false;
          this.player.currentVehicle.driver = null;
          this.player.isInVehicle = false;
          this.player.currentVehicle = null;
          this.scene.add(this.player.mesh);
        }
      }
    }

    // Slow heal when not in combat
    if (!this.player.isDead && this.player.health < this.player.maxHealth) {
      const nearbyEnemies = this.ai.entities.filter(e => 
        e.state !== 'dead' && e.isEnemy && 
        distance2D(e.position.x, e.position.z, this.player.getPosition().x, this.player.getPosition().z) < 30
      );
      if (nearbyEnemies.length === 0) {
        this.player.heal(delta * 2);
      }
    }

    // Help toggle
    if (this.input.state.help) {
      this.hud.toggleHelp();
    }

    // View toggle
    if (this.input.state.switchView) {
      this.player.toggleView();
    }

    // Vehicle speed - run over enemies/civilians
    if (this.player.isInVehicle && this.player.currentVehicle) {
      const v = this.player.currentVehicle;
      if (Math.abs(v.speed) > 10) {
        this.checkVehicleRunOver(v);
      }
    }
  }

  private playerRespawnTimer = 0;

  private createSafeHouseMarker(x: number, z: number) {
    // Safe house visual indicator
    const markerGeo = new THREE.CylinderGeometry(2, 2, 0.2, 16);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.6,
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(x, 0.15, z);
    this.scene.add(marker);

    // Safe house building
    const houseGeo = new THREE.BoxGeometry(8, 5, 8);
    const houseMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.6 });
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.set(x, 2.5, z);
    house.castShadow = true;
    house.receiveShadow = true;
    this.scene.add(house);

    // Door
    const doorGeo = new THREE.BoxGeometry(2, 3, 0.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x00aa55, emissive: 0x00aa55, emissiveIntensity: 0.3 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(x, 1.5, z + 4.1);
    this.scene.add(door);

    // Add collider for safe house
    this.physics.addCollider({
      aabb: { minX: x - 4, minZ: z - 4, maxX: x + 4, maxZ: z + 4 },
      height: 5,
      type: 'building',
      mesh: house,
    });
  }

  private handleVehicleInteraction() {
    if (!this.input.state.enterVehicle) return;

    if (this.player.isInVehicle) {
      // Exit vehicle
      this.player.isInVehicle = false;
      this.player.currentVehicle.isOccupied = false;
      this.player.currentVehicle.driver = null;
      const vPos = this.player.currentVehicle.position;
      this.player.position.set(vPos.x + 3, 0, vPos.z + 3);
      this.player.mesh.position.copy(this.player.position);
      this.player.currentVehicle = null;
      this.scene.add(this.player.mesh);
    } else {
      // Find nearest vehicle
      const nearest = this.ai.getNearestVehicle(this.player.position.x, this.player.position.z, this.vehicles);
      if (nearest) {
        this.player.isInVehicle = true;
        this.player.currentVehicle = nearest;
        nearest.isOccupied = true;
        nearest.driver = this.player;
        this.scene.remove(this.player.mesh);
      }
    }
  }

  private handleCombat(delta: number) {
    if (this.player.isDead || this.player.isInVehicle) return;

    // Weapon switching
    if (this.input.state.tab) {
      this.combat.nextWeapon();
    }
    for (const num of this.input.state.numberKeys) {
      this.combat.switchWeapon(num - 1);
    }

    // Reload
    if (this.input.state.reload) {
      this.combat.startReload();
    }

    // Shooting
    if (this.input.state.shoot && this.player.canShoot()) {
      const weapon = this.combat.getCurrentWeapon();
      if (weapon.automatic || !this.prevShootState) {
        const origin = this.player.getShootOrigin();
        const direction = this.player.getShootDirection();
        const result = this.combat.shoot(origin, direction, this.player.position);

        if (result?.hit && result.hitCollider) {
          // Check if we hit an enemy
          const hitEntity = this.ai.entities.find(e =>
            e.collider === result.hitCollider || e.mesh === result.hitCollider.mesh
          );
          if (hitEntity && hitEntity.state !== 'dead') {
            const killed = this.ai.damageEntity(hitEntity, weapon.damage * this.player.shootingSkill);
            this.ai.alertNearbyEnemies(hitEntity.position.x, hitEntity.position.z, 40);
            this.ai.makeCiviliansFlee(hitEntity.position.x, hitEntity.position.z, 30);

            if (killed) {
              this.missions.onEnemyKilled(hitEntity.position.x, hitEntity.position.z);
              this.player.addMoney(hitEntity.type === 'boss' ? 500 : hitEntity.type === 'elite' ? 200 : 50);
              this.player.shootingSkill = Math.min(3, this.player.shootingSkill + 0.01);
            }

            // Crime
            if (hitEntity.type === 'civilian') {
              this.police.onPlayerCrime('hit_civilian');
            } else if (hitEntity.type === 'police') {
              this.police.onPlayerCrime('hit_police');
            } else {
              this.police.onPlayerCrime('shooting');
            }
          }
        }

        this.player.setShootCooldown(1 / weapon.fireRate);
      }
    }

    this.prevShootState = this.input.state.shoot;
  }

  private handleEnemyShooting(delta: number) {
    for (const entity of this.ai.entities) {
      if (entity.state === 'dead' || entity.type === 'civilian') continue;

      const dist = distance2D(
        entity.position.x, entity.position.z,
        this.player.getPosition().x, this.player.getPosition().z
      );

      if (entity.state === 'attack' && dist < entity.attackRange) {
        entity.shootTimer -= delta;
        if (entity.shootTimer <= 0) {
          entity.shootTimer = 1 / entity.fireRate;

          // Hit chance based on distance
          const hitChance = clamp(1 - dist / entity.attackRange * 0.5, 0.1, 0.6);
          if (Math.random() < hitChance) {
            this.player.takeDamage(entity.damage);
            this.hud.showDamage();
          }

          // Muzzle flash at enemy position
          const flash = new THREE.PointLight(0xffaa44, 20, 5);
          flash.position.set(entity.position.x, entity.position.y + 1.5, entity.position.z);
          this.scene.add(flash);
          setTimeout(() => this.scene.remove(flash), 50);
        }
      }
    }
  }

  private handleMissions(delta: number) {
    const playerPos = this.player.getPosition();
    const result = this.missions.update(delta, playerPos.x, playerPos.z);

    if (result?.missionComplete) {
      this.player.addMoney(result.reward);
    }

    // Check for mission start
    if (this.input.state.interact) {
      const nearby = this.missions.getNearbyMission(playerPos.x, playerPos.z);
      if (nearby) {
        this.missions.startMission(nearby.id);
      }
    }
  }

  private checkVehicleRunOver(v: Vehicle) {
    for (const entity of this.ai.entities) {
      if (entity.state === 'dead') continue;
      const dist = distance2D(v.position.x, v.position.z, entity.position.x, entity.position.z);
      if (dist < 3) {
        this.ai.damageEntity(entity, Math.abs(v.speed) * 2);
        if (entity.type === 'civilian') {
          this.police.onPlayerCrime('hit_civilian');
        }
      }
    }
  }

  private updateHUD() {
    const playerPos = this.player.getPosition();

    this.hud.update({
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      armor: this.player.armor,
      maxArmor: this.player.maxArmor,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      wantedLevel: this.police.getWantedLevel(),
      weaponName: this.combat.getCurrentWeapon().name,
      ammo: this.combat.getAmmoCount(),
      maxAmmo: this.combat.getMaxAmmo(),
      isReloading: this.combat.isReloading,
      isInVehicle: this.player.isInVehicle,
      speed: this.player.isInVehicle && this.player.currentVehicle ? this.player.currentVehicle.getSpeedKmh() : 0,
      nitrous: this.player.isInVehicle && this.player.currentVehicle ? this.player.currentVehicle.nitrous : 0,
      nitrousMax: this.player.isInVehicle && this.player.currentVehicle ? this.player.currentVehicle.type.nitrousMax : 100,
      money: this.player.money,
      objective: this.missions.getCurrentObjective()?.description || null,
      missionPrompt: this.missions.getNearbyMission(playerPos.x, playerPos.z)
        ? `Press F: ${this.missions.getNearbyMission(playerPos.x, playerPos.z)!.name}`
        : null,
      playerX: playerPos.x,
      playerZ: playerPos.z,
      playerRotation: this.player.yaw,
      enemies: this.ai.entities
        .filter(e => e.state !== 'dead' && e.isEnemy)
        .map(e => ({ x: e.position.x, z: e.position.z, type: e.type })),
      vehicles: this.vehicles
        .filter(v => !v.isOccupied && !v.isDestroyed && distance2D(v.position.x, v.position.z, playerPos.x, playerPos.z) < 10)
        .map(v => ({ x: v.position.x, z: v.position.z })),
      missionMarkers: this.missions.missions
        .filter(m => !m.isComplete)
        .map(m => ({ x: m.startX, z: m.startZ, color: `#${m.color.toString(16).padStart(6, '0')}` })),
      isDead: this.player.isDead,
      isNight: this.weather.isNight(),
    });
  }

  destroy() {
    this.isRunning = false;
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    this.input.destroy();
    this.hud.destroy();
    this.renderer.dispose();
  }
}
