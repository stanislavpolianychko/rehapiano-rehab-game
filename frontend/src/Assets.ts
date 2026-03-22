/**
 * Sound asset management for the RehaPiano game.
 *
 * Pre-loads all game sound effects using Howler.js so they can be
 * played instantly during gameplay without latency.
 *
 * @module Assets
 */

import { Howl } from 'howler';

/**
 * Pre-loaded sound effects used throughout the game.
 *
 * Each property is a Howler.js {@link Howl} instance ready for
 * immediate playback at a default volume of 0.3.
 */
export const sounds = {
    /** Wing flap sound played on each jump or sensor input. */
    jump: new Howl({ src: ['/assets/sounds/sfx_wing.ogg'], volume: 0.3 }),
    /** Chime played when the player passes through a pipe gap and scores a point. */
    score: new Howl({ src: ['/assets/sounds/sfx_point.ogg'], volume: 0.3 }),
    /** Impact sound played when the bird collides with a pipe. */
    hit: new Howl({ src: ['/assets/sounds/sfx_hit.ogg'], volume: 0.3 }),
    /** Death sound played when the bird hits the ground after a collision. */
    die: new Howl({ src: ['/assets/sounds/sfx_die.ogg'], volume: 0.3 }),
    /** Swoosh transition sound played during screen transitions. */
    swoosh: new Howl({ src: ['/assets/sounds/sfx_swooshing.ogg'], volume: 0.3 }),
};
