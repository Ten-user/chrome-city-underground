export class HUD {
  private container: HTMLDivElement;
  private healthBar!: HTMLDivElement;
  private armorBar!: HTMLDivElement;
  private staminaBar!: HTMLDivElement;
  private wantedStars!: HTMLDivElement;
  private weaponInfo!: HTMLDivElement;
  private speedometer!: HTMLDivElement;
  private nitrousBar!: HTMLDivElement;
  private moneyDisplay!: HTMLDivElement;
  private missionPrompt!: HTMLDivElement;
  private objectiveDisplay!: HTMLDivElement;
  private minimap!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private controlsHelp!: HTMLDivElement;
  private damageFlash!: HTMLDivElement;
  private crosshair!: HTMLDivElement;
  private reloadIndicator!: HTMLDivElement;
  private deathText: HTMLDivElement | null = null;
  private showHelp = false;
  private damageTimer = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'game-hud';
    this.container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;font-family:"Courier New",monospace;';

    this.createHealthBar();
    this.createWantedStars();
    this.createWeaponInfo();
    this.createSpeedometer();
    this.createMoneyDisplay();
    this.createMissionPrompt();
    this.createObjectiveDisplay();
    this.createMinimap();
    this.createControlsHelp();
    this.createDamageFlash();
    this.createCrosshair();
    this.createReloadIndicator();

    document.body.appendChild(this.container);
  }

  private createHealthBar() {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:absolute;bottom:20px;left:20px;width:220px;';

    // Armor
    const armorLabel = document.createElement('div');
    armorLabel.style.cssText = 'color:#4488ff;font-size:11px;margin-bottom:2px;text-shadow:0 0 5px #4488ff;';
    armorLabel.textContent = 'ARMOR';
    wrapper.appendChild(armorLabel);

    this.armorBar = document.createElement('div');
    this.armorBar.style.cssText = 'width:100%;height:8px;background:#1a1a3a;border:1px solid #4488ff;border-radius:2px;overflow:hidden;margin-bottom:6px;';
    const armorFill = document.createElement('div');
    armorFill.style.cssText = 'width:0%;height:100%;background:linear-gradient(90deg,#2244aa,#4488ff);transition:width 0.3s;';
    armorFill.id = 'armor-fill';
    this.armorBar.appendChild(armorFill);
    wrapper.appendChild(this.armorBar);

    // Health
    const healthLabel = document.createElement('div');
    healthLabel.style.cssText = 'color:#ff4444;font-size:11px;margin-bottom:2px;text-shadow:0 0 5px #ff4444;';
    healthLabel.textContent = 'HEALTH';
    wrapper.appendChild(healthLabel);

    this.healthBar = document.createElement('div');
    this.healthBar.style.cssText = 'width:100%;height:12px;background:#1a1a1a;border:1px solid #ff4444;border-radius:2px;overflow:hidden;margin-bottom:6px;';
    const healthFill = document.createElement('div');
    healthFill.style.cssText = 'width:100%;height:100%;background:linear-gradient(90deg,#aa2222,#ff4444);transition:width 0.3s;';
    healthFill.id = 'health-fill';
    this.healthBar.appendChild(healthFill);
    wrapper.appendChild(this.healthBar);

    // Stamina
    const staminaLabel = document.createElement('div');
    staminaLabel.style.cssText = 'color:#00ff88;font-size:11px;margin-bottom:2px;text-shadow:0 0 5px #00ff88;';
    staminaLabel.textContent = 'STAMINA';
    wrapper.appendChild(staminaLabel);

    this.staminaBar = document.createElement('div');
    this.staminaBar.style.cssText = 'width:100%;height:6px;background:#1a1a1a;border:1px solid #00ff88;border-radius:2px;overflow:hidden;';
    const staminaFill = document.createElement('div');
    staminaFill.style.cssText = 'width:100%;height:100%;background:linear-gradient(90deg,#008844,#00ff88);transition:width 0.3s;';
    staminaFill.id = 'stamina-fill';
    this.staminaBar.appendChild(staminaFill);
    wrapper.appendChild(this.staminaBar);

    this.container.appendChild(wrapper);
  }

  private createWantedStars() {
    this.wantedStars = document.createElement('div');
    this.wantedStars.style.cssText = 'position:absolute;top:20px;right:20px;display:flex;gap:4px;';
    for (let i = 0; i < 5; i++) {
      const star = document.createElement('div');
      star.style.cssText = 'font-size:24px;color:#333;text-shadow:none;transition:all 0.3s;';
      star.textContent = '★';
      star.id = `star-${i}`;
      this.wantedStars.appendChild(star);
    }
    this.container.appendChild(this.wantedStars);
  }

  private createWeaponInfo() {
    this.weaponInfo = document.createElement('div');
    this.weaponInfo.style.cssText = 'position:absolute;bottom:20px;right:20px;text-align:right;background:rgba(0,0,0,0.6);padding:10px 15px;border-radius:4px;border:1px solid #00ff88;min-width:150px;';
    this.weaponInfo.innerHTML = `
      <div style="color:#00ff88;font-size:14px;font-weight:bold;margin-bottom:4px;" id="weapon-name">9mm Pistol</div>
      <div style="color:#ffaa44;font-size:18px;font-weight:bold;" id="weapon-ammo">∞</div>
    `;
    this.container.appendChild(this.weaponInfo);
  }

  private createSpeedometer() {
    this.speedometer = document.createElement('div');
    this.speedometer.style.cssText = 'position:absolute;bottom:100px;right:20px;text-align:right;display:none;';
    this.speedometer.innerHTML = `
      <div style="color:#00ff88;font-size:36px;font-weight:bold;text-shadow:0 0 10px #00ff88;" id="speed-value">0</div>
      <div style="color:#888;font-size:12px;">km/h</div>
      <div style="margin-top:8px;width:150px;height:8px;background:#1a1a1a;border:1px solid #ff6600;border-radius:2px;overflow:hidden;" id="nitrous-wrapper">
        <div style="width:100%;height:100%;background:linear-gradient(90deg,#ff4400,#ff6600);transition:width 0.2s;" id="nitrous-fill"></div>
      </div>
      <div style="color:#ff6600;font-size:10px;margin-top:2px;">NITROUS</div>
    `;
    this.container.appendChild(this.speedometer);
  }

  private createMoneyDisplay() {
    this.moneyDisplay = document.createElement('div');
    this.moneyDisplay.style.cssText = 'position:absolute;top:20px;left:20px;';
    this.moneyDisplay.innerHTML = `
      <div style="color:#00ff88;font-size:20px;font-weight:bold;text-shadow:0 0 10px #00ff88;" id="money-value">$500</div>
      <div style="color:#8888aa;font-size:11px;margin-top:4px;" id="time-display">12:00</div>
    `;
    this.container.appendChild(this.moneyDisplay);
  }

  private vehiclePrompt: HTMLDivElement | null = null;

  private createMissionPrompt() {
    this.missionPrompt = document.createElement('div');
    this.missionPrompt.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:16px;text-align:center;text-shadow:0 0 10px rgba(0,255,136,0.5);display:none;pointer-events:none;';
    this.container.appendChild(this.missionPrompt);
  }

  private createObjectiveDisplay() {
    this.objectiveDisplay = document.createElement('div');
    this.objectiveDisplay.style.cssText = 'position:absolute;top:80px;left:50%;transform:translateX(-50%);color:#ffaa44;font-size:14px;text-align:center;text-shadow:0 0 10px rgba(255,170,68,0.5);background:rgba(0,0,0,0.5);padding:8px 16px;border-radius:4px;border:1px solid #ff6600;display:none;';
    this.container.appendChild(this.objectiveDisplay);
  }

  private createMinimap() {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:180px;height:180px;border:2px solid #00ff88;border-radius:4px;overflow:hidden;background:rgba(0,0,0,0.7);';

    this.minimap = document.createElement('canvas');
    this.minimap.width = 180;
    this.minimap.height = 180;
    this.minimap.style.cssText = 'width:100%;height:100%;';
    wrapper.appendChild(this.minimap);

    const ctx = this.minimap.getContext('2d');
    if (ctx) this.minimapCtx = ctx;

    this.container.appendChild(wrapper);
  }

  private createControlsHelp() {
    this.controlsHelp = document.createElement('div');
    this.controlsHelp.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);border:1px solid #00ff88;border-radius:8px;padding:20px 30px;color:#fff;font-size:13px;line-height:2;display:none;pointer-events:auto;';
    this.controlsHelp.innerHTML = `
      <div style="color:#00ff88;font-size:18px;font-weight:bold;margin-bottom:10px;text-align:center;">CONTROLS</div>
      <div><span style="color:#ff6600;">WASD</span> - Move / Drive</div>
      <div><span style="color:#ff6600;">Mouse</span> - Look Around</div>
      <div><span style="color:#ff6600;">Shift</span> - Sprint / Nitrous</div>
      <div><span style="color:#ff6600;">Space</span> - Jump / Handbrake</div>
      <div><span style="color:#ff6600;">E</span> - Enter/Exit Vehicle</div>
      <div><span style="color:#ff6600;">F</span> - Interact</div>
      <div><span style="color:#ff6600;">Left Click</span> - Shoot</div>
      <div><span style="color:#ff6600;">Right Click</span> - Aim</div>
      <div><span style="color:#ff6600;">R</span> - Reload / Honk</div>
      <div><span style="color:#ff6600;">1-5</span> - Switch Weapons</div>
      <div><span style="color:#ff6600;">Tab</span> - Next Weapon</div>
      <div><span style="color:#ff6600;">V</span> - Toggle View</div>
      <div><span style="color:#ff6600;">H</span> - Toggle Help</div>
      <div style="text-align:center;margin-top:10px;color:#888;">Press H to close</div>
    `;
    this.container.appendChild(this.controlsHelp);
  }

  private createDamageFlash() {
    this.damageFlash = document.createElement('div');
    this.damageFlash.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(ellipse at center,transparent 50%,rgba(255,0,0,0.4));opacity:0;transition:opacity 0.1s;pointer-events:none;';
    this.container.appendChild(this.damageFlash);
  }

  private createCrosshair() {
    this.crosshair = document.createElement('div');
    this.crosshair.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;';
    this.crosshair.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24">
        <line x1="12" y1="0" x2="12" y2="8" stroke="#00ff88" stroke-width="1.5" opacity="0.8"/>
        <line x1="12" y1="16" x2="12" y2="24" stroke="#00ff88" stroke-width="1.5" opacity="0.8"/>
        <line x1="0" y1="12" x2="8" y2="12" stroke="#00ff88" stroke-width="1.5" opacity="0.8"/>
        <line x1="16" y1="12" x2="24" y2="12" stroke="#00ff88" stroke-width="1.5" opacity="0.8"/>
        <circle cx="12" cy="12" r="1.5" fill="none" stroke="#00ff88" stroke-width="1" opacity="0.6"/>
      </svg>
    `;
    this.container.appendChild(this.crosshair);
  }

  private createReloadIndicator() {
    this.reloadIndicator = document.createElement('div');
    this.reloadIndicator.style.cssText = 'position:absolute;top:55%;left:50%;transform:translateX(-50%);color:#ffaa44;font-size:14px;font-weight:bold;text-shadow:0 0 10px #ff6600;display:none;';
    this.reloadIndicator.textContent = 'RELOADING...';
    this.container.appendChild(this.reloadIndicator);
  }

  update(data: {
    health: number;
    maxHealth: number;
    armor: number;
    maxArmor: number;
    stamina: number;
    maxStamina: number;
    wantedLevel: number;
    weaponName: string;
    ammo: number;
    maxAmmo: number;
    isReloading: boolean;
    isInVehicle: boolean;
    speed: number;
    nitrous: number;
    nitrousMax: number;
    money: number;
    objective: string | null;
    missionPrompt: string | null;
    playerX: number;
    playerZ: number;
    playerRotation: number;
    enemies: { x: number; z: number; type: string }[];
    vehicles: { x: number; z: number }[];
    missionMarkers: { x: number; z: number; color: string }[];
    isDead: boolean;
    isNight: boolean;
  }) {
    // Health
    const healthFill = document.getElementById('health-fill');
    if (healthFill) healthFill.style.width = `${(data.health / data.maxHealth) * 100}%`;

    // Armor
    const armorFill = document.getElementById('armor-fill');
    if (armorFill) armorFill.style.width = `${(data.armor / data.maxArmor) * 100}%`;

    // Stamina
    const staminaFill = document.getElementById('stamina-fill');
    if (staminaFill) staminaFill.style.width = `${(data.stamina / data.maxStamina) * 100}%`;

    // Wanted stars
    for (let i = 0; i < 5; i++) {
      const star = document.getElementById(`star-${i}`);
      if (star) {
        if (i < data.wantedLevel) {
          star.style.color = '#ff4444';
          star.style.textShadow = '0 0 10px #ff4444';
        } else {
          star.style.color = '#333';
          star.style.textShadow = 'none';
        }
      }
    }

    // Weapon info
    const weaponName = document.getElementById('weapon-name');
    if (weaponName) weaponName.textContent = data.weaponName;
    const weaponAmmo = document.getElementById('weapon-ammo');
    if (weaponAmmo) weaponAmmo.textContent = data.ammo === Infinity ? '∞' : `${data.ammo} / ${data.maxAmmo}`;

    // Reload
    if (this.reloadIndicator) {
      this.reloadIndicator.style.display = data.isReloading ? 'block' : 'none';
    }

    // Speedometer
    this.speedometer.style.display = data.isInVehicle ? 'block' : 'none';
    const speedValue = document.getElementById('speed-value');
    if (speedValue) speedValue.textContent = Math.round(data.speed).toString();
    const nitrousFill = document.getElementById('nitrous-fill');
    if (nitrousFill) nitrousFill.style.width = `${(data.nitrous / data.nitrousMax) * 100}%`;

    // Money
    const moneyValue = document.getElementById('money-value');
    if (moneyValue) moneyValue.textContent = `$${data.money.toLocaleString()}`;

    // Vehicle prompt
    if (!this.vehiclePrompt) {
      this.vehiclePrompt = document.createElement('div');
      this.vehiclePrompt.style.cssText = 'position:absolute;bottom:50%;left:50%;transform:translate(-50%,50%);color:#ffaa44;font-size:14px;text-align:center;text-shadow:0 0 10px rgba(255,170,68,0.5);background:rgba(0,0,0,0.5);padding:6px 12px;border-radius:4px;display:none;';
      this.container.appendChild(this.vehiclePrompt);
    }
    // Show vehicle prompt when near a vehicle and not in one
    const nearVehicle = data.vehicles.length > 0 && !data.isInVehicle;
    this.vehiclePrompt.style.display = nearVehicle ? 'block' : 'none';
    if (nearVehicle) this.vehiclePrompt.textContent = 'Press E to enter vehicle';

    // Objective
    if (data.objective) {
      this.objectiveDisplay.style.display = 'block';
      this.objectiveDisplay.textContent = data.objective;
    } else {
      this.objectiveDisplay.style.display = 'none';
    }

    // Mission prompt
    if (data.missionPrompt) {
      this.missionPrompt.style.display = 'block';
      this.missionPrompt.textContent = data.missionPrompt;
    } else {
      this.missionPrompt.style.display = 'none';
    }

    // Damage flash
    if (data.health < data.maxHealth * 0.3) {
      this.damageFlash.style.opacity = `${0.3 + Math.sin(Date.now() * 0.005) * 0.2}`;
    } else {
      this.damageFlash.style.opacity = '0';
    }

    // Dead overlay
    if (data.isDead) {
      this.damageFlash.style.opacity = '0.7';
      this.damageFlash.style.background = 'radial-gradient(ellipse at center, transparent 20%, rgba(180,0,0,0.7))';
    }

    // Death text
    if (!this.deathText) {
      this.deathText = document.createElement('div');
      this.deathText.style.cssText = 'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);color:#ff0000;font-size:48px;font-weight:bold;text-shadow:0 0 20px #ff0000,0 0 40px #ff0000;display:none;text-align:center;';
      this.deathText.innerHTML = 'WASTED<div style="font-size:16px;color:#ffaa44;margin-top:15px;text-shadow:0 0 10px #ff6600;">Respawning...</div>';
      this.container.appendChild(this.deathText);
    }
    this.deathText.style.display = data.isDead ? 'block' : 'none';

    // Crosshair
    this.crosshair.style.display = data.isDead ? 'none' : 'block';

    // Minimap
    this.updateMinimap(data);

    // Controls help toggle
    if (data.isDead) {
      this.controlsHelp.style.display = 'none';
    }
  }

  toggleHelp() {
    this.showHelp = !this.showHelp;
    this.controlsHelp.style.display = this.showHelp ? 'block' : 'none';
  }

  showDamage() {
    this.damageFlash.style.opacity = '0.5';
    this.damageTimer = 0.3;
  }

  updateDamageFlash(delta: number) {
    if (this.damageTimer > 0) {
      this.damageTimer -= delta;
      if (this.damageTimer <= 0) {
        this.damageFlash.style.opacity = '0';
        this.damageFlash.style.background = 'radial-gradient(ellipse at center, transparent 50%, rgba(255,0,0,0.4))';
      }
    }
  }

  private updateMinimap(data: {
    playerX: number;
    playerZ: number;
    playerRotation: number;
    enemies: { x: number; z: number; type: string }[];
    vehicles: { x: number; z: number }[];
    missionMarkers: { x: number; z: number; color: string }[];
  }) {
    const ctx = this.minimapCtx;
    const w = 180;
    const h = 180;
    const scale = 0.09;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Draw roads
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 2;
    const offset = 480 * scale;
    const blockSize = 60 * scale;

    for (let i = 0; i <= 16; i++) {
      const pos = i * blockSize - offset;
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(cx - 960 * scale, cy + pos);
      ctx.lineTo(cx + 960 * scale, cy + pos);
      ctx.stroke();
      // Vertical
      ctx.beginPath();
      ctx.moveTo(cx + pos, cy - 960 * scale);
      ctx.lineTo(cx + pos, cy + 960 * scale);
      ctx.stroke();
    }

    // Draw mission markers
    for (const marker of data.missionMarkers) {
      const dx = (marker.x - data.playerX) * scale;
      const dz = (marker.z - data.playerZ) * scale;
      ctx.fillStyle = marker.color;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dz, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw vehicles
    for (const v of data.vehicles) {
      const dx = (v.x - data.playerX) * scale;
      const dz = (v.z - data.playerZ) * scale;
      if (Math.abs(dx) < 90 && Math.abs(dz) < 90) {
        ctx.fillStyle = '#4488ff';
        ctx.fillRect(cx + dx - 2, cy + dz - 2, 4, 4);
      }
    }

    // Draw enemies
    for (const e of data.enemies) {
      const dx = (e.x - data.playerX) * scale;
      const dz = (e.z - data.playerZ) * scale;
      if (Math.abs(dx) < 90 && Math.abs(dz) < 90) {
        ctx.fillStyle = e.type === 'police' ? '#4444ff' : '#ff4444';
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dz, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw player (center, with direction)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-data.playerRotation + Math.PI);

    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Border
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
  }

  destroy() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
