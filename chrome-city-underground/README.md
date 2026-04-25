# CHROME CITY: UNDERGROUND

An open-world action game combining GTA: San Andreas, Call of Duty, and Need for Speed: Most Wanted — built with **Next.js** and **Three.js**.

## 🎮 Quick Start

### Prerequisites
- **Node.js** 18+ installed
- **npm** or **bun** package manager

### Installation

```bash
# 1. Navigate to the project folder
cd chrome-city-underground

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

### 4. Open in Browser
Go to **http://localhost:3000** and click to start playing!

---

## 🕹️ Controls

| Action | Key |
|---|---|
| Move | **W A S D** |
| Look Around | **Mouse** |
| Sprint | **Shift** |
| Jump | **Space** |
| Shoot | **Left Click** |
| Reload | **R** |
| Switch Weapon | **1-5** or **Scroll Wheel** |
| Enter/Exit Vehicle | **F** |
| Nitrous Boost (in vehicle) | **Shift** |
| Handbrake (in vehicle) | **Space** |

---

## 🌆 Game Features

- **Open World**: 4 districts — Downtown, Suburban, Industrial, Rural
- **Combat System**: 5 weapons (Pistol, SMG, Shotgun, Rifle, Sniper)
- **Vehicles**: 5 types with nitrous boost and drifting
- **Wanted System**: 5-star police escalation
- **Missions**: 5 story missions to complete
- **Day/Night Cycle** with dynamic weather (rain)
- **Full HUD**: Health, armor, stamina, minimap, speedometer, crosshair

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main game page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── game/
│   ├── GameEngine.ts     # Main game orchestrator
│   ├── Player.ts         # Player controller (FPS/TPS)
│   ├── Vehicle.ts        # Vehicle physics & types
│   ├── World.ts          # City generation
│   ├── Combat.ts         # Weapons & projectiles
│   ├── Police.ts         # Wanted system & police AI
│   ├── AI.ts             # Enemy & civilian AI
│   ├── Mission.ts        # Mission system
│   ├── Weather.ts        # Day/night & weather
│   ├── HUD.ts            # Full HUD system
│   ├── Input.ts          # Input handling
│   ├── Physics.ts        # Physics utilities
│   └── Utils.ts          # Shared utilities
└── components/ui/        # UI components
```

---

## ⚠️ Notes

- **First load** may take a few seconds as Three.js initializes
- Click the game canvas to **lock your mouse** and start playing
- Press **Escape** to release mouse lock
- Best played in **Chrome/Edge** for optimal WebGL performance
- The game uses **pointer lock** for FPS controls — make sure your browser supports it
