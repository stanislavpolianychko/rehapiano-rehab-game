export enum GameState {
    Loading,
    SplashScreen,
    Playing,
    PlayerDying,
    PlayerDead,
    ScoreScreen,
}

export interface FlyingProperties {
    gravity: number;
    jumpVelocity: number;
    flightAreaBox: BoundingBox;
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface GameHtmlElements {
    bird: HTMLElement;
    land: HTMLElement;
    flightArea: HTMLElement;
    replayButton: HTMLElement;
    bigScore: HTMLElement;
    currentScore: HTMLElement;
    highScore: HTMLElement;
}

export interface GameOptions {
    isDebugOn: boolean;
    isEasyModeOn: boolean;
    rehaPianoUrl?: string;
    rehaPianoThreshold?: number;
    rehaPianoScale?: number;
    rehaPianoEnabled?: boolean;
    doctorSettings?: DoctorSettings;
}

export interface DoctorSettings {
    // Hand selection
    activeHand: 'left' | 'right' | 'both';
    activeFingers: {
        left: [boolean, boolean, boolean, boolean, boolean]; // little, ring, middle, index, thumb
        right: [boolean, boolean, boolean, boolean, boolean];
    };

    // Sensitivity
    minimumForce: number; // threshold (1–50, default 5)
    responseStrength: number; // scale (0.001–0.05, default 0.01)
    maximumSpeed: number; // max velocity (0.2–2.0, default 0.5)

    // Starting difficulty
    gapSize: number; // pipe gap in px (80–200, default 140)
    obstacleFrequency: number; // pipe delay in ms (1500–8000, default 5000)

    // Progression
    pointsPerLevel: number; // score interval (2–20, default 5)
    enabledProgressions: {
        hand_tension: boolean;
        fast_reaction: boolean;
        precision_control: boolean;
        speed_challenge: boolean;
        endurance: boolean;
        coordination: boolean;
        fine_motor: boolean;
        range_of_motion: boolean;
    };
    maxDifficultyLevel: number; // cap (1–100, default 50)

    // Session
    timeLimitMinutes: number; // 0 = off, or 5/10/15/20
    restReminderMinutes: number; // 0 = off, or 3/5/10
}
