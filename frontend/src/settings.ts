import './styles/reset.css';
import './styles/settings.css';
import type { DoctorSettings } from './types';
import { storage, DEFAULT_DOCTOR_SETTINGS } from './storage';

type ProgressionKey = keyof DoctorSettings['enabledProgressions'];

let currentSettings: DoctorSettings = storage.getDoctorSettings();

// --- Button groups (radio-style single select) ---

function setupButtonGroup(id: string, onChange: (value: string) => void) {
    const container = document.getElementById(id)!;
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onChange(btn.dataset.value!);
        });
    });
}

function setButtonGroupValue(id: string, value: string) {
    const container = document.getElementById(id)!;
    const buttons = container.querySelectorAll('button');
    buttons.forEach(b => {
        b.classList.toggle('active', b.dataset.value === value);
    });
}

// --- Finger toggles ---

function setupFingerToggles(hand: 'left' | 'right') {
    const container = document.getElementById(`fingers-${hand}`)!;
    const buttons = container.querySelectorAll('.finger-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt((btn as HTMLElement).dataset.finger!);
            currentSettings.activeFingers[hand][idx] = !currentSettings.activeFingers[hand][idx];
            btn.classList.toggle('active');
        });
    });
}

function updateFingerToggles(hand: 'left' | 'right') {
    const container = document.getElementById(`fingers-${hand}`)!;
    const buttons = container.querySelectorAll('.finger-btn');
    buttons.forEach(btn => {
        const idx = parseInt((btn as HTMLElement).dataset.finger!);
        btn.classList.toggle('active', currentSettings.activeFingers[hand][idx]);
    });
}

function updateFingerVisibility() {
    const leftContainer = document.getElementById('fingers-left')!;
    const rightContainer = document.getElementById('fingers-right')!;
    const leftLabel = leftContainer.previousElementSibling as HTMLElement;
    const rightLabel = rightContainer.previousElementSibling as HTMLElement;

    const showLeft = currentSettings.activeHand === 'left' || currentSettings.activeHand === 'both';
    const showRight = currentSettings.activeHand === 'right' || currentSettings.activeHand === 'both';

    leftContainer.style.opacity = showLeft ? '1' : '0.3';
    leftLabel.style.opacity = showLeft ? '1' : '0.3';
    leftContainer.querySelectorAll('.finger-btn').forEach(btn => {
        btn.classList.toggle('disabled', !showLeft);
    });

    rightContainer.style.opacity = showRight ? '1' : '0.3';
    rightLabel.style.opacity = showRight ? '1' : '0.3';
    rightContainer.querySelectorAll('.finger-btn').forEach(btn => {
        btn.classList.toggle('disabled', !showRight);
    });
}

// --- Sliders ---

function setupSlider(id: string, displayId: string, format: (val: number) => string, onChange: (val: number) => void) {
    const slider = document.getElementById(id) as HTMLInputElement;
    const display = document.getElementById(displayId)!;

    slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        display.textContent = format(val);
        onChange(val);
    });
}

function setSliderValue(id: string, displayId: string, value: number, format: (val: number) => string) {
    const slider = document.getElementById(id) as HTMLInputElement;
    const display = document.getElementById(displayId)!;
    slider.value = String(value);
    display.textContent = format(value);
}

// --- Progression toggles ---

function setupProgressionToggles() {
    const container = document.getElementById('progression-toggles')!;
    const buttons = container.querySelectorAll('.toggle-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const key = (btn as HTMLElement).dataset.key as ProgressionKey;
            currentSettings.enabledProgressions[key] = !currentSettings.enabledProgressions[key];
            btn.classList.toggle('active');
        });
    });
}

function updateProgressionToggles() {
    const container = document.getElementById('progression-toggles')!;
    const buttons = container.querySelectorAll('.toggle-btn');
    buttons.forEach(btn => {
        const key = (btn as HTMLElement).dataset.key as ProgressionKey;
        btn.classList.toggle('active', currentSettings.enabledProgressions[key]);
    });
}

// --- Format helpers ---

const formatResponseStrength = (val: number): string => (val / 1000).toFixed(3);
const formatMaxSpeed = (val: number): string => (val / 10).toFixed(1);
const formatFrequency = (val: number): string => (val / 1000).toFixed(1) + 's';
const formatPlain = (val: number): string => String(val);

// --- Load settings into UI ---

function loadSettingsToUI() {
    setButtonGroupValue('active-hand', currentSettings.activeHand);
    updateFingerToggles('left');
    updateFingerToggles('right');
    updateFingerVisibility();

    setSliderValue('minimum-force', 'minimum-force-val', currentSettings.minimumForce, formatPlain);
    setSliderValue('response-strength', 'response-strength-val', currentSettings.responseStrength * 1000, formatResponseStrength);
    setSliderValue('maximum-speed', 'maximum-speed-val', currentSettings.maximumSpeed * 10, formatMaxSpeed);

    setSliderValue('gap-size', 'gap-size-val', currentSettings.gapSize, formatPlain);
    setSliderValue('obstacle-frequency', 'obstacle-frequency-val', currentSettings.obstacleFrequency, formatFrequency);

    setSliderValue('points-per-level', 'points-per-level-val', currentSettings.pointsPerLevel, formatPlain);
    setSliderValue('max-difficulty', 'max-difficulty-val', currentSettings.maxDifficultyLevel, formatPlain);

    updateProgressionToggles();

    setButtonGroupValue('time-limit', String(currentSettings.timeLimitMinutes));
    setButtonGroupValue('rest-reminder', String(currentSettings.restReminderMinutes));
}

// --- Initialize ---

function init() {
    // Hand selection
    setupButtonGroup('active-hand', (value) => {
        currentSettings.activeHand = value as DoctorSettings['activeHand'];
        updateFingerVisibility();
    });

    // Finger toggles
    setupFingerToggles('left');
    setupFingerToggles('right');

    // Sensitivity sliders
    setupSlider('minimum-force', 'minimum-force-val', formatPlain, (val) => {
        currentSettings.minimumForce = val;
    });
    setupSlider('response-strength', 'response-strength-val', formatResponseStrength, (val) => {
        currentSettings.responseStrength = val / 1000;
    });
    setupSlider('maximum-speed', 'maximum-speed-val', formatMaxSpeed, (val) => {
        currentSettings.maximumSpeed = val / 10;
    });

    // Difficulty sliders
    setupSlider('gap-size', 'gap-size-val', formatPlain, (val) => {
        currentSettings.gapSize = val;
    });
    setupSlider('obstacle-frequency', 'obstacle-frequency-val', formatFrequency, (val) => {
        currentSettings.obstacleFrequency = val;
    });

    // Progression
    setupSlider('points-per-level', 'points-per-level-val', formatPlain, (val) => {
        currentSettings.pointsPerLevel = val;
    });
    setupSlider('max-difficulty', 'max-difficulty-val', formatPlain, (val) => {
        currentSettings.maxDifficultyLevel = val;
    });
    setupProgressionToggles();

    // Session
    setupButtonGroup('time-limit', (value) => {
        currentSettings.timeLimitMinutes = parseInt(value);
    });
    setupButtonGroup('rest-reminder', (value) => {
        currentSettings.restReminderMinutes = parseInt(value);
    });

    // Actions
    document.getElementById('btn-save')!.addEventListener('click', () => {
        storage.setDoctorSettings(currentSettings);
        window.location.href = '/';
    });

    document.getElementById('btn-reset')!.addEventListener('click', () => {
        currentSettings = { ...DEFAULT_DOCTOR_SETTINGS,
            activeFingers: {
                left: [...DEFAULT_DOCTOR_SETTINGS.activeFingers.left] as [boolean, boolean, boolean, boolean, boolean],
                right: [...DEFAULT_DOCTOR_SETTINGS.activeFingers.right] as [boolean, boolean, boolean, boolean, boolean],
            },
            enabledProgressions: { ...DEFAULT_DOCTOR_SETTINGS.enabledProgressions },
        };
        loadSettingsToUI();
    });

    // Load current settings
    loadSettingsToUI();
}

init();
