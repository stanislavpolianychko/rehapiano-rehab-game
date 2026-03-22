/**
 * @file PipeManager.ts
 * Manages the lifecycle of pipe obstacles: spawning, scrolling, pruning, and collision detection.
 */

import type { BoundingBox } from '../types';
import { Pipe } from './Pipe';
import { gameDebugger } from '../debug';

/**
 * Manages the pool of {@link Pipe} obstacles in the game.
 *
 * Pipes are spawned at a configurable interval ({@link pipeDelay}) with a
 * configurable gap ({@link currentGap}). Both values are dynamically adjusted
 * by the {@link LevelProgression} system as the player advances, enabling
 * rehabilitation-focused difficulty scaling (e.g., narrower gaps for precision
 * control exercises, shorter delays for reaction training).
 */
export class PipeManager {
    protected pipeAreaDomElement: HTMLElement;
    protected pipeDelay = 5000;
    protected lastPipeInsertedTimestamp = 0;
    protected pipes: Pipe[] = [];
    protected easyMode;
    protected currentGap: number = 140;

    /**
     * @param pipeAreaDomElement - Container element where pipe DOM nodes are appended.
     * @param easyMode - When `true`, uses a wider default gap for easier gameplay.
     */
    constructor(pipeAreaDomElement: HTMLElement, easyMode: boolean = false) {
        this.pipeAreaDomElement = pipeAreaDomElement;
        this.easyMode = easyMode;
        this.currentGap = easyMode ? 140 : 90;
    }

    /**
     * Sets the minimum time between pipe spawns.
     * @param delay - Delay in milliseconds. Reduced by the level progression system for reaction training.
     */
    public setPipeDelay(delay: number): void {
        this.pipeDelay = delay;
    }

    /**
     * Sets the vertical gap between upper and lower pipe segments.
     * @param gap - Gap size in pixels. Reduced by the level progression system for precision exercises.
     */
    public setPipeGap(gap: number): void {
        this.currentGap = gap;
    }

    /**
     * Advances all pipes by one simulation step: updates positions, spawns new
     * pipes when the delay has elapsed, and prunes off-screen pipes.
     * @param now - Current timestamp in milliseconds (from `Date.now()`).
     */
    public tick(now: number) {
        this.pipes.forEach((pipe) => pipe.tick());

        if (now - this.lastPipeInsertedTimestamp < this.pipeDelay) {
            return;
        }

        gameDebugger.log('inserting pipe after', now - this.lastPipeInsertedTimestamp, 'ms');
        this.lastPipeInsertedTimestamp = now;
        const pipeDimension = this.createPipeDimensions({
            gap: this.currentGap,
        });
        const pipe = new Pipe(pipeDimension);
        this.pipes.push(pipe);
        this.pipeAreaDomElement.appendChild(pipe.domElement);

        this.pipes = this.pipes.filter((pipe) => {
            if (pipe.isOffScreen()) {
                gameDebugger.log('pruning a pipe');
                pipe.domElement.remove();
                return false;
            }

            return true;
        });
    }

    /**
     * Tests whether any active pipe collides with the given bounding box.
     * @param box - The bounding box to test (typically the bird's box).
     * @returns `true` if a collision is detected with any pipe.
     */
    public intersectsWith(box: BoundingBox) {
        return this.pipes.find((pipe) => pipe.intersectsWith(box)) != null;
    }

    /** Removes all pipes from the DOM and clears the internal pipe array. */
    public removeAll() {
        this.pipes.forEach((pipe) => pipe.domElement.remove());
        this.pipes = [];
    }

    /**
     * @returns The first pipe the player has not yet scored on, or `undefined` if none exist.
     */
    public nextUnscoredPipe() {
        return this.pipes.find((pipe) => pipe.scored === false);
    }

    protected createPipeDimensions(options: { gap: number }) {
        const topPipeBuffer = 80;
        const bottomPipeBuffer = 420 - options.gap - topPipeBuffer;
        const topPipeHeight = this.randomNumberBetween(topPipeBuffer, bottomPipeBuffer);
        const bottomPipeHeight = 420 - options.gap - topPipeHeight;
        return { topPipeHeight, bottomPipeHeight };
    }

    protected randomNumberBetween(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}
