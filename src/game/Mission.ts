import * as THREE from 'three';
import { distance2D, NEON_GREEN, NEON_ORANGE, NEON_PURPLE } from './Utils';

export interface Mission {
  id: string;
  name: string;
  description: string;
  type: 'story' | 'combat' | 'race' | 'side';
  color: number;
  startX: number;
  startZ: number;
  objectives: Objective[];
  currentObjective: number;
  isComplete: boolean;
  isActive: boolean;
  reward: number;
  requiredMission?: string;
}

export interface Objective {
  type: 'go_to' | 'kill' | 'collect' | 'escape' | 'race_checkpoint' | 'survive';
  description: string;
  targetX: number;
  targetZ: number;
  targetRadius: number;
  killCount?: number;
  currentCount?: number;
  timeLimit?: number;
  timeRemaining?: number;
}

export class MissionSystem {
  missions: Mission[] = [];
  activeMission: Mission | null = null;
  missionMarkers: { mesh: THREE.Mesh; missionId: string }[] = [];
  private scene: THREE.Scene;
  private showPrompt = false;
  promptText = '';
  private objectiveCompleteTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createMissions();
    this.createMarkers();
  }

  private createMissions() {
    this.missions = [
      {
        id: 'tutorial',
        name: 'The Arrival',
        description: 'Drive to your safe house and learn the controls.',
        type: 'story',
        color: NEON_GREEN,
        startX: 50, startZ: 50,
        objectives: [
          { type: 'go_to', description: 'Go to your safe house', targetX: 100, targetZ: 100, targetRadius: 10 },
          { type: 'go_to', description: 'Check out the neighborhood', targetX: -50, targetZ: 50, targetRadius: 10 },
        ],
        currentObjective: 0,
        isComplete: false,
        isActive: false,
        reward: 200,
      },
      {
        id: 'first_job',
        name: 'First Job',
        description: 'Pick up a package and deliver it across town.',
        type: 'story',
        color: NEON_ORANGE,
        startX: -100, startZ: 100,
        objectives: [
          { type: 'go_to', description: 'Pick up the package', targetX: -200, targetZ: 200, targetRadius: 8 },
          { type: 'go_to', description: 'Deliver to the drop point', targetX: 300, targetZ: -200, targetRadius: 8 },
          { type: 'escape', description: 'Escape the area!', targetX: 400, targetZ: 300, targetRadius: 15 },
        ],
        currentObjective: 0,
        isComplete: false,
        isActive: false,
        reward: 500,
        requiredMission: 'tutorial',
      },
      {
        id: 'street_race',
        name: 'Street Race',
        description: 'Win a race through the city streets.',
        type: 'race',
        color: NEON_GREEN,
        startX: 200, startZ: 0,
        objectives: [
          { type: 'race_checkpoint', description: 'Checkpoint 1', targetX: 300, targetZ: 200, targetRadius: 15 },
          { type: 'race_checkpoint', description: 'Checkpoint 2', targetX: 0, targetZ: 300, targetRadius: 15 },
          { type: 'race_checkpoint', description: 'Checkpoint 3', targetX: -200, targetZ: 0, targetRadius: 15 },
          { type: 'race_checkpoint', description: 'Finish Line', targetX: 200, targetZ: 0, targetRadius: 15 },
        ],
        currentObjective: 0,
        isComplete: false,
        isActive: false,
        reward: 800,
      },
      {
        id: 'gang_turf',
        name: 'Gang Turf',
        description: 'Clear out the enemy gang from this territory.',
        type: 'combat',
        color: 0xff0000,
        startX: -300, startZ: -300,
        objectives: [
          { type: 'kill', description: 'Eliminate gang members', targetX: -300, targetZ: -300, targetRadius: 80, killCount: 6, currentCount: 0 },
          { type: 'go_to', description: 'Claim the territory', targetX: -300, targetZ: -300, targetRadius: 5 },
        ],
        currentObjective: 0,
        isComplete: false,
        isActive: false,
        reward: 1000,
        requiredMission: 'first_job',
      },
      {
        id: 'the_heist',
        name: 'The Heist',
        description: 'Rob the bank and escape from the police!',
        type: 'story',
        color: NEON_PURPLE,
        startX: 0, startZ: -200,
        objectives: [
          { type: 'go_to', description: 'Enter the bank', targetX: 0, targetZ: -350, targetRadius: 8 },
          { type: 'survive', description: 'Hold off the guards!', targetX: 0, targetZ: -350, targetRadius: 20, timeLimit: 30, timeRemaining: 30 },
          { type: 'escape', description: 'Escape to the safe house!', targetX: 100, targetZ: 100, targetRadius: 10 },
        ],
        currentObjective: 0,
        isComplete: false,
        isActive: false,
        reward: 3000,
        requiredMission: 'gang_turf',
      },
    ];
  }

  private createMarkers() {
    for (const mission of this.missions) {
      if (mission.isComplete) continue;

      // Marker
      const markerGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 16);
      const markerMat = new THREE.MeshStandardMaterial({
        color: mission.color,
        emissive: mission.color,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.8,
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(mission.startX, 0.2, mission.startZ);
      this.scene.add(marker);

      // Arrow pointing up
      const arrowGeo = new THREE.ConeGeometry(0.6, 2, 8);
      const arrowMat = new THREE.MeshStandardMaterial({
        color: mission.color,
        emissive: mission.color,
        emissiveIntensity: 1,
      });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.position.set(mission.startX, 4, mission.startZ);
      this.scene.add(arrow);

      this.missionMarkers.push({ mesh: marker, missionId: mission.id });
    }
  }

  update(delta: number, playerX: number, playerZ: number, killCallback?: (location: { x: number; z: number }) => boolean): { missionComplete: boolean; reward: number; promptText: string } | null {
    // Animate markers
    for (const m of this.missionMarkers) {
      m.mesh.rotation.y += delta * 2;
      const arrow = this.scene.children.find(c =>
        c.position.x === m.mesh.position.x && c.position.y > 2 && c.position.z === m.mesh.position.z
      );
      if (arrow) {
        arrow.position.y = 4 + Math.sin(Date.now() * 0.003) * 0.5;
        arrow.rotation.y += delta;
      }
    }

    if (!this.activeMission) {
      // Check if player is near a mission start
      for (const mission of this.missions) {
        if (mission.isComplete || mission.isActive) continue;
        if (mission.requiredMission) {
          const req = this.missions.find(m => m.id === mission.requiredMission);
          if (req && !req.isComplete) continue;
        }

        const dist = distance2D(playerX, playerZ, mission.startX, mission.startZ);
        if (dist < 5) {
          this.showPrompt = true;
          this.promptText = `Press F to start: ${mission.name}`;
          return { missionComplete: false, reward: 0, promptText: this.promptText };
        }
      }
      this.showPrompt = false;
      return null;
    }

    const mission = this.activeMission;
    const obj = mission.objectives[mission.currentObjective];

    if (!obj) {
      return null;
    }

    // Check objective completion
    let objectiveComplete = false;

    switch (obj.type) {
      case 'go_to':
      case 'escape':
      case 'race_checkpoint': {
        const dist = distance2D(playerX, playerZ, obj.targetX, obj.targetZ);
        if (dist < obj.targetRadius) {
          objectiveComplete = true;
        }
        break;
      }

      case 'kill': {
        if (obj.currentCount !== undefined && obj.killCount !== undefined) {
          if (obj.currentCount >= obj.killCount) {
            objectiveComplete = true;
          }
        }
        break;
      }

      case 'survive': {
        if (obj.timeRemaining !== undefined) {
          obj.timeRemaining -= delta;
          if (obj.timeRemaining <= 0) {
            objectiveComplete = true;
          }
        }
        break;
      }

      case 'collect': {
        const dist = distance2D(playerX, playerZ, obj.targetX, obj.targetZ);
        if (dist < obj.targetRadius) {
          objectiveComplete = true;
        }
        break;
      }
    }

    if (objectiveComplete) {
      mission.currentObjective++;
      if (mission.currentObjective >= mission.objectives.length) {
        mission.isComplete = true;
        mission.isActive = false;
        this.activeMission = null;
        return { missionComplete: true, reward: mission.reward, promptText: `Mission Complete! +${mission.reward}` };
      }
    }

    return null;
  }

  startMission(missionId: string): boolean {
    const mission = this.missions.find(m => m.id === missionId);
    if (!mission || mission.isComplete || mission.isActive) return false;

    if (mission.requiredMission) {
      const req = this.missions.find(m => m.id === mission.requiredMission);
      if (req && !req.isComplete) return false;
    }

    mission.isActive = true;
    this.activeMission = mission;
    return true;
  }

  onEnemyKilled(x: number, z: number) {
    if (!this.activeMission) return;
    const obj = this.activeMission.objectives[this.activeMission.currentObjective];
    if (obj && obj.type === 'kill' && obj.currentCount !== undefined) {
      const dist = distance2D(x, z, obj.targetX, obj.targetZ);
      if (dist < obj.targetRadius) {
        obj.currentCount++;
      }
    }
  }

  getCurrentObjective(): Objective | null {
    if (!this.activeMission) return null;
    return this.activeMission.objectives[this.activeMission.currentObjective] || null;
  }

  getActiveMission(): Mission | null {
    return this.activeMission;
  }

  isShowingPrompt(): boolean {
    return this.showPrompt;
  }

  getNearbyMission(playerX: number, playerZ: number): Mission | null {
    for (const mission of this.missions) {
      if (mission.isComplete || mission.isActive) continue;
      if (mission.requiredMission) {
        const req = this.missions.find(m => m.id === mission.requiredMission);
        if (req && !req.isComplete) continue;
      }
      const dist = distance2D(playerX, playerZ, mission.startX, mission.startZ);
      if (dist < 5) return mission;
    }
    return null;
  }
}
