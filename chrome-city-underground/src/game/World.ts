import * as THREE from 'three';
import { Physics, Collider } from './Physics';
import { NEON_GREEN, NEON_ORANGE, NEON_PURPLE, WORLD_SIZE, HALF_WORLD, randomRange, randomInt, randomChoice, worldToDistrict, createBoxMesh } from './Utils';

interface RoadSegment {
  startX: number; startZ: number;
  endX: number; endZ: number;
  width: number;
}

interface BuildingData {
  mesh: THREE.Mesh;
  collider: Collider;
  district: string;
  windows: THREE.Mesh[];
  hasNeon: boolean;
  neonMesh?: THREE.Mesh;
}

export class World {
  scene: THREE.Scene;
  physics: Physics;
  buildings: BuildingData[] = [];
  roads: RoadSegment[] = [];
  streetLights: THREE.Object3D[] = [];
  trafficLights: THREE.Object3D[] = [];
  trees: THREE.Object3D[] = [];
  ground!: THREE.Mesh;
  roadMeshes: THREE.Mesh[] = [];
  private buildingMeshes: THREE.Group;

  readonly BLOCK_SIZE = 60;
  readonly ROAD_WIDTH = 14;
  readonly GRID_COUNT = 16;

  constructor(scene: THREE.Scene, physics: Physics) {
    this.scene = scene;
    this.physics = physics;
    this.buildingMeshes = new THREE.Group();
    scene.add(this.buildingMeshes);
  }

  generate() {
    this.createGround();
    this.createRoads();
    this.createBuildings();
    this.createStreetLights();
    this.createTrafficLights();
    this.createTrees();
    this.createHighway();
    this.createLake();
  }

  private createGround() {
    const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE + 200, WORLD_SIZE + 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Grass areas
    const grassGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a1a,
      roughness: 1.0,
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.05;
    grass.receiveShadow = true;
    this.scene.add(grass);
  }

  private createRoads() {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.1,
    });

    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xcccc00,
      roughness: 0.5,
      emissive: 0x444400,
      emissiveIntensity: 0.3,
    });

    const offset = (this.GRID_COUNT * this.BLOCK_SIZE) / 2;

    for (let i = 0; i <= this.GRID_COUNT; i++) {
      const pos = i * this.BLOCK_SIZE - offset;

      // Horizontal road
      const hRoadGeo = new THREE.PlaneGeometry(WORLD_SIZE, this.ROAD_WIDTH);
      const hRoad = new THREE.Mesh(hRoadGeo, roadMat.clone());
      hRoad.rotation.x = -Math.PI / 2;
      hRoad.position.set(0, 0.01, pos);
      hRoad.receiveShadow = true;
      this.scene.add(hRoad);
      this.roadMeshes.push(hRoad);

      // Center line
      const hLineGeo = new THREE.PlaneGeometry(WORLD_SIZE, 0.3);
      const hLine = new THREE.Mesh(hLineGeo, lineMat.clone());
      hLine.rotation.x = -Math.PI / 2;
      hLine.position.set(0, 0.02, pos);
      this.scene.add(hLine);

      // Vertical road
      const vRoadGeo = new THREE.PlaneGeometry(this.ROAD_WIDTH, WORLD_SIZE);
      const vRoad = new THREE.Mesh(vRoadGeo, roadMat.clone());
      vRoad.rotation.x = -Math.PI / 2;
      vRoad.position.set(pos, 0.01, 0);
      vRoad.receiveShadow = true;
      this.scene.add(vRoad);
      this.roadMeshes.push(vRoad);

      // Center line
      const vLineGeo = new THREE.PlaneGeometry(0.3, WORLD_SIZE);
      const vLine = new THREE.Mesh(vLineGeo, lineMat.clone());
      vLine.rotation.x = -Math.PI / 2;
      vLine.position.set(pos, 0.02, 0);
      this.scene.add(vLine);

      this.roads.push(
        { startX: -HALF_WORLD, startZ: pos, endX: HALF_WORLD, endZ: pos, width: this.ROAD_WIDTH },
        { startX: pos, startZ: -HALF_WORLD, endX: pos, endZ: HALF_WORLD, width: this.ROAD_WIDTH }
      );
    }
  }

  private createBuildings() {
    const offset = (this.GRID_COUNT * this.BLOCK_SIZE) / 2;

    for (let gx = 0; gx < this.GRID_COUNT; gx++) {
      for (let gz = 0; gz < this.GRID_COUNT; gz++) {
        const blockCenterX = gx * this.BLOCK_SIZE - offset + this.BLOCK_SIZE / 2;
        const blockCenterZ = gz * this.BLOCK_SIZE - offset + this.BLOCK_SIZE / 2;
        const district = worldToDistrict(blockCenterX, blockCenterZ);

        const margin = this.ROAD_WIDTH / 2 + 2;
        const availW = this.BLOCK_SIZE - this.ROAD_WIDTH - 4;
        const availD = this.BLOCK_SIZE - this.ROAD_WIDTH - 4;

        if (district === 'downtown') {
          this.generateDowntownBlock(blockCenterX, blockCenterZ, availW, availD);
        } else if (district === 'industrial') {
          this.generateIndustrialBlock(blockCenterX, blockCenterZ, availW, availD);
        } else if (district === 'rural') {
          // Sparse buildings in rural
          if (Math.random() < 0.2) {
            this.generateRuralBuilding(blockCenterX, blockCenterZ, availW, availD);
          }
        } else {
          this.generateSuburbanBlock(blockCenterX, blockCenterZ, availW, availD);
        }
      }
    }
  }

  private generateDowntownBlock(cx: number, cz: number, w: number, d: number) {
    const numBuildings = randomInt(1, 3);
    for (let i = 0; i < numBuildings; i++) {
      const bw = randomRange(12, w * 0.8);
      const bd = randomRange(12, d * 0.8);
      const bh = randomRange(40, 120);
      const bx = cx + randomRange(-w / 4, w / 4);
      const bz = cz + randomRange(-d / 4, d / 4);

      this.addBuilding(bx, bz, bw, bh, bd, 'downtown');
    }
  }

  private generateSuburbanBlock(cx: number, cz: number, w: number, d: number) {
    const numBuildings = randomInt(2, 4);
    for (let i = 0; i < numBuildings; i++) {
      const bw = randomRange(8, 16);
      const bd = randomRange(8, 16);
      const bh = randomRange(6, 20);
      const bx = cx + randomRange(-w / 3, w / 3);
      const bz = cz + randomRange(-d / 3, d / 3);

      this.addBuilding(bx, bz, bw, bh, bd, 'suburban');
    }
  }

  private generateIndustrialBlock(cx: number, cz: number, w: number, d: number) {
    const numBuildings = randomInt(1, 3);
    for (let i = 0; i < numBuildings; i++) {
      const bw = randomRange(20, w * 0.9);
      const bd = randomRange(15, d * 0.9);
      const bh = randomRange(8, 20);
      const bx = cx + randomRange(-w / 5, w / 5);
      const bz = cz + randomRange(-d / 5, d / 5);

      this.addBuilding(bx, bz, bw, bh, bd, 'industrial');
    }
  }

  private generateRuralBuilding(cx: number, cz: number, w: number, d: number) {
    const bw = randomRange(6, 10);
    const bd = randomRange(6, 10);
    const bh = randomRange(4, 8);
    this.addBuilding(cx, cz, bw, bh, bd, 'rural');
  }

  private addBuilding(x: number, z: number, w: number, h: number, d: number, district: string) {
    let color: number;
    let emissiveColor = 0x000000;
    let emissiveIntensity = 0;
    let roughness = 0.7;

    switch (district) {
      case 'downtown':
        color = randomChoice([0x334455, 0x2a3a4a, 0x3a3a4a, 0x2a2a3a, 0x404050]);
        roughness = 0.3;
        emissiveIntensity = 0.05;
        break;
      case 'industrial':
        color = randomChoice([0x4a3a2a, 0x3a3a3a, 0x4a4a3a, 0x555544]);
        roughness = 0.9;
        break;
      case 'rural':
        color = randomChoice([0x6a5a4a, 0x5a4a3a, 0x7a6a5a]);
        roughness = 0.8;
        break;
      default:
        color = randomChoice([0x5a5a6a, 0x4a5a5a, 0x6a5a5a, 0x555566]);
        roughness = 0.7;
    }

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: district === 'downtown' ? 0.5 : 0.1,
      emissive: emissiveColor,
      emissiveIntensity,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.buildingMeshes.add(mesh);

    const collider: Collider = {
      aabb: { minX: x - w / 2, minZ: z - d / 2, maxX: x + w / 2, maxZ: z + d / 2 },
      height: h,
      type: 'building',
      mesh,
    };
    this.physics.addCollider(collider);

    // Windows
    const windows: THREE.Mesh[] = [];
    const hasNeon = district === 'downtown' && Math.random() < 0.3;

    // Shared geometry for windows - reuse for performance
    const winGeo = new THREE.PlaneGeometry(2, 2.5);

    if (district === 'downtown' || district === 'suburban') {
      const windowRows = Math.floor(h / 5); // Reduced row density
      const windowCols = Math.floor(Math.max(w, d) / 6); // Reduced column density

      // Create shared materials for lit and unlit windows
      const litWinMat = new THREE.MeshStandardMaterial({
        color: 0xffdd88,
        emissive: 0xffaa44,
        emissiveIntensity: 0.5,
        roughness: 0.1,
        metalness: 0.8,
      });
      const darkWinMat = new THREE.MeshStandardMaterial({
        color: 0x223344,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.1,
        metalness: 0.8,
      });

      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
          if (Math.random() < 0.6) { // Slightly fewer windows
            const wy = row * 5 + 3;
            const wx = (col - windowCols / 2 + 0.5) * 6;

            const isLit = Math.random() < 0.6;
            const winMat = isLit ? litWinMat : darkWinMat;

            // Front
            const win1 = new THREE.Mesh(winGeo, winMat);
            win1.position.set(x + wx, wy, z + d / 2 + 0.05);
            this.buildingMeshes.add(win1);
            windows.push(win1);

            // Back
            const win2 = new THREE.Mesh(winGeo, winMat);
            win2.position.set(x + wx, wy, z - d / 2 - 0.05);
            win2.rotation.y = Math.PI;
            this.buildingMeshes.add(win2);
            windows.push(win2);
          }
        }
      }
    }

    // Neon sign
    let neonMesh: THREE.Mesh | undefined;
    if (hasNeon) {
      const neonColor = randomChoice([NEON_GREEN, NEON_ORANGE, NEON_PURPLE]);
      const neonGeo = new THREE.BoxGeometry(w * 0.6, 2, 0.3);
      const neonMat = new THREE.MeshStandardMaterial({
        color: neonColor,
        emissive: neonColor,
        emissiveIntensity: 2,
        roughness: 0.1,
        metalness: 0.5,
      });
      neonMesh = new THREE.Mesh(neonGeo, neonMat);
      neonMesh.position.set(x, h * 0.7, z + d / 2 + 0.5);
      this.buildingMeshes.add(neonMesh);
    }

    this.buildings.push({
      mesh,
      collider,
      district,
      windows,
      hasNeon,
      neonMesh,
    });
  }

  private createStreetLights() {
    const offset = (this.GRID_COUNT * this.BLOCK_SIZE) / 2;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.4 });
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffdd88,
      emissive: 0xffaa44,
      emissiveIntensity: 0.5,
    });

    for (let i = 0; i < this.GRID_COUNT; i += 2) { // Every other intersection
      for (let j = 0; j < this.GRID_COUNT; j += 2) {
        const roadX = i * this.BLOCK_SIZE - offset;
        const roadZ = j * this.BLOCK_SIZE - offset;

        // Only one light per intersection
        const dx = Math.random() < 0.5 ? -1 : 1;
        const dz = Math.random() < 0.5 ? -1 : 1;
        const lx = roadX + dx * (this.ROAD_WIDTH / 2 + 1);
        const lz = roadZ + dz * (this.ROAD_WIDTH / 2 + 1);

        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.15, 8, 6),
          poleMat
        );
        pole.position.set(lx, 4, lz);
        pole.castShadow = true;
        this.buildingMeshes.add(pole);

        // Arm
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(3, 0.15, 0.15),
          poleMat
        );
        arm.position.set(lx + dx * 1.5, 8, lz);
        this.buildingMeshes.add(arm);

        // Light fixture
        const light = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.3, 1),
          lightMat.clone()
        );
        light.position.set(lx + dx * 3, 7.8, lz);
        this.buildingMeshes.add(light);

        // Point light - only add at night, start with 0 intensity
        const pointLight = new THREE.PointLight(0xffaa44, 0, 20, 2); // Reduced range
        pointLight.position.set(lx + dx * 3, 7.5, lz);
        this.buildingMeshes.add(pointLight);

        this.streetLights.push({ pole, light: pointLight, fixture: light } as any);
      }
    }
  }

  private createTrafficLights() {
    const offset = (this.GRID_COUNT * this.BLOCK_SIZE) / 2;

    for (let i = 1; i < this.GRID_COUNT; i += 2) {
      for (let j = 1; j < this.GRID_COUNT; j += 2) {
        const roadX = i * this.BLOCK_SIZE - offset;
        const roadZ = j * this.BLOCK_SIZE - offset;

        const tlGroup = new THREE.Group();

        // Pole
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), poleMat);
        pole.position.set(roadX + this.ROAD_WIDTH / 2 + 1, 2.5, roadZ + this.ROAD_WIDTH / 2 + 1);
        tlGroup.add(pole);

        // Box
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 1.5, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        box.position.set(roadX + this.ROAD_WIDTH / 2 + 1, 5.5, roadZ + this.ROAD_WIDTH / 2 + 1);
        tlGroup.add(box);

        // Lights
        const redLight = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 })
        );
        redLight.position.set(roadX + this.ROAD_WIDTH / 2 + 1.35, 5.8, roadZ + this.ROAD_WIDTH / 2 + 1);
        tlGroup.add(redLight);

        const yellowLight = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.3 })
        );
        yellowLight.position.set(roadX + this.ROAD_WIDTH / 2 + 1.35, 5.5, roadZ + this.ROAD_WIDTH / 2 + 1);
        tlGroup.add(yellowLight);

        const greenLight = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.3 })
        );
        greenLight.position.set(roadX + this.ROAD_WIDTH / 2 + 1.35, 5.2, roadZ + this.ROAD_WIDTH / 2 + 1);
        tlGroup.add(greenLight);

        this.scene.add(tlGroup);
        this.trafficLights.push(tlGroup);
      }
    }
  }

  private createTrees() {
    const offset = (this.GRID_COUNT * this.BLOCK_SIZE) / 2;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a5a1a, roughness: 0.8 });

    for (let i = 0; i < 200; i++) {
      const x = randomRange(-HALF_WORLD, HALF_WORLD);
      const z = randomRange(-HALF_WORLD, HALF_WORLD);
      const district = worldToDistrict(x, z);

      if (district === 'downtown') continue; // No trees downtown

      // Check not on road
      if (this.isOnRoad(x, z)) continue;

      const treeHeight = randomRange(4, 10);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, treeHeight * 0.6, 6),
        trunkMat
      );
      trunk.position.set(x, treeHeight * 0.3, z);
      trunk.castShadow = true;
      this.scene.add(trunk);

      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(treeHeight * 0.35, 8, 6),
        leafMat.clone()
      );
      canopy.position.set(x, treeHeight * 0.7, z);
      canopy.castShadow = true;
      this.scene.add(canopy);

      const treeGroup = new THREE.Group();
      treeGroup.add(trunk);
      treeGroup.add(canopy);
      this.trees.push(treeGroup);

      // Add collider
      this.physics.addCollider({
        aabb: { minX: x - 0.5, minZ: z - 0.5, maxX: x + 0.5, maxZ: z + 0.5 },
        height: treeHeight,
        type: 'tree',
        mesh: trunk,
      });
    }
  }

  private createHighway() {
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.5 });

    // Main elevated highway running east-west through the city
    const highwayY = 10;
    const highwayLength = WORLD_SIZE * 0.8;

    // Road surface
    const highwayGeo = new THREE.BoxGeometry(highwayLength, 0.5, 16);
    const highwayMesh = new THREE.Mesh(highwayGeo, rampMat);
    highwayMesh.position.set(0, highwayY, -200);
    highwayMesh.castShadow = true;
    highwayMesh.receiveShadow = true;
    this.scene.add(highwayMesh);

    // Rails
    for (const dz of [-8, 8]) {
      const railGeo = new THREE.BoxGeometry(highwayLength, 1.5, 0.3);
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(0, highwayY + 1, -200 + dz);
      this.scene.add(rail);
    }

    // Support pillars
    for (let x = -highwayLength / 2; x < highwayLength / 2; x += 60) {
      const pillarGeo = new THREE.BoxGeometry(2, highwayY, 2);
      const pillar = new THREE.Mesh(pillarGeo, rampMat);
      pillar.position.set(x, highwayY / 2, -200);
      pillar.castShadow = true;
      this.scene.add(pillar);

      this.physics.addCollider({
        aabb: { minX: x - 1, minZ: -202, maxX: x + 1, maxZ: -198 },
        height: highwayY,
        type: 'wall',
        mesh: pillar,
      });
    }

    // Highway collider
    this.physics.addCollider({
      aabb: { minX: -highwayLength / 2, minZ: -208, maxX: highwayLength / 2, maxZ: -192 },
      height: highwayY + 1,
      type: 'wall',
      mesh: highwayMesh,
    });

    // North-south highway
    const nsHighwayGeo = new THREE.BoxGeometry(16, 0.5, highwayLength);
    const nsHighway = new THREE.Mesh(nsHighwayGeo, rampMat);
    nsHighway.position.set(200, highwayY, 0);
    nsHighway.castShadow = true;
    nsHighway.receiveShadow = true;
    this.scene.add(nsHighway);

    for (const dx of [-8, 8]) {
      const railGeo = new THREE.BoxGeometry(0.3, 1.5, highwayLength);
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(200 + dx, highwayY + 1, 0);
      this.scene.add(rail);
    }

    for (let z = -highwayLength / 2; z < highwayLength / 2; z += 60) {
      const pillarGeo = new THREE.BoxGeometry(2, highwayY, 2);
      const pillar = new THREE.Mesh(pillarGeo, rampMat);
      pillar.position.set(200, highwayY / 2, z);
      pillar.castShadow = true;
      this.scene.add(pillar);
    }
  }

  private createLake() {
    // Lake in the rural area
    const lakeGeo = new THREE.CircleGeometry(80, 32);
    const lakeMat = new THREE.MeshStandardMaterial({
      color: 0x1a4a7a,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85,
    });
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(HALF_WORLD * 0.7, 0.05, HALF_WORLD * 0.7);
    this.scene.add(lake);
  }

  isOnRoad(x: number, z: number): boolean {
    const offset = (this.GRID_COUNT * this.BLOCK_SIZE) / 2;
    const halfRoad = this.ROAD_WIDTH / 2;

    for (let i = 0; i <= this.GRID_COUNT; i++) {
      const roadPos = i * this.BLOCK_SIZE - offset;
      if (Math.abs(x - roadPos) < halfRoad) return true;
      if (Math.abs(z - roadPos) < halfRoad) return true;
    }
    return false;
  }

  getNearestRoadPosition(x: number, z: number): { x: number; z: number; direction: 'ns' | 'ew' } {
    const offset = (this.GRID_COUNT * this.BLOCK_SIZE) / 2;
    const halfRoad = this.ROAD_WIDTH / 2;

    let bestDist = Infinity;
    let bestX = x;
    let bestZ = z;
    let bestDir: 'ns' | 'ew' = 'ns';

    for (let i = 0; i <= this.GRID_COUNT; i++) {
      const roadPos = i * this.BLOCK_SIZE - offset;

      // East-west road
      const distEW = Math.abs(z - roadPos);
      if (distEW < bestDist) {
        bestDist = distEW;
        bestX = x;
        bestZ = roadPos;
        bestDir = 'ew';
      }

      // North-south road
      const distNS = Math.abs(x - roadPos);
      if (distNS < bestDist) {
        bestDist = distNS;
        bestX = roadPos;
        bestZ = z;
        bestDir = 'ns';
      }
    }

    return { x: bestX, z: bestZ, direction: bestDir };
  }

  setNightMode(isNight: boolean) {
    for (const b of this.buildings) {
      for (const w of b.windows) {
        const mat = w.material as THREE.MeshStandardMaterial;
        if (isNight) {
          mat.emissiveIntensity = Math.random() * 0.8 + 0.2;
          mat.emissive.set(Math.random() < 0.7 ? 0xffaa44 : 0x4488ff);
        } else {
          mat.emissiveIntensity = 0.05;
          mat.emissive.set(0x000000);
        }
      }

      if (b.neonMesh) {
        const mat = b.neonMesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = isNight ? 3 : 0.5;
      }
    }

    for (const sl of this.streetLights) {
      const slData = sl as any;
      if (slData.light) {
        slData.light.intensity = isNight ? 15 : 0;
      }
      if (slData.fixture) {
        const mat = slData.fixture.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = isNight ? 2 : 0.3;
      }
    }
  }

  getSpawnPoint(): { x: number; z: number } {
    // Spawn in suburban area, next to a road intersection
    return { x: 40, z: 40 };
  }
}
