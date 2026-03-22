/**
 * @file Bird.ts
 * Player-controlled bird entity for the RehaPiano rehabilitation game.
 * Unlike traditional Flappy Bird where the player taps to jump, this bird
 * uses continuous pressure input from the RehaPiano device (or keyboard
 * fallback) to control vertical movement, supporting rehabilitation exercises.
 */

import type { FlyingProperties, BoundingBox } from '../types';
import { sounds } from '../Assets';
import { wait, toRad } from '../utils';
import { gameDebugger } from '../debug';

/**
 * Represents the player-controlled bird entity.
 *
 * The bird's vertical movement is driven by {@link controlVelocity}, which is
 * set externally each frame based on RehaPiano sensor data or keyboard input.
 * This replaces the traditional jump mechanic with continuous proportional
 * control, allowing the game to serve as a hand rehabilitation exercise where
 * patients practise graded finger extension and compression.
 */
export class Bird {
    protected domElement: HTMLElement;
    protected flyingProperties: FlyingProperties;
    protected width!: number;
    protected height!: number;
    protected velocity!: number;
    protected position!: number;
    protected rotation!: number;
    protected controlVelocity: number = 0;
    public box!: BoundingBox;

    /**
     * @param domElement - The DOM element representing the bird sprite.
     * @param flyingProperties - Flight area boundaries and physics parameters.
     */
    constructor(domElement: HTMLElement, flyingProperties: FlyingProperties) {
        this.domElement = domElement;
        this.flyingProperties = flyingProperties;
        this.reset();
    }

    /** Resets the bird to its initial position, velocity, and bounding box. */
    public reset() {
        this.width = 34;
        this.height = 24;
        this.velocity = 0;
        this.position = 180;
        this.rotation = 0;
        this.controlVelocity = 0;
        this.box = { x: 60, y: 180, width: 34, height: 24 };
    }

    /** Intentionally disabled — continuous control via {@link setControlVelocity} is used instead. */
    public jump() {
        // Jump is disabled - using continuous control instead
    }

    /**
     * Sets the bird's vertical control velocity for the current frame.
     * Positive values move the bird down (compression), negative values move it up (extension).
     * @param velocity - Target velocity derived from RehaPiano sensor data or keyboard input.
     */
    public setControlVelocity(velocity: number): void {
        this.controlVelocity = velocity;
    }

    /** Plays the death animation and sound effects. Awaits until the animation completes. */
    public async die() {
        this.domElement.style.transition = `
            transform 1s cubic-bezier(0.65, 0, 0.35, 1)
        `;
        this.position = this.flyingProperties.flightAreaBox.height - this.height;
        this.rotation = 90;

        sounds.hit.play();
        await wait(500);
        sounds.die.play();
        await wait(500);
        this.domElement.style.transition = '';
    }

    /**
     * Advances the bird's physics by one simulation step.
     * Applies the current {@link controlVelocity}, clamps position within the
     * flight area, and recalculates the rotation-adjusted bounding box.
     */
    public tick() {
        // No gravity — bird position is driven entirely by the control input
        // from either the RehaPiano gloves or the keyboard fallback.
        this.velocity = this.controlVelocity;

        // Rotate the bird sprite based on velocity direction:
        // positive velocity (moving down) → clockwise rotation, capped at 90 degrees.
        this.rotation = Math.min((this.velocity / 10) * 90, 90);
        this.position += this.velocity;

        // Clamp position within the flight area boundaries
        if (this.position < 0) {
            this.position = 0;
        }

        if (this.position > this.flyingProperties.flightAreaBox.height) {
            this.position = this.flyingProperties.flightAreaBox.height;
        }

        // Recalculate the AABB (Axis-Aligned Bounding Box) to account for rotation.
        // The bird sprite is 34px wide and 24px tall. When rotated, the effective
        // bounding rectangle changes shape. We compute the rotated dimensions using
        // trigonometry: as the bird tilts, it becomes narrower and taller.
        const rotationInRadians = Math.abs(toRad(this.rotation));
        const widthMultiplier = this.height - this.width; // 24 - 34 = -10
        const heightMultiplier = this.width - this.height; // 34 - 24 = +10

        this.box.width = this.width + widthMultiplier * Math.sin(rotationInRadians);
        this.box.height = this.height + heightMultiplier * Math.sin(rotationInRadians);

        // Shift the box position to keep it centered on the bird sprite
        // as the dimensions change due to rotation.
        const xShift = (this.width - this.box.width) / 2;
        const yShift = (this.height - this.box.height) / 2;

        // 60px is the bird's fixed horizontal offset from the left edge
        this.box.x = 60 + xShift;
        // Position is relative to the flight area; add the flight area's top offset
        // so the bounding box is in absolute page coordinates for collision detection.
        this.box.y = this.position + yShift + this.flyingProperties.flightAreaBox.y;
    }

    /** Renders the bird's current position and rotation to the DOM via CSS transforms. */
    public draw() {
        gameDebugger.drawBox(this.domElement, this.box);

        this.domElement.style.transform = `
            translate3d(0px, ${this.position}px, 0px)
            rotate3d(0, 0, 1, ${this.rotation}deg)
        `;
    }
}
