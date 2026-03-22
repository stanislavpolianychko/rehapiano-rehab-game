/**
 * @file LevelProgression.ts
 * Rehabilitation-focused difficulty progression system.
 *
 * As the player scores points, the game gradually increases difficulty by
 * activating one or more progression types, each targeting a specific
 * therapeutic exercise goal. Doctors can configure which progressions are
 * enabled, the interval between level-ups, and baseline difficulty parameters.
 */

import type { DoctorSettings } from '../types';

/**
 * Identifies a category of difficulty progression, each mapping to a
 * rehabilitation exercise goal:
 *
 * - `hand_tension` — Increases required finger force, building hand strength.
 * - `fast_reaction` — Pipes appear more frequently, training reaction speed.
 * - `precision_control` — Narrows the pipe gap, requiring finer motor control.
 * - `speed_challenge` — Increases movement response speed for dynamic exercises.
 * - `endurance` — Subtly increases demands over longer sessions to build stamina.
 * - `coordination` — Encourages use of both extension and compression movements.
 * - `fine_motor` — Demands smaller, more precise movements.
 * - `range_of_motion` — Encourages full extension and compression range.
 */
export type ProgressionType =
    | 'hand_tension'
    | 'fast_reaction'
    | 'precision_control'
    | 'speed_challenge'
    | 'endurance'
    | 'coordination'
    | 'fine_motor'
    | 'range_of_motion';

export interface LevelProgressionOptions {
    progressionInterval?: number;
    maxLevel?: number;
    baseVelocity?: number;
    baseDelay?: number;
    baseGap?: number;
    enabledProgressions?: Partial<Record<ProgressionType, boolean>>;
}

/**
 * Manages rehabilitation-focused difficulty progression.
 *
 * Every {@link PROGRESSION_INTERVAL} points, the system randomly selects an
 * enabled {@link ProgressionType} and increments its step count. The
 * accumulated steps for each type are used to compute derived game parameters
 * (max control velocity, pipe delay, pipe gap, acceleration rate) that are
 * fed back into {@link PipeManager} and {@link Bird} each frame.
 *
 * Doctors can customise all baseline values and enable/disable individual
 * progression types via {@link fromDoctorSettings}.
 */
export class LevelProgression {
    protected readonly PROGRESSION_INTERVAL: number;
    protected readonly MAX_LEVEL: number;

    protected readonly BASE_VELOCITY: number;
    protected readonly BASE_DELAY: number;
    protected readonly BASE_GAP: number;

    protected readonly VELOCITY_REDUCTION_PER_STEP = 0.008;
    protected readonly DELAY_REDUCTION_PER_STEP = 40;
    protected readonly GAP_REDUCTION_PER_STEP = 1.5;
    protected readonly ACCELERATION_RATE_REDUCTION_PER_STEP = 0.002;

    protected readonly MIN_VELOCITY = 0.3;
    protected readonly MIN_DELAY = 2000;
    protected readonly MIN_GAP = 90;

    protected currentLevel: number = 0;
    protected lastProgressionScore: number = 0;

    protected activeProgressions: Map<ProgressionType, number> = new Map();

    protected readonly PROGRESSION_TYPES: ProgressionType[];
    protected readonly enabledProgressions: Record<ProgressionType, boolean>;

    /**
     * @param options - Optional overrides for progression intervals, caps, and base difficulty values.
     */
    constructor(options?: LevelProgressionOptions) {
        this.PROGRESSION_INTERVAL = options?.progressionInterval ?? 5;
        this.MAX_LEVEL = options?.maxLevel ?? 1000;
        this.BASE_VELOCITY = options?.baseVelocity ?? 0.5;
        this.BASE_DELAY = options?.baseDelay ?? 5000;
        this.BASE_GAP = options?.baseGap ?? 140;

        this.enabledProgressions = {
            hand_tension: true,
            fast_reaction: true,
            precision_control: true,
            speed_challenge: true,
            endurance: true,
            coordination: true,
            fine_motor: true,
            range_of_motion: true,
            ...options?.enabledProgressions,
        };

        this.PROGRESSION_TYPES = (
            Object.keys(this.enabledProgressions) as ProgressionType[]
        ).filter((key) => this.enabledProgressions[key]);
    }

    /**
     * Factory that creates a {@link LevelProgression} from doctor-prescribed settings.
     * @param settings - Configuration from the doctor's dashboard.
     * @returns A new instance tuned to the patient's therapeutic plan.
     */
    public static fromDoctorSettings(settings: DoctorSettings): LevelProgression {
        return new LevelProgression({
            progressionInterval: settings.pointsPerLevel,
            maxLevel: settings.maxDifficultyLevel,
            baseVelocity: settings.maximumSpeed,
            baseDelay: settings.obstacleFrequency,
            baseGap: settings.gapSize,
            enabledProgressions: settings.enabledProgressions,
        });
    }

    /** @returns The current difficulty level (starts at 0). */
    public getLevel(): number {
        return this.currentLevel;
    }

    /**
     * Checks whether the player's score warrants a level-up.
     * If so, selects a random enabled progression type, increments its step
     * count, and returns a user-facing message describing the new challenge.
     * @param score - The player's current score.
     * @returns An object indicating whether progression occurred, the new level,
     *          and optional UI message/description text.
     */
    public checkProgression(score: number): {
        progressed: boolean;
        level: number;
        progressionType?: ProgressionType;
        message?: string;
        description?: string;
    } {
        const scoreIncrease = score - this.lastProgressionScore;
        if (scoreIncrease >= this.PROGRESSION_INTERVAL) {
            this.currentLevel++;
            this.lastProgressionScore = score;

            let progressionType: ProgressionType | undefined;
            let message: string | undefined;
            let description: string | undefined;

            if (this.currentLevel === 1) {
                message = `Level ${this.currentLevel}: Getting Started`;
                description =
                    "Great job! The game will gradually become more challenging. You'll adapt step by step!";
            } else {
                progressionType = this.selectRandomProgressionType();

                const currentSteps = this.activeProgressions.get(progressionType) || 0;
                this.activeProgressions.set(progressionType, currentSteps + 1);

                const stepCount = this.activeProgressions.get(progressionType) || 1;
                const messageData = this.getProgressionMessage(progressionType, stepCount);
                message = messageData.message;
                description = messageData.description;
            }

            return {
                progressed: true,
                level: this.currentLevel,
                progressionType,
                message,
                description,
            };
        }

        return {
            progressed: false,
            level: this.currentLevel,
        };
    }

    protected selectRandomProgressionType(): ProgressionType {
        const randomIndex = Math.floor(Math.random() * this.PROGRESSION_TYPES.length);
        return this.PROGRESSION_TYPES[randomIndex];
    }

    protected getProgressionMessage(
        type: ProgressionType,
        stepCount: number,
    ): { message: string; description: string } {
        const level = this.currentLevel;

        switch (type) {
            case 'hand_tension':
                return {
                    message: `Level ${level}: More Hand Tension`,
                    description: `Step ${stepCount}: You'll need to press/extend your hand with more force to move the bird. Build your strength gradually!`,
                };

            case 'fast_reaction': {
                const delay = Math.round(this.getPipeDelay() / 1000);
                return {
                    message: `Level ${level}: Fast Reaction`,
                    description: `Step ${stepCount}: Barriers will appear more often (every ${delay}s). React quickly and stay alert!`,
                };
            }

            case 'precision_control': {
                const gap = Math.round(this.getPipeGap());
                return {
                    message: `Level ${level}: Precision Control`,
                    description: `Step ${stepCount}: Openings are getting narrower (${gap}px). Move with precision and control!`,
                };
            }

            case 'speed_challenge':
                return {
                    message: `Level ${level}: Speed Challenge`,
                    description: `Step ${stepCount}: Movement response is faster. Practice smooth, controlled movements!`,
                };

            case 'endurance':
                return {
                    message: `Level ${level}: Endurance Training`,
                    description: `Step ${stepCount}: Longer sessions ahead. Build your endurance and maintain steady control!`,
                };

            case 'coordination':
                return {
                    message: `Level ${level}: Hand Coordination`,
                    description: `Step ${stepCount}: Practice using both extension and compression. Coordinate your movements smoothly!`,
                };

            case 'fine_motor':
                return {
                    message: `Level ${level}: Fine Motor Control`,
                    description: `Step ${stepCount}: Smaller, more precise movements are needed. Focus on fine motor skills!`,
                };

            case 'range_of_motion':
                return {
                    message: `Level ${level}: Full Range of Motion`,
                    description: `Step ${stepCount}: Use full extension and compression. Expand your range of motion gradually!`,
                };

            default:
                return {
                    message: `Level ${level}`,
                    description: 'Keep going! The challenge continues to grow gradually.',
                };
        }
    }

    /**
     * Computes the maximum bird control velocity based on active hand_tension
     * and speed_challenge progression steps.
     * @returns The clamped maximum velocity value.
     */
    public getMaxControlVelocity(): number {
        let velocity = this.BASE_VELOCITY;

        const tensionSteps = this.activeProgressions.get('hand_tension') || 0;
        if (tensionSteps > 0) {
            const reduction = tensionSteps * this.VELOCITY_REDUCTION_PER_STEP;
            velocity = Math.max(this.MIN_VELOCITY, velocity - reduction);
        }

        const speedSteps = this.activeProgressions.get('speed_challenge') || 0;
        if (speedSteps > 0) {
            velocity = Math.min(velocity * 1.1, this.BASE_VELOCITY * 1.2);
        }

        return velocity;
    }

    /**
     * Computes the keyboard input acceleration rate, influenced by speed_challenge steps.
     * @returns The acceleration rate (lower = smoother but slower response).
     */
    public getAccelerationRate(): number {
        const baseRate = 0.05;

        const speedSteps = this.activeProgressions.get('speed_challenge') || 0;
        if (speedSteps > 0) {
            const reduction = speedSteps * this.ACCELERATION_RATE_REDUCTION_PER_STEP;
            return Math.max(0.02, baseRate - reduction);
        }

        return baseRate;
    }

    /**
     * Computes the pipe spawn delay based on fast_reaction and endurance steps.
     * @returns Delay in milliseconds, clamped to {@link MIN_DELAY}.
     */
    public getPipeDelay(): number {
        let delay = this.BASE_DELAY;

        const reactionSteps = this.activeProgressions.get('fast_reaction') || 0;
        if (reactionSteps > 0) {
            const reduction = reactionSteps * this.DELAY_REDUCTION_PER_STEP;
            delay = Math.max(this.MIN_DELAY, delay - reduction);
        }

        const enduranceSteps = this.activeProgressions.get('endurance') || 0;
        if (enduranceSteps > 0) {
            const reduction = enduranceSteps * (this.DELAY_REDUCTION_PER_STEP * 0.5);
            delay = Math.max(this.MIN_DELAY, delay - reduction);
        }

        return delay;
    }

    /**
     * Computes the vertical pipe gap based on precision_control and fast_reaction steps.
     * @returns Gap size in pixels, clamped to {@link MIN_GAP}.
     */
    public getPipeGap(): number {
        let gap = this.BASE_GAP;

        const precisionSteps = this.activeProgressions.get('precision_control') || 0;
        if (precisionSteps > 0) {
            const reduction = precisionSteps * this.GAP_REDUCTION_PER_STEP;
            gap = Math.max(this.MIN_GAP, gap - reduction);
        }

        const reactionSteps = this.activeProgressions.get('fast_reaction') || 0;
        if (reactionSteps > 0) {
            const reduction = reactionSteps * (this.GAP_REDUCTION_PER_STEP * 0.3);
            gap = Math.max(this.MIN_GAP, gap - reduction);
        }

        return gap;
    }

    /** @returns An array of progression types that have been activated at least once. */
    public getActiveProgressions(): ProgressionType[] {
        return Array.from(this.activeProgressions.keys());
    }

    /** Resets the progression state to level 0 with no active progressions. */
    public reset(): void {
        this.currentLevel = 0;
        this.lastProgressionScore = 0;
        this.activeProgressions.clear();
    }
}
