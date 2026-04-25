export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
  enterVehicle: boolean;
  interact: boolean;
  shoot: boolean;
  aim: boolean;
  reload: boolean;
  tab: boolean;
  switchView: boolean;
  honk: boolean;
  handbrake: boolean;
  nitrous: boolean;
  help: boolean;
  enterPressed: boolean;
  mouseX: number;
  mouseY: number;
  mouseDeltaX: number;
  mouseDeltaY: number;
  numberKeys: number[];
  scrollDelta: number;
}

export class InputManager {
  state: InputState;
  private keys: Set<string> = new Set();
  private prevKeys: Set<string> = new Set();
  private pointerLocked = false;
  private canvas: HTMLCanvasElement | null = null;

  constructor() {
    this.state = this.createDefaultState();
  }

  private createDefaultState(): InputState {
    return {
      forward: false, backward: false, left: false, right: false,
      sprint: false, jump: false, crouch: false,
      enterVehicle: false, interact: false,
      shoot: false, aim: false, reload: false,
      tab: false, switchView: false, honk: false,
      handbrake: false, nitrous: false, help: false,
      enterPressed: false,
      mouseX: 0, mouseY: 0,
      mouseDeltaX: 0, mouseDeltaY: 0,
      numberKeys: [], scrollDelta: 0,
    };
  }

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('wheel', this.onWheel);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    canvas.addEventListener('click', () => {
      if (!document.pointerLockElement) {
        canvas.requestPointerLock();
      }
    });
  }

  destroy() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    e.preventDefault();
  };

  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement) {
      this.state.mouseDeltaX += e.movementX;
      this.state.mouseDeltaY += e.movementY;
    }
    this.state.mouseX = e.clientX;
    this.state.mouseY = e.clientY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.keys.add('Mouse0');
    if (e.button === 2) this.keys.add('Mouse2');
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.keys.delete('Mouse0');
    if (e.button === 2) this.keys.delete('Mouse2');
  };

  private onWheel = (e: WheelEvent) => {
    this.state.scrollDelta += e.deltaY;
  };

  private onPointerLockChange = () => {
    this.pointerLocked = !!document.pointerLockElement;
  };

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  update() {
    const k = this.keys;
    const pk = this.prevKeys;

    this.state.forward = k.has('KeyW') || k.has('ArrowUp');
    this.state.backward = k.has('KeyS') || k.has('ArrowDown');
    this.state.left = k.has('KeyA') || k.has('ArrowLeft');
    this.state.right = k.has('KeyD') || k.has('ArrowRight');
    this.state.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    this.state.jump = k.has('Space') && !pk.has('Space');
    this.state.crouch = k.has('KeyC');
    this.state.enterVehicle = k.has('KeyE') && !pk.has('KeyE');
    this.state.interact = k.has('KeyF') && !pk.has('KeyF');
    this.state.shoot = k.has('Mouse0');
    this.state.aim = k.has('Mouse2');
    this.state.reload = k.has('KeyR') && !pk.has('KeyR');
    this.state.tab = k.has('Tab') && !pk.has('Tab');
    this.state.switchView = k.has('KeyV') && !pk.has('KeyV');
    this.state.honk = k.has('KeyR');
    this.state.handbrake = k.has('Space');
    this.state.nitrous = k.has('ShiftLeft') || k.has('ShiftRight');
    this.state.help = k.has('KeyH') && !pk.has('KeyH');
    this.state.enterPressed = k.has('Enter') && !pk.has('Enter');

    this.state.numberKeys = [];
    for (let i = 1; i <= 5; i++) {
      if (k.has(`Digit${i}`) && !pk.has(`Digit${i}`)) {
        this.state.numberKeys.push(i);
      }
    }

    this.prevKeys = new Set(k);
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.state.mouseDeltaX;
    const dy = this.state.mouseDeltaY;
    this.state.mouseDeltaX = 0;
    this.state.mouseDeltaY = 0;
    return { dx, dy };
  }

  consumeScroll(): number {
    const s = this.state.scrollDelta;
    this.state.scrollDelta = 0;
    return s;
  }
}
