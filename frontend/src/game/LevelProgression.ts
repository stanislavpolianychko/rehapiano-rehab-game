import type { DoctorSettings } from '../types';

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

        this.PROGRESSION_TYPES = (Object.keys(this.enabledProgressions) as ProgressionType[])
            .filter(key => this.enabledProgressions[key]);
    }

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

    public getLevel(): number {
        return this.currentLevel;
    }

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
                description = "Great job! The game will gradually become more challenging. You'll adapt step by step!";
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
                description
            };
        }

        return {
            progressed: false,
            level: this.currentLevel
        };
    }

    protected selectRandomProgressionType(): ProgressionType {
        const randomIndex = Math.floor(Math.random() * this.PROGRESSION_TYPES.length);
        return this.PROGRESSION_TYPES[randomIndex];
    }

    protected getProgressionMessage(type: ProgressionType, stepCount: number): { message: string; description: string } {
        const level = this.currentLevel;

        switch (type) {
            case 'hand_tension':
                return {
                    message: `Level ${level}: More Hand Tension`,
                    description: `Step ${stepCount}: You'll need to press/extend your hand with more force to move the bird. Build your strength gradually!`
                };

            case 'fast_reaction': {
                const delay = Math.round(this.getPipeDelay() / 1000);
                return {
                    message: `Level ${level}: Fast Reaction`,
                    description: `Step ${stepCount}: Barriers will appear more often (every ${delay}s). React quickly and stay alert!`
                };
            }

            case 'precision_control': {
                const gap = Math.round(this.getPipeGap());
                return {
                    message: `Level ${level}: Precision Control`,
                    description: `Step ${stepCount}: Openings are getting narrower (${gap}px). Move with precision and control!`
                };
            }

            case 'speed_challenge':
                return {
                    message: `Level ${level}: Speed Challenge`,
                    description: `Step ${stepCount}: Movement response is faster. Practice smooth, controlled movements!`
                };

            case 'endurance':
                return {
                    message: `Level ${level}: Endurance Training`,
                    description: `Step ${stepCount}: Longer sessions ahead. Build your endurance and maintain steady control!`
                };

            case 'coordination':
                return {
                    message: `Level ${level}: Hand Coordination`,
                    description: `Step ${stepCount}: Practice using both extension and compression. Coordinate your movements smoothly!`
                };

            case 'fine_motor':
                return {
                    message: `Level ${level}: Fine Motor Control`,
                    description: `Step ${stepCount}: Smaller, more precise movements are needed. Focus on fine motor skills!`
                };

            case 'range_of_motion':
                return {
                    message: `Level ${level}: Full Range of Motion`,
                    description: `Step ${stepCount}: Use full extension and compression. Expand your range of motion gradually!`
                };

            default:
                return {
                    message: `Level ${level}`,
                    description: "Keep going! The challenge continues to grow gradually."
                };
        }
    }

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

    public getAccelerationRate(): number {
        const baseRate = 0.05;

        const speedSteps = this.activeProgressions.get('speed_challenge') || 0;
        if (speedSteps > 0) {
            const reduction = speedSteps * this.ACCELERATION_RATE_REDUCTION_PER_STEP;
            return Math.max(0.02, baseRate - reduction);
        }

        return baseRate;
    }

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

    public getActiveProgressions(): ProgressionType[] {
        return Array.from(this.activeProgressions.keys());
    }

    public reset(): void {
        this.currentLevel = 0;
        this.lastProgressionScore = 0;
        this.activeProgressions.clear();
    }
}
