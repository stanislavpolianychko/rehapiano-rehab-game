namespace Floppy {
    export type ProgressionType = 
        | 'hand_tension'      // Requires more pressure to move
        | 'fast_reaction'     // Pipes appear more frequently
        | 'precision_control'  // Narrower gaps, requires precise movement
        | 'speed_challenge'   // Faster movement required
        | 'endurance'         // Longer sessions, more pipes
        | 'coordination'      // Requires both extension and compression
        | 'fine_motor'        // Smaller movements needed
        | 'range_of_motion';  // Full extension/compression required
    
    export class LevelProgression {
        // Progression thresholds - very slow pace
        protected readonly PROGRESSION_INTERVAL = 5; // Progress every 2 points
        protected readonly MAX_LEVEL = 1000; // Never-ending (very high cap)
        
        // Base values
        protected readonly BASE_VELOCITY = 0.5; // Starting max velocity
        protected readonly BASE_DELAY = 5000; // Starting delay (5 seconds)
        protected readonly BASE_GAP = 140; // Starting gap (wide, easy)
        
        // Progression increments (very gradual)
        protected readonly VELOCITY_REDUCTION_PER_STEP = 0.008; // 0.8% reduction per step
        protected readonly DELAY_REDUCTION_PER_STEP = 40; // 40ms reduction per step
        protected readonly GAP_REDUCTION_PER_STEP = 1.5; // 1.5px reduction per step
        protected readonly ACCELERATION_RATE_REDUCTION_PER_STEP = 0.002; // Slower acceleration
        
        // Minimums (safety limits)
        protected readonly MIN_VELOCITY = 0.3; // 30% of base
        protected readonly MIN_DELAY = 2000; // 2 seconds
        protected readonly MIN_GAP = 90; // Normal difficulty gap
        
        protected currentLevel: number = 0;
        protected lastProgressionScore: number = 0;
        
        // Track active progression types and their step counts
        protected activeProgressions: Map<ProgressionType, number> = new Map();
        
        // Available progression types (excluding first level)
        protected readonly PROGRESSION_TYPES: ProgressionType[] = [
            'hand_tension',
            'fast_reaction',
            'precision_control',
            'speed_challenge',
            'endurance',
            'coordination',
            'fine_motor',
            'range_of_motion'
        ];
        
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
            // Check if we should progress
            const scoreIncrease = score - this.lastProgressionScore;
            if (scoreIncrease >= this.PROGRESSION_INTERVAL) {
                this.currentLevel++;
                this.lastProgressionScore = score;
                
                let progressionType: ProgressionType | undefined;
                let message: string | undefined;
                let description: string | undefined;
                
                if (this.currentLevel === 1) {
                    // First level - welcome message
                    message = `Level ${this.currentLevel}: Getting Started`;
                    description = "Great job! The game will gradually become more challenging. You'll adapt step by step!";
                } else {
                    // Randomly select a progression type
                    progressionType = this.selectRandomProgressionType();
                    
                    // Increment step count for this progression type
                    const currentSteps = this.activeProgressions.get(progressionType) || 0;
                    this.activeProgressions.set(progressionType, currentSteps + 1);
                    
                    // Get user-friendly message for this progression type
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
            // Randomly select from available types
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
                
                case 'fast_reaction':
                    const delay = Math.round(this.getPipeDelay() / 1000);
                    return {
                        message: `Level ${level}: Fast Reaction`,
                        description: `Step ${stepCount}: Barriers will appear more often (every ${delay}s). React quickly and stay alert!`
                    };
                
                case 'precision_control':
                    const gap = Math.round(this.getPipeGap());
                    return {
                        message: `Level ${level}: Precision Control`,
                        description: `Step ${stepCount}: Openings are getting narrower (${gap}px). Move with precision and control!`
                    };
                
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
            // Calculate velocity based on active progression types
            let velocity = this.BASE_VELOCITY;
            
            // Hand Tension: reduces max velocity (requires more pressure)
            const tensionSteps = this.activeProgressions.get('hand_tension') || 0;
            if (tensionSteps > 0) {
                const reduction = tensionSteps * this.VELOCITY_REDUCTION_PER_STEP;
                velocity = Math.max(this.MIN_VELOCITY, velocity - reduction);
            }
            
            // Speed Challenge: increases max velocity (faster movement)
            const speedSteps = this.activeProgressions.get('speed_challenge') || 0;
            if (speedSteps > 0) {
                // Speed challenge makes movement faster, but also requires faster reactions
                // So we slightly increase max velocity but also reduce acceleration rate
                velocity = Math.min(velocity * 1.1, this.BASE_VELOCITY * 1.2);
            }
            
            return velocity;
        }
        
        public getAccelerationRate(): number {
            // Base acceleration rate (used in Game.ts)
            const baseRate = 0.05;
            
            // Speed Challenge: reduces acceleration rate (requires faster input)
            const speedSteps = this.activeProgressions.get('speed_challenge') || 0;
            if (speedSteps > 0) {
                const reduction = speedSteps * this.ACCELERATION_RATE_REDUCTION_PER_STEP;
                return Math.max(0.02, baseRate - reduction);
            }
            
            return baseRate;
        }
        
        public getPipeDelay(): number {
            // Calculate delay based on active progression types
            let delay = this.BASE_DELAY;
            
            // Fast Reaction: reduces delay (pipes appear more frequently)
            const reactionSteps = this.activeProgressions.get('fast_reaction') || 0;
            if (reactionSteps > 0) {
                const reduction = reactionSteps * this.DELAY_REDUCTION_PER_STEP;
                delay = Math.max(this.MIN_DELAY, delay - reduction);
            }
            
            // Endurance: slightly reduces delay (more pipes = longer session)
            const enduranceSteps = this.activeProgressions.get('endurance') || 0;
            if (enduranceSteps > 0) {
                const reduction = enduranceSteps * (this.DELAY_REDUCTION_PER_STEP * 0.5);
                delay = Math.max(this.MIN_DELAY, delay - reduction);
            }
            
            return delay;
        }
        
        public getPipeGap(): number {
            // Calculate gap based on active progression types
            let gap = this.BASE_GAP;
            
            // Precision Control: reduces gap (narrower openings)
            const precisionSteps = this.activeProgressions.get('precision_control') || 0;
            if (precisionSteps > 0) {
                const reduction = precisionSteps * this.GAP_REDUCTION_PER_STEP;
                gap = Math.max(this.MIN_GAP, gap - reduction);
            }
            
            // Fast Reaction: also slightly reduces gap
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
}

