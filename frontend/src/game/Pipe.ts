/**
 * @file Pipe.ts
 * Single pipe obstacle consisting of an upper and lower segment with a navigable gap.
 */

import type { BoundingBox } from '../types';
import { isBoxIntersecting } from '../utils';
import { gameDebugger } from '../debug';

/**
 * Represents a pair of vertical pipe segments (upper and lower) that the bird
 * must fly between. The gap size is controlled by {@link PipeManager} and may
 * shrink as the difficulty level increases.
 */
export class Pipe {
    /** Whether the player has already been awarded a point for passing this pipe. */
    public scored = false;
    public domElement: HTMLDivElement;
    protected upperPipeDomElement: HTMLDivElement;
    protected lowerPipeDomElement: HTMLDivElement;
    protected upperBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };
    protected lowerBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };

    /**
     * @param options - Heights for the upper and lower pipe segments.
     * @param options.topPipeHeight - Height of the upper pipe in pixels.
     * @param options.bottomPipeHeight - Height of the lower pipe in pixels.
     */
    constructor(options: { topPipeHeight: number; bottomPipeHeight: number }) {
        this.domElement = document.createElement('div');
        this.domElement.className = 'pipe animated';

        this.upperPipeDomElement = document.createElement('div');
        this.upperPipeDomElement.className = 'pipe_upper';
        this.upperPipeDomElement.style.height = `${options.topPipeHeight}px`;

        this.lowerPipeDomElement = document.createElement('div');
        this.lowerPipeDomElement.className = 'pipe_lower';
        this.lowerPipeDomElement.style.height = `${options.bottomPipeHeight}px`;

        this.domElement.appendChild(this.upperPipeDomElement);
        this.domElement.appendChild(this.lowerPipeDomElement);
    }

    /** @returns `true` if the pipe has scrolled completely off the left edge of the screen. */
    public isOffScreen() {
        return this.upperBox.x <= -100;
    }

    /**
     * Checks whether the given bounding box has fully passed this pipe (used for scoring).
     * @param box - The bounding box to test against.
     * @returns `true` if the box's left edge is past the pipe's right edge.
     */
    public hasCrossed(box: BoundingBox) {
        return this.upperBox.width !== 0 && this.upperBox.x + this.upperBox.width <= box.x;
    }

    /**
     * Tests whether the given bounding box collides with either pipe segment.
     * @param box - The bounding box to test (typically the bird's box).
     * @returns `true` if a collision is detected.
     */
    public intersectsWith(box: BoundingBox) {
        return isBoxIntersecting(this.upperBox, box) || isBoxIntersecting(this.lowerBox, box);
    }

    /** Updates bounding boxes from the DOM and renders debug overlays. */
    public tick() {
        this.upperBox = this.upperPipeDomElement.getBoundingClientRect();
        this.lowerBox = this.lowerPipeDomElement.getBoundingClientRect();

        gameDebugger.drawBox(this.upperPipeDomElement, this.upperBox);
        gameDebugger.drawBox(this.lowerPipeDomElement, this.lowerBox);
    }
}
