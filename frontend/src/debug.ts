/**
 * Visual debugging overlay for the RehaPiano game.
 *
 * Provides on-screen bounding box rendering, state change logging, and
 * a timestamped console/DOM log. Intended for development and QA only;
 * all operations are no-ops when debugging is disabled.
 *
 * @module debug
 */

import { GameState } from './types';
import type { BoundingBox } from './types';

/**
 * Visual debugging overlay that renders bounding boxes and logs game events.
 *
 * When enabled, draws collision boxes on screen and maintains a scrolling
 * log of game state transitions and arbitrary debug messages. All public
 * methods short-circuit immediately when debugging is disabled, so the
 * debugger can be left wired in without performance impact in production.
 */
export class GameDebugger {
    protected enabled;
    protected domLogs = document.getElementById('debug-logs')!;
    protected domState = document.getElementById('debug-state')!;
    protected domBoxContainer = document.getElementById('debug')!;
    protected domBoxes = new Map<HTMLElement, HTMLDivElement>();

    constructor(enabled: boolean) {
        this.enabled = enabled;
    }

    /**
     * Draws or updates a debug bounding box overlay for a given DOM element.
     *
     * Creates the overlay `<div>` on first call for each key and repositions
     * it on subsequent calls.
     *
     * @param key - The DOM element to associate the debug box with.
     * @param box - The bounding box coordinates and dimensions to render.
     */
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

    /**
     * Removes all debug bounding boxes associated with pipe elements.
     *
     * Called when pipes are reset (e.g., on game restart) to clean up
     * stale overlays.
     */
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

    /**
     * Logs a game state transition and updates the on-screen state label.
     *
     * @param oldState - The state being transitioned from.
     * @param newState - The state being transitioned to.
     */
    public logStateChange(oldState: GameState, newState: GameState) {
        if (!this.enabled) {
            return;
        }

        this.log('Changing state', GameState[oldState], GameState[newState]);
        this.domState.innerText = GameState[newState];
    }

    /**
     * Logs a timestamped debug message to both the browser console and the
     * on-screen debug log panel.
     *
     * @param args - Values to log (converted to strings for DOM display).
     */
    public log(...args: unknown[]) {
        if (!this.enabled) {
            return;
        }

        const shortTime = ('00000' + (Date.now() % 100000)).slice(-5);
        console.log(`[${shortTime}]`, ...args);
        this.domLogs.innerText += `[${shortTime}] ${args.map((a) => (a as { toString(): string })?.toString()).join(' ')}\n`;
    }
}

/**
 * Singleton {@link GameDebugger} instance.
 *
 * Must be initialized via {@link initGameDebugger} before use.
 * Imported by other modules that need to log debug information.
 */
export let gameDebugger: GameDebugger;

/**
 * Initializes the singleton {@link gameDebugger} instance.
 *
 * Must be called once at application startup (in `main.ts`) before
 * any game classes that depend on `gameDebugger` are constructed.
 *
 * @param enabled - Whether visual debugging should be active.
 */
export function initGameDebugger(enabled: boolean): void {
    gameDebugger = new GameDebugger(enabled);
}
