import * as THREE from 'three';
import { lerp, clamp, HALF_WORLD } from './Utils';

export class Weather {
  scene: THREE.Scene;
  timeOfDay = 0.25; // 0-1 (0=midnight, 0.25=6am, 0.5=noon, 0.75=6pm)
  dayLength = 600; // seconds for full day cycle (10 minutes)
  weatherType: 'clear' | 'cloudy' | 'rain' = 'clear';
  weatherIntensity = 0;
  private targetWeatherIntensity = 0;
  private weatherTimer = 0;
  private sunLight!: THREE.DirectionalLight;
  private moonLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private rainParticles: THREE.Points | null = null;
  private rainCount = 3000;
  private fogDensity = 0;
  private sunPosition = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0x404060, 0.4);
    scene.add(this.ambientLight);

    // Sun light
    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -200;
    this.sunLight.shadow.camera.right = 200;
    this.sunLight.shadow.camera.top = 200;
    this.sunLight.shadow.camera.bottom = -200;
    scene.add(this.sunLight);

    // Moon light
    this.moonLight = new THREE.DirectionalLight(0x4466aa, 0.2);
    scene.add(this.moonLight);

    // Create rain system
    this.createRain();

    // Fog
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.0005);
  }

  private createRain() {
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 3);
    const velocities = new Float32Array(this.rainCount);

    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = Math.random() * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      velocities[i] = 0.5 + Math.random() * 1.5;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    (rainGeo as any).velocities = velocities;

    const rainMat = new THREE.PointsMaterial({
      color: 0xaaaacc,
      size: 0.15,
      transparent: true,
      opacity: 0,
    });

    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this.rainParticles);
  }

  update(delta: number, playerPos: THREE.Vector3) {
    // Advance time
    this.timeOfDay += delta / this.dayLength;
    if (this.timeOfDay >= 1) this.timeOfDay -= 1;

    // Weather changes
    this.weatherTimer -= delta;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 60 + Math.random() * 120;
      const r = Math.random();
      if (r < 0.5) {
        this.weatherType = 'clear';
        this.targetWeatherIntensity = 0;
      } else if (r < 0.8) {
        this.weatherType = 'cloudy';
        this.targetWeatherIntensity = 0.5;
      } else {
        this.weatherType = 'rain';
        this.targetWeatherIntensity = 1;
      }
    }

    this.weatherIntensity = lerp(this.weatherIntensity, this.targetWeatherIntensity, delta * 0.1);

    // Sun position
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const sunDist = 300;

    this.sunPosition.set(
      Math.cos(sunAngle) * sunDist,
      sunHeight * sunDist,
      50
    );

    this.sunLight.position.copy(this.sunPosition);
    this.sunLight.target.position.copy(playerPos);

    // Moon opposite the sun
    this.moonLight.position.set(-this.sunPosition.x, -this.sunPosition.y, -this.sunPosition.z);
    this.moonLight.target.position.copy(playerPos);

    // Light intensity based on time
    const isDaytime = sunHeight > 0;
    const dayFactor = clamp(sunHeight * 3, 0, 1);

    this.sunLight.intensity = isDaytime ? dayFactor * 1.5 : 0;
    this.moonLight.intensity = isDaytime ? 0 : 0.3;
    this.ambientLight.intensity = lerp(0.15, 0.5, dayFactor);

    // Sky color
    const skyColor = this.calculateSkyColor(dayFactor);
    (this.scene.fog as THREE.FogExp2).color.copy(skyColor);
    this.scene.background = skyColor;

    // Fog
    const fogBase = isDaytime ? 0.0003 : 0.001;
    const weatherFog = this.weatherIntensity * 0.002;
    (this.scene.fog as THREE.FogExp2).density = fogBase + weatherFog;

    // Shadow sun follow player
    this.sunLight.target.updateMatrixWorld();

    // Update rain
    this.updateRain(delta, playerPos);
  }

  private calculateSkyColor(dayFactor: number): THREE.Color {
    const nightColor = new THREE.Color(0x0a0a1a);
    const dawnColor = new THREE.Color(0x3a2a1a);
    const dayColor = new THREE.Color(0x4a7aaa);
    const sunsetColor = new THREE.Color(0x4a2a1a);

    const sunsetFactor = Math.max(0, 1 - Math.abs(dayFactor - 0.3) * 5);

    let color: THREE.Color;
    if (dayFactor < 0.1) {
      color = nightColor.clone();
    } else if (dayFactor < 0.3) {
      const t = (dayFactor - 0.1) / 0.2;
      color = nightColor.clone().lerp(dawnColor, t);
    } else if (dayFactor < 0.7) {
      const t = (dayFactor - 0.3) / 0.4;
      color = dawnColor.clone().lerp(dayColor, t);
      color.lerp(sunsetColor, sunsetFactor * 0.5);
    } else if (dayFactor < 0.9) {
      const t = (dayFactor - 0.7) / 0.2;
      color = dayColor.clone().lerp(dawnColor, t);
    } else {
      const t = (dayFactor - 0.9) / 0.1;
      color = dawnColor.clone().lerp(nightColor, t);
    }

    // Weather effect on sky
    if (this.weatherIntensity > 0) {
      color.lerp(new THREE.Color(0x333333), this.weatherIntensity * 0.5);
    }

    return color;
  }

  private updateRain(delta: number, playerPos: THREE.Vector3) {
    if (!this.rainParticles) return;

    const rainOpacity = this.weatherIntensity * (this.isNight() ? 0.5 : 0.7);
    (this.rainParticles.material as THREE.PointsMaterial).opacity = rainOpacity;

    if (this.weatherIntensity > 0.1) {
      const positions = this.rainParticles.geometry.attributes.position;
      const velocities = (this.rainParticles.geometry as any).velocities;

      for (let i = 0; i < this.rainCount; i++) {
        positions.array[i * 3 + 1] -= velocities[i] * 60 * delta;

        if (positions.array[i * 3 + 1] < 0) {
          positions.array[i * 3] = playerPos.x + (Math.random() - 0.5) * 200;
          positions.array[i * 3 + 1] = 50 + Math.random() * 50;
          positions.array[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 200;
        }
      }

      positions.needsUpdate = true;
    }

    // Position rain around player
    this.rainParticles.position.set(0, 0, 0);
  }

  isNight(): boolean {
    const sunHeight = Math.sin((this.timeOfDay - 0.25) * Math.PI * 2);
    return sunHeight < 0;
  }

  getRainFactor(): number {
    return this.weatherIntensity;
  }

  getTimeString(): string {
    const hours = Math.floor(this.timeOfDay * 24);
    const minutes = Math.floor((this.timeOfDay * 24 - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  getTimeOfDay(): number {
    return this.timeOfDay;
  }
}
