/**
 * Shared type definitions for the RehaPiano rehabilitation game.
 *
 * Contains all interfaces and enums used across the game, including
 * game state management, physics, rendering, and doctor-configured
 * rehabilitation settings.
 *
 * @module types
 */

/**
 * Represents the possible states of the game's finite state machine.
 */
export enum GameState {
    /** Initial loading state while assets are being fetched. */
    Loading,
    /** Splash/title screen shown before gameplay begins. */
    SplashScreen,
    /** Active gameplay state where the player controls the bird. */
    Playing,
    /** Transition state while the death animation plays. */
    PlayerDying,
    /** Player has fully died; awaiting score screen. */
    PlayerDead,
    /** Final score screen displaying results and high score. */
    ScoreScreen,
}

/**
 * Physics properties governing the bird's flight behaviour.
 */
export interface FlyingProperties {
    /** Downward acceleration applied each physics tick (px/frame²). */
    gravity: number;
    /** Upward velocity applied on jump / sensor input (px/frame). */
    jumpVelocity: number;
    /** The rectangular area within which the bird is allowed to fly. */
    flightAreaBox: BoundingBox;
}

/**
 * Axis-aligned bounding box used for positioning and collision detection.
 */
export interface BoundingBox {
    /** Left edge position in pixels. */
    x: number;
    /** Top edge position in pixels. */
    y: number;
    /** Width in pixels. */
    width: number;
    /** Height in pixels. */
    height: number;
}

/**
 * References to the DOM elements required by the game renderer.
 */
export interface GameHtmlElements {
    /** The player-controlled bird sprite element. */
    bird: HTMLElement;
    /** The scrolling ground/land element. */
    land: HTMLElement;
    /** The rectangular area where the bird can fly and pipes appear. */
    flightArea: HTMLElement;
    /** The replay/restart button shown on the score screen. */
    replayButton: HTMLElement;
    /** Large score display shown on the score screen. */
    bigScore: HTMLElement;
    /** In-game score counter displayed during play. */
    currentScore: HTMLElement;
    /** High score display shown on the score screen. */
    highScore: HTMLElement;
}

/**
 * Configuration options passed to the Game constructor.
 */
export interface GameOptions {
    /** Whether the visual debug overlay is enabled. */
    isDebugOn: boolean;
    /** Whether easy mode (wider gaps, slower pipes) is active. */
    isEasyModeOn: boolean;
    /** WebSocket URL for the RehaPiano sensor bridge server. */
    rehaPianoUrl?: string;
    /** Sensor threshold for hand pressure detection (minimum force to register input). */
    rehaPianoThreshold?: number;
    /** Scaling factor converting raw sensor force to in-game velocity. */
    rehaPianoScale?: number;
    /** Whether RehaPiano sensor input is enabled. */
    rehaPianoEnabled?: boolean;
    /** Doctor-configured rehabilitation settings for the current patient session. */
    doctorSettings?: DoctorSettings;
}

/**
 * Rehabilitation settings configured by the supervising doctor/therapist.
 *
 * These settings control which hand(s) and fingers are exercised,
 * sensor sensitivity, game difficulty, progression curves, and
 * session timing for patient safety.
 */
export interface DoctorSettings {
    // --- Hand selection ---

    /** Which hand the patient is exercising: left, right, or both. */
    activeHand: 'left' | 'right' | 'both';
    /**
     * Per-finger activation flags for each hand.
     * Index order: [little, ring, middle, index, thumb].
     */
    activeFingers: {
        /** Finger activation for the left hand. */
        left: [boolean, boolean, boolean, boolean, boolean];
        /** Finger activation for the right hand. */
        right: [boolean, boolean, boolean, boolean, boolean];
    };

    // --- Sensitivity ---

    /** Minimum sensor force required to register input (range 1–50, default 5). */
    minimumForce: number;
    /** Scaling factor from sensor force to game velocity (range 0.001–0.05, default 0.01). */
    responseStrength: number;
    /** Maximum upward velocity cap to prevent excessive movement (range 0.2–2.0, default 0.5). */
    maximumSpeed: number;

    // --- Starting difficulty ---

    /** Vertical gap between upper and lower pipes in pixels (range 80–200, default 140). */
    gapSize: number;
    /** Time delay between pipe spawns in milliseconds (range 1500–8000, default 5000). */
    obstacleFrequency: number;

    // --- Progression ---

    /** Number of points scored before the difficulty level increases (range 2–20, default 5). */
    pointsPerLevel: number;
    /**
     * Flags controlling which difficulty progression dimensions are active.
     * Each key maps to a rehabilitation exercise focus area.
     */
    enabledProgressions: {
        /** Increase required sustained force over time. */
        hand_tension: boolean;
        /** Decrease reaction window for inputs. */
        fast_reaction: boolean;
        /** Narrow pipe gaps requiring finer control. */
        precision_control: boolean;
        /** Increase pipe scroll speed. */
        speed_challenge: boolean;
        /** Lengthen play sessions before rest prompts. */
        endurance: boolean;
        /** Require alternating hands/fingers. */
        coordination: boolean;
        /** Target individual finger activation. */
        fine_motor: boolean;
        /** Widen the required force range. */
        range_of_motion: boolean;
    };
    /** Maximum difficulty level cap to prevent overwhelming the patient (range 1–100, default 50). */
    maxDifficultyLevel: number;

    // --- Session ---

    /** Session time limit in minutes (0 = unlimited; valid: 5, 10, 15, 20). */
    timeLimitMinutes: number;
    /** Interval for rest reminders in minutes (0 = disabled; valid: 3, 5, 10). */
    restReminderMinutes: number;
}
