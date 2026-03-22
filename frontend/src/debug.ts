import { GameState } from './types';
import type { BoundingBox } from './types';

export class GameDebugger {
    protected enabled;
    protected domLogs = document.getElementById('debug-logs')!;
    protected domState = document.getElementById('debug-state')!;
    protected domBoxContainer = document.getElementById('debug')!;
    protected domBoxes = new Map<HTMLElement, HTMLDivElement>();

    constructor(enabled: boolean) {
        this.enabled = enabled;
    }

    public drawBox(key: HTMLElement, box: BoundingBox) {
        if (!this.enabled) {
            return;
        }

        if (!this.domBoxes.has(key)) {
            const newDebugBox = document.createElement('div');
            newDebugBox.className = 'boundingbox';
            this.domBoxContainer.appendChild(newDebugBox);
            this.domBoxes.set(key, newDebugBox);
        }

        const boudingBox = this.domBoxes.get(key);

        if (boudingBox == null) {
            this.log(`couldn't create a debug box for ${key}`);
            return;
        }

        boudingBox.style.top = `${box.y}px`;
        boudingBox.style.left = `${box.x}px`;
        boudingBox.style.width = `${box.width}px`;
        boudingBox.style.height = `${box.height}px`;
    }

    public resetBoxes() {
        if (!this.enabled) {
            return;
        }

        this.domBoxes.forEach((debugBox, pipe) => {
            if (pipe.className.includes('pipe')) {
                debugBox.remove();
                this.domBoxes.delete(pipe);
            }
        });
    }

    public logStateChange(oldState: GameState, newState: GameState) {
        if (!this.enabled) {
            return;
        }

        this.log('Changing state', GameState[oldState], GameState[newState]);
        this.domState.innerText = GameState[newState];
    }

    public log(...args: unknown[]) {
        if (!this.enabled) {
            return;
        }

        const shortTime = ("00000" + Date.now() % 100000).slice(-5);
        console.log(`[${shortTime}]`, ...args);
        this.domLogs.innerText += `[${shortTime}] ${args.map(a => (a as { toString(): string })?.toString()).join(' ')}\n`;
    }
}

// Singleton instance — initialized by initGameDebugger() in main.ts before any game classes are constructed
export let gameDebugger: GameDebugger;

export function initGameDebugger(enabled: boolean): void {
    gameDebugger = new GameDebugger(enabled);
}
