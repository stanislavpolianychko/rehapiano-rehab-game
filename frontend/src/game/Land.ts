/**
 * @file Land.ts
 * Ground/land obstacle that marks the lower boundary of the play area.
 */

import type { BoundingBox } from '../types';
import { isBoxIntersecting } from '../utils';
import { gameDebugger } from '../debug';

/**
 * Represents the ground surface at the bottom of the game area.
 * Collision with the land triggers a game-over event.
 */
export class Land {
    public domElement: HTMLElement;
    public box: BoundingBox;

    constructor(domElement: HTMLElement) {
        this.domElement = domElement;
        this.box = domElement.getBoundingClientRect();

        gameDebugger.drawBox(this.domElement, this.box);
    }

    /**
     * Tests whether the given bounding box intersects with the land surface.
     * @param box - The bounding box to test (typically the bird's box).
     * @returns `true` if the boxes overlap.
     */
    public intersectsWith(box: BoundingBox) {
        return isBoxIntersecting(this.box, box);
    }
}
