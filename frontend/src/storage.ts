import type { DoctorSettings } from './types';

const testLocalStorageWorks = (): boolean => {
    try {
        window.localStorage.setItem('test', 'test');
        window.localStorage.removeItem('test');
        return true;
    } catch {
        return false;
    }
};

const isLsEnabled = testLocalStorageWorks();

export const DEFAULT_DOCTOR_SETTINGS: DoctorSettings = {
    activeHand: 'both',
    activeFingers: {
        left: [true, true, true, true, true],
        right: [true, true, true, true, true],
    },
    minimumForce: 5,
    responseStrength: 0.01,
    maximumSpeed: 0.5,
    gapSize: 140,
    obstacleFrequency: 5000,
    pointsPerLevel: 5,
    enabledProgressions: {
        hand_tension: true,
        fast_reaction: true,
        precision_control: true,
        speed_challenge: true,
        endurance: true,
        coordination: true,
        fine_motor: true,
        range_of_motion: true,
    },
    maxDifficultyLevel: 50,
    timeLimitMinutes: 0,
    restReminderMinutes: 0,
};

export const storage = {
    setHighScore: (score: number): void => {
        if (!isLsEnabled) return;
        window.localStorage.setItem('highscore', score.toString());
    },
    getHighScore: (): number => {
        if (!isLsEnabled) return 0;
        return parseInt(window.localStorage.getItem('highscore') ?? '0');
    },
    setDoctorSettings: (settings: DoctorSettings): void => {
        if (!isLsEnabled) return;
        window.localStorage.setItem('doctorSettings', JSON.stringify(settings));
    },
    getDoctorSettings: (): DoctorSettings => {
        if (!isLsEnabled) return { ...DEFAULT_DOCTOR_SETTINGS };
        try {
            const raw = window.localStorage.getItem('doctorSettings');
            if (!raw) return { ...DEFAULT_DOCTOR_SETTINGS };
            return { ...DEFAULT_DOCTOR_SETTINGS, ...JSON.parse(raw) };
        } catch {
            return { ...DEFAULT_DOCTOR_SETTINGS };
        }
    },
};
