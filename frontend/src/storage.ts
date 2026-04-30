/**
 * LocalStorage persistence layer for the RehaPiano game.
 *
 * Provides safe read/write access to browser localStorage with
 * graceful fallbacks when storage is unavailable (e.g., private
 * browsing, storage quota exceeded). Persists the player's high
 * score and doctor-configured rehabilitation settings.
 *
 * @module storage
 */

import type { DoctorSettings } from './types';

/**
 * Tests whether localStorage is available and writable.
 *
 * @returns `true` if localStorage can be used, `false` otherwise.
 */
const testLocalStorageWorks = (): boolean => {
    try {
        window.localStorage.setItem('test', 'test');
        window.localStorage.removeItem('test');
        return true;
    } catch {
        return false;
    }
};

/** Cached result of the localStorage availability check. */
const isLsEnabled = testLocalStorageWorks();

/**
 * Default doctor/therapist settings used when no saved configuration exists.
 *
 * All fingers on both hands are enabled, sensitivity values are moderate,
 * and all progression dimensions are active. These defaults provide a
 * safe starting point for new rehabilitation sessions.
 */
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
    pipeWidth: 52,
    worldSpeed: 1.0,
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

/**
 * Storage access object providing methods for persisting and retrieving
 * game data from localStorage.
 */
export const storage = {
    /**
     * Persists the player's high score to localStorage.
     *
     * @param score - The high score value to save.
     */
    setHighScore: (score: number): void => {
        if (!isLsEnabled) return;
        window.localStorage.setItem('highscore', score.toString());
    },
    /**
     * Retrieves the player's high score from localStorage.
     *
     * @returns The saved high score, or 0 if none exists.
     */
    getHighScore: (): number => {
        if (!isLsEnabled) return 0;
        return parseInt(window.localStorage.getItem('highscore') ?? '0');
    },
    /**
     * Persists the doctor-configured rehabilitation settings to localStorage.
     *
     * @param settings - The complete doctor settings object to save.
     */
    setDoctorSettings: (settings: DoctorSettings): void => {
        if (!isLsEnabled) return;
        window.localStorage.setItem('doctorSettings', JSON.stringify(settings));
    },
    /**
     * Retrieves doctor settings from localStorage, merged with defaults.
     *
     * Falls back to {@link DEFAULT_DOCTOR_SETTINGS} if storage is unavailable
     * or the stored data is corrupt.
     *
     * @returns The merged doctor settings object.
     */
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
