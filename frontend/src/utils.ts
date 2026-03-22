/**
 * General-purpose utility functions for the RehaPiano game.
 *
 * Includes timing helpers, math conversions, and collision detection.
 *
 * @module utils
 */

import type { BoundingBox } from './types';

/**
 * Returns a promise that resolves after the specified delay.
 *
 * @param time - Delay in milliseconds.
 * @returns A promise that resolves after {@link time} ms.
 */
export const wait = async (time: number): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
};

/**
 * Converts an angle from degrees to radians.
 *
 * @param degrees - The angle in degrees.
 * @returns The angle in radians.
 */
export const toRad = (degrees: number): number => {
    return (degrees * Math.PI) / 180;
};

/**
 * Checks whether two axis-aligned bounding boxes overlap.
 *
 * Used for collision detection between the bird and pipes/ground.
 *
 * @param a - The first bounding box.
 * @param b - The second bounding box.
 * @returns `true` if the boxes intersect, `false` otherwise.
 */
export const isBoxIntersecting = (a: BoundingBox, b: BoundingBox): boolean => {
    return (
        a.x <= b.x + b.width &&
        b.x <= a.x + a.width &&
        a.y <= b.y + b.height &&
        b.y <= a.y + a.height
    );
};
