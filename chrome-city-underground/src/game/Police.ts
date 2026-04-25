import * as THREE from 'three';
import { AISystem } from './AI';
import { distance2D, clamp } from './Utils';

export class PoliceSystem {
  ai: AISystem;
  wantedLevel = 0;
  wantedTimer = 0;
  decayTimer = 0;
  private maxWanted = 5;
  private policeSpawnRadius = 100;
  private isBribing = false;
  private inSafehouse = false;

  constructor(ai: AISystem) {
    this.ai = ai;
  }

  addWantedLevel(amount: number) {
    this.wantedLevel = clamp(this.wantedLevel + amount, 0, this.maxWanted);
    this.decayTimer = 0;
  }

  removeWantedLevel(amount: number) {
    this.wantedLevel = clamp(this.wantedLevel - amount, 0, this.maxWanted);
  }

  clearWanted() {
    this.wantedLevel = 0;
    this.decayTimer = 0;
    this.ai.clearPolice();
  }

  setInSafehouse(inSafehouse: boolean) {
    this.inSafehouse = inSafehouse;
  }

  update(delta: number, playerPos: THREE.Vector3, playerSpeed: number) {
    if (this.wantedLevel === 0) {
      this.ai.clearPolice();
      return;
    }

    // Spawn police based on wanted level
    this.wantedTimer -= delta;
    if (this.wantedTimer <= 0) {
      this.spawnPoliceForLevel(playerPos);
      this.wantedTimer = Math.max(5, 15 - this.wantedLevel * 2);
    }

    // Decay wanted level if player is fast and far from police
    const nearbyPolice = this.ai.getEntitiesInRange(playerPos.x, playerPos.z, 50)
      .filter(e => e.type === 'police');

    if (nearbyPolice.length === 0) {
      this.decayTimer += delta;
      if (this.decayTimer > 30 - this.wantedLevel * 4) {
        this.removeWantedLevel(1);
        this.decayTimer = 0;
      }
    } else {
      this.decayTimer = 0;
    }

    // In safehouse
    if (this.inSafehouse) {
      this.decayTimer += delta * 3;
      if (this.decayTimer > 10) {
        this.removeWantedLevel(1);
        this.decayTimer = 0;
      }
    }

    // Make police chase
    for (const entity of this.ai.entities) {
      if (entity.type !== 'police' || entity.state === 'dead') continue;
      const dist = distance2D(entity.position.x, entity.position.z, playerPos.x, playerPos.z);

      if (dist < entity.alertRange) {
        entity.state = 'chase';
      }
    }
  }

  private spawnPoliceForLevel(playerPos: THREE.Vector3) {
    const policeCount = this.wantedLevel * 2;
    const currentPolice = this.ai.entities.filter(e => e.type === 'police' && e.state !== 'dead').length;

    const toSpawn = Math.max(0, policeCount - currentPolice);
    for (let i = 0; i < toSpawn; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = this.policeSpawnRadius + Math.random() * 50;
      const x = playerPos.x + Math.cos(angle) * dist;
      const z = playerPos.z + Math.sin(angle) * dist;

      const entity = this.ai.spawnPolice(x, z);

      // Scale police based on wanted level
      if (this.wantedLevel >= 4) {
        entity.health = 120;
        entity.maxHealth = 120;
        entity.damage = 18;
        entity.weapon = 'assault';
        entity.fireRate = 5;
      } else if (this.wantedLevel >= 3) {
        entity.health = 100;
        entity.maxHealth = 100;
        entity.damage = 14;
        entity.weapon = 'smg';
        entity.fireRate = 4;
      }

      entity.state = 'chase';
    }
  }

  onPlayerCrime(crimeType: 'shooting' | 'stealing' | 'destruction' | 'hit_civilian' | 'hit_police' | 'restricted_area') {
    switch (crimeType) {
      case 'shooting':
        this.addWantedLevel(1);
        break;
      case 'stealing':
        this.addWantedLevel(1);
        break;
      case 'destruction':
        this.addWantedLevel(1);
        break;
      case 'hit_civilian':
        this.addWantedLevel(1);
        break;
      case 'hit_police':
        this.addWantedLevel(2);
        break;
      case 'restricted_area':
        this.addWantedLevel(2);
        break;
    }
  }

  getWantedLevel(): number {
    return this.wantedLevel;
  }

  isWanted(): boolean {
    return this.wantedLevel > 0;
  }
}
