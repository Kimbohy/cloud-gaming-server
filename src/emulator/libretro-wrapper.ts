import * as path from 'path';

// Button mapping constants matching the C++ addon
export const RETRO_DEVICE_ID_JOYPAD_B = 0;
export const RETRO_DEVICE_ID_JOYPAD_Y = 1;
export const RETRO_DEVICE_ID_JOYPAD_SELECT = 2;
export const RETRO_DEVICE_ID_JOYPAD_START = 3;
export const RETRO_DEVICE_ID_JOYPAD_UP = 4;
export const RETRO_DEVICE_ID_JOYPAD_DOWN = 5;
export const RETRO_DEVICE_ID_JOYPAD_LEFT = 6;
export const RETRO_DEVICE_ID_JOYPAD_RIGHT = 7;
export const RETRO_DEVICE_ID_JOYPAD_A = 8;
export const RETRO_DEVICE_ID_JOYPAD_X = 9;
export const RETRO_DEVICE_ID_JOYPAD_L = 10;
export const RETRO_DEVICE_ID_JOYPAD_R = 11;

export const BUTTON_MAP: Record<string, number> = {
  B: RETRO_DEVICE_ID_JOYPAD_B,
  Y: RETRO_DEVICE_ID_JOYPAD_Y,
  SELECT: RETRO_DEVICE_ID_JOYPAD_SELECT,
  START: RETRO_DEVICE_ID_JOYPAD_START,
  UP: RETRO_DEVICE_ID_JOYPAD_UP,
  DOWN: RETRO_DEVICE_ID_JOYPAD_DOWN,
  LEFT: RETRO_DEVICE_ID_JOYPAD_LEFT,
  RIGHT: RETRO_DEVICE_ID_JOYPAD_RIGHT,
  A: RETRO_DEVICE_ID_JOYPAD_A,
  X: RETRO_DEVICE_ID_JOYPAD_X,
  L: RETRO_DEVICE_ID_JOYPAD_L,
  R: RETRO_DEVICE_ID_JOYPAD_R,
};

interface NativeLibretroCore {
  loadCore(corePath: string): boolean;
  loadGame(romPath: string): boolean;
  runFrame(): void;
  getFrameBuffer(): Buffer | null;
  getAudioBuffer(): Buffer | null;
  setInput(button: number, pressed: boolean): void;
  getFrameWidth(): number;
  getFrameHeight(): number;
  clearAudioBuffer(): void;
}

let LibretroCoreClass: new () => NativeLibretroCore;

try {
  // Try to load the native addon
  const addonPath = path.join(
    __dirname,
    '../../build/Release/libretro_addon.node',
  );
  let addon;
  try {
    addon = require(addonPath);
  } catch {
    // Try alternative name
    const altPath = path.join(
      __dirname,
      '../../build/Release/retro_addon.node',
    );
    addon = require(altPath);
  }
  LibretroCoreClass = addon.LibretroCore;
} catch (error) {
  console.warn('Native libretro addon not available:', error.message);
  console.warn('Falling back to mock implementation');

  // Provide a mock implementation for development
  LibretroCoreClass = class MockLibretroCore implements NativeLibretroCore {
    loadCore(): boolean {
      return true;
    }
    loadGame(): boolean {
      return true;
    }
    runFrame(): void {}
    getFrameBuffer(): Buffer | null {
      return null;
    }
    getAudioBuffer(): Buffer | null {
      return null;
    }
    setInput(): void {}
    getFrameWidth(): number {
      return 240;
    }
    getFrameHeight(): number {
      return 160;
    }
    clearAudioBuffer(): void {}
  };
}

export class LibretroCore {
  private core: NativeLibretroCore;
  private isLoaded = false;

  constructor() {
    this.core = new LibretroCoreClass();
  }

  loadCore(corePath: string): boolean {
    const result = this.core.loadCore(corePath);
    if (result) {
      this.isLoaded = true;
    }
    return result;
  }

  loadGame(romPath: string): boolean {
    if (!this.isLoaded) {
      throw new Error('Core not loaded. Call loadCore() first.');
    }
    return this.core.loadGame(romPath);
  }

  runFrame(): void {
    this.core.runFrame();
  }

  getFrameBuffer(): Buffer | null {
    return this.core.getFrameBuffer();
  }

  getAudioBuffer(): Buffer | null {
    return this.core.getAudioBuffer();
  }

  setInput(button: string, pressed: boolean): void {
    const buttonId = BUTTON_MAP[button.toUpperCase()];
    console.log(
      `[LibretroCore] setInput: button=${button}, buttonId=${buttonId}, pressed=${pressed}`,
    );
    if (buttonId !== undefined) {
      this.core.setInput(buttonId, pressed);
      console.log(`[LibretroCore] Input sent to native addon`);
    } else {
      console.warn(`[LibretroCore] Unknown button: ${button}`);
    }
  }

  getFrameWidth(): number {
    return this.core.getFrameWidth();
  }

  getFrameHeight(): number {
    return this.core.getFrameHeight();
  }

  clearAudioBuffer(): void {
    this.core.clearAudioBuffer();
  }
}
