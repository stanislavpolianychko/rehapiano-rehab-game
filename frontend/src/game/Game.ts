/**
 * @file Game.ts
 * Main game orchestrator for the RehaPiano rehabilitation Flappy Bird game.
 *
 * Coordinates the game loop, input handling, scoring, level progression,
 * and session management (time limits and rest reminders configured by a doctor).
 */

import { GameState, GameHtmlElements, GameOptions } from '../types';
import type { DoctorSettings } from '../types';
import { sounds } from '../Assets';
import { storage } from '../storage';
import { wait } from '../utils';
import { gameDebugger } from '../debug';
import { Bird } from './Bird';
import { Land } from './Land';
import { PipeManager } from './PipeManager';
import { LevelProgression } from './LevelProgression';
import { RehaPianoConnection } from '../rehapiano/RehaPianoConnection';

/** Fixed simulation timestep targeting 60 Hz. */
const TICK_RATE = 1000 / 60;

/**
 * Top-level game controller.
 *
 * **Game loop architecture:** A single `requestAnimationFrame` callback
 * ({@link loop}) drives both rendering and physics. Physics uses a
 * fixed-timestep accumulator so simulation speed is independent of frame rate.
 *
 * **Input handling:** Prefers RehaPiano WebSocket data when connected;
 * falls back to keyboard (Arrow / WASD) with smoothed acceleration.
 * Virtual keyboard keys (Q-P) are forwarded to the RehaPiano server to
 * simulate sensor input during development.
 *
 * **Session management:** Supports doctor-configured time limits
 * (auto-ends the session) and periodic rest reminders that pause the game.
 */
export class Game {
    protected _state!: GameState;
    protected _highScore!: number;
    protected _currentScore!: number;

    protected domElements: GameHtmlElements;
    protected bird: Bird;
    protected land: Land;
    protected pipes: PipeManager;
    protected animationFrameId: number | undefined;
    protected lastFrameTime: number = 0;
    protected accumulator: number = 0;
    protected isRunning: boolean = false;
    protected keyboardControlVelocity: number = 0;
    protected targetControlVelocity: number = 0;
    protected readonly BASE_MAX_CONTROL_VELOCITY: number = 0.5;
    protected levelProgression: LevelProgression;
    protected progressionMessageElement: HTMLElement | null = null;
    protected progressionMessageTimeout: ReturnType<typeof setTimeout> | null = null;

    // RehaPiano integration
    protected rehaPiano: RehaPianoConnection;
    protected rehaPianoEnabled: boolean = false;
    protected readonly rehaPianoThreshold: number;
    protected readonly rehaPianoScale: number;
    protected rehaPianoApiBase: string = '';
    protected hasLoggedFirstInput: boolean = false;
    protected virtualKeysDown: Set<string> = new Set();

    // Doctor settings
    protected doctorSettings: DoctorSettings | undefined;
    protected sessionStartTime: number = 0;
    protected lastRestReminder: number = 0;
    protected restReminderShowing: boolean = false;

    protected medals = [
        [40, 'platinum'],
        [30, 'gold'],
        [20, 'silver'],
        [10, 'bronze'],
    ] as const;

    constructor(domElements: GameHtmlElements, options: GameOptions) {
        this.domElements = domElements;
        this.bird = new Bird(domElements.bird, {
            gravity: 0,
            jumpVelocity: -4.6,
            flightAreaBox: domElements.flightArea.getBoundingClientRect(),
        });
        this.pipes = new PipeManager(domElements.flightArea, options.isEasyModeOn);
        this.land = new Land(domElements.land);
        this.doctorSettings = options.doctorSettings;
        this.levelProgression = this.doctorSettings
            ? LevelProgression.fromDoctorSettings(this.doctorSettings)
            : new LevelProgression();
        this.state = GameState.Loading;
        this.domElements.replayButton.onclick = this.onReplayTouch.bind(this);
        this.highScore = storage.getHighScore();
        this.currentScore = 0;
        this.setGameOptionButtons(options);

        // Initialize RehaPiano connection
        this.rehaPianoThreshold = options.rehaPianoThreshold ?? 5.0;
        this.rehaPianoScale = options.rehaPianoScale ?? 0.01;
        this.rehaPianoEnabled = options.rehaPianoEnabled ?? true;
        const rehaPianoUrl = options.rehaPianoUrl ?? 'ws://localhost:5555/ws';
        this.rehaPiano = new RehaPianoConnection(rehaPianoUrl);

        // Derive the HTTP API base URL from the WebSocket URL for virtual key REST calls.
        // e.g., ws://localhost:5555/ws → http://localhost:5555
        this.rehaPianoApiBase = rehaPianoUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');

        if (this.rehaPianoEnabled) {
            console.log('[Game] Connecting to RehaPiano at', rehaPianoUrl);
            this.rehaPiano
                .connect()
                .then(() => {
                    console.log('[Game] RehaPiano connected');
                    gameDebugger.log('RehaPiano connected');
                    this.createRehaPianoStatusIndicator();
                    this.enableVirtualMode();
                })
                .catch((error) => {
                    console.warn('[Game] RehaPiano connection failed, keyboard fallback:', error);
                    this.rehaPianoEnabled = false;
                    this.createRehaPianoStatusIndicator();
                });
        } else {
            this.createRehaPianoStatusIndicator();
        }

        this.createProgressionMessageElement();
        this.applyProgressionSettings();

        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // Start the unified render/game loop
        this.loop(performance.now());
    }

    /**
     * Handles touch/click on the game screen.
     * Starts the game from the splash screen or resets from the score screen.
     * @param _ev - The originating UI event (unused).
     */
    public onScreenTouch(_ev: UIEvent) {
        if (this.state === GameState.SplashScreen) {
            this.start();
        } else if (this.state === GameState.ScoreScreen) {
            this.reset();
        }
    }

    /** Shows the splash/title screen and transitions the game state to {@link GameState.SplashScreen}. */
    public async splash() {
        const splashImage = document.getElementById('splash')!;
        splashImage.classList.add('visible');
        sounds.swoosh.play();
        this.state = GameState.SplashScreen;
    }

    protected get state() {
        return this._state;
    }

    protected set state(newState: GameState) {
        gameDebugger.logStateChange(this._state, newState);
        document.body.className = `state-${GameState[newState]}`;
        this._state = newState;
    }

    protected get currentScore() {
        return this._currentScore;
    }

    protected set currentScore(newScore: number) {
        this._currentScore = newScore;
        this.domElements.bigScore.replaceChildren(...this.numberToImageElements(newScore, 'big'));
        this.domElements.currentScore.replaceChildren(
            ...this.numberToImageElements(newScore, 'small'),
        );
    }

    protected get highScore() {
        return this._highScore;
    }

    protected set highScore(newScore: number) {
        this._highScore = newScore;
        this.domElements.highScore.replaceChildren(
            ...this.numberToImageElements(newScore, 'small'),
        );
        storage.setHighScore(newScore);
    }

    protected setGameOptionButtons(options: GameOptions) {
        const optionsButtons = document.getElementById('game-options')!;
        const easyMode = optionsButtons.getElementsByClassName(
            'option-easy',
        )[0] as HTMLAnchorElement;
        const debugMode = optionsButtons.getElementsByClassName(
            'option-debug',
        )[0] as HTMLAnchorElement;

        easyMode.innerText = `easy mode (${options.isEasyModeOn ? 'ON' : 'OFF'})`;
        easyMode.href = '?';
        easyMode.href += options.isEasyModeOn ? '' : 'easy';
        easyMode.href += options.isDebugOn ? 'debug' : '';

        debugMode.innerText = `debug (${options.isDebugOn ? 'ON' : 'OFF'})`;
        debugMode.href = '?';
        debugMode.href += options.isEasyModeOn ? 'easy' : '';
        debugMode.href += options.isDebugOn ? '' : 'debug';
    }

    protected static readonly VIRTUAL_KEYS = new Set([
        'q',
        'w',
        'e',
        'r',
        't',
        'y',
        'u',
        'i',
        'o',
        'p',
    ]);

    protected handleKeyDown(ev: KeyboardEvent): void {
        const keyLower = ev.key.toLowerCase();
        if (
            Game.VIRTUAL_KEYS.has(keyLower) &&
            this.rehaPianoEnabled &&
            this.rehaPiano.isConnected
        ) {
            if (!this.virtualKeysDown.has(ev.key)) {
                this.virtualKeysDown.add(ev.key);
                const apiKey = ev.shiftKey ? keyLower.toUpperCase() : keyLower;
                this.sendVirtualKey(apiKey, 'down');
            }
            ev.preventDefault();
            return;
        }

        if (this.state === GameState.SplashScreen) {
            this.start();
            return;
        }

        if (this.state === GameState.ScoreScreen) {
            this.reset();
            return;
        }

        if (this.rehaPianoEnabled && this.rehaPiano.isConnected) {
            return;
        }

        if (this.state !== GameState.Playing) return;

        if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
            this.targetControlVelocity = -this.getMaxControlVelocity();
        } else if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
            this.targetControlVelocity = this.getMaxControlVelocity();
        }
    }

    protected handleKeyUp(ev: KeyboardEvent): void {
        const keyLower = ev.key.toLowerCase();
        if (Game.VIRTUAL_KEYS.has(keyLower) && this.virtualKeysDown.has(ev.key)) {
            this.virtualKeysDown.delete(ev.key);
            this.sendVirtualKey(keyLower, 'up');
            ev.preventDefault();
            return;
        }

        if (
            ev.key === 'ArrowUp' ||
            ev.key === 'w' ||
            ev.key === 'W' ||
            ev.key === 'ArrowDown' ||
            ev.key === 's' ||
            ev.key === 'S'
        ) {
            this.targetControlVelocity = 0;
        }
    }

    protected enableVirtualMode(): void {
        fetch(`${this.rehaPianoApiBase}/api/virtual/enable`, { method: 'POST' })
            .then((r) => r.json())
            .then((data) => {
                console.log('[Game] Virtual mode enabled:', data);
                console.log('[Game] Press Q/W/E/R/T (left) or Y/U/I/O/P (right) for compression');
                console.log('[Game] Hold Shift + same keys for extension (decompression)');
            })
            .catch((err) => console.warn('[Game] Could not enable virtual mode:', err));
    }

    protected sendVirtualKey(key: string, action: 'down' | 'up'): void {
        fetch(`${this.rehaPianoApiBase}/api/virtual/key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, action }),
        }).catch(() => {}); // fire-and-forget
    }

    protected updateControlVelocity(): void {
        // Gradually accelerate keyboard velocity toward the target to simulate
        // pressure-sensitive input. This makes keyboard control feel more like
        // the analog RehaPiano gloves rather than an instant on/off switch.
        const accelerationRate = this.levelProgression.getAccelerationRate();
        const diff = this.targetControlVelocity - this.keyboardControlVelocity;
        if (Math.abs(diff) > 0.01) {
            // Move toward target by at most accelerationRate per tick
            this.keyboardControlVelocity +=
                Math.sign(diff) * Math.min(Math.abs(diff), accelerationRate);
        } else {
            // Close enough — snap to target to avoid floating-point drift
            this.keyboardControlVelocity = this.targetControlVelocity;
        }
    }

    /**
     * Reads the latest RehaPiano sensor data and converts it to a bird control velocity.
     * Applies a dead-zone threshold and clamps to the current max velocity.
     * @returns Control velocity (positive = down/compression, negative = up/extension), or 0 if unavailable.
     */
    protected getRehaPianoControlVelocity(): number {
        if (!this.rehaPianoEnabled || !this.rehaPiano.isConnected) return 0;
        if (!this.rehaPiano.isDataFresh()) return 0;

        // Get average ADC force across the doctor-configured active hand(s) and finger(s).
        // Positive = compression (pressing down), Negative = extension (lifting up).
        const avgForce = this.getActiveAverageFingerValue();

        // Dead zone: ignore small forces below the threshold to prevent jitter
        // from sensor noise when the patient's hand is at rest.
        if (Math.abs(avgForce) < this.rehaPianoThreshold) return 0;

        // Convert raw force to game velocity: force * scale factor.
        // The sign is preserved, so compression → positive velocity (bird down)
        // and extension → negative velocity (bird up).
        let velocity = avgForce * this.rehaPianoScale;

        // Clamp velocity to the current maximum (which may decrease as
        // the level progression system increases difficulty).
        const maxVelocity = this.getMaxControlVelocity();
        velocity = Math.max(-maxVelocity, Math.min(maxVelocity, velocity));

        if (!this.hasLoggedFirstInput && Math.abs(velocity) > 0.01) {
            this.hasLoggedFirstInput = true;
            const dir = avgForce > 0 ? 'compression/DOWN' : 'extension/UP';
            console.log(
                '[Game] RehaPiano input — force:',
                avgForce.toFixed(1),
                dir,
                'velocity:',
                velocity.toFixed(3),
            );
        }

        return velocity;
    }

    /**
     * Computes the signed average ADC force across only the hands and fingers
     * marked active in the doctor settings. Falls back to the full average if
     * settings are unset.
     */
    protected getActiveAverageFingerValue(): number {
        const settings = this.doctorSettings;
        if (!settings) return this.rehaPiano.getAverageFingerValue();

        const hands: ('left' | 'right')[] = [];
        if (settings.activeHand === 'left' || settings.activeHand === 'both') hands.push('left');
        if (settings.activeHand === 'right' || settings.activeHand === 'both') hands.push('right');

        let sum = 0;
        let count = 0;
        for (const hand of hands) {
            const connected =
                hand === 'left'
                    ? this.rehaPiano.leftHandConnected
                    : this.rehaPiano.rightHandConnected;
            if (!connected) continue;
            const adc = this.rehaPiano.getHandAdc(hand);
            for (let i = 0; i < 5; i++) {
                if (!settings.activeFingers[hand][i]) continue;
                sum += adc[i + 1] || 0;
                count++;
            }
        }
        return count === 0 ? 0 : sum / count;
    }

    protected createRehaPianoStatusIndicator(): void {
        const existing = document.getElementById('rehapiano-status');
        if (existing) existing.remove();

        const indicator = document.createElement('div');
        indicator.id = 'rehapiano-status';
        indicator.className = 'rehapiano-status';
        document.body.appendChild(indicator);

        setInterval(() => {
            const wsOk = this.rehaPianoEnabled && this.rehaPiano.isConnected;
            const left = this.rehaPiano.leftHandConnected;
            const right = this.rehaPiano.rightHandConnected;
            const fresh = this.rehaPiano.isDataFresh();
            const avg = this.rehaPiano.getAverageFingerValue();

            const parts = ['RP:'];
            if (!wsOk) {
                parts.push('disconnected');
            } else {
                parts.push(left ? 'L:ok' : 'L:--');
                parts.push(right ? 'R:ok' : 'R:--');
                if (fresh) parts.push(avg.toFixed(0));
            }

            indicator.textContent = parts.join(' ');
            indicator.style.background =
                wsOk && (left || right) && fresh
                    ? 'rgba(76, 175, 80, 0.9)'
                    : wsOk
                      ? 'rgba(255, 152, 0, 0.9)'
                      : 'rgba(244, 67, 54, 0.9)';
        }, 500);
    }

    protected onReplayTouch() {
        if (this.state === GameState.ScoreScreen) {
            this.reset();
        }
    }

    protected async reset() {
        this.state = GameState.Loading;
        sounds.swoosh.play();

        const scoreboard = document.getElementById('scoreboard')!;
        scoreboard.classList.add('slide-up');
        await wait(750);

        scoreboard.classList.remove('visible', 'slide-up');
        Array.from(scoreboard.getElementsByClassName('visible')).forEach((e) =>
            e.classList.remove('visible'),
        );

        gameDebugger.resetBoxes();

        this.pipes.removeAll();
        this.bird.reset();
        this.currentScore = 0;
        this.keyboardControlVelocity = 0;
        this.targetControlVelocity = 0;
        this.levelProgression = this.doctorSettings
            ? LevelProgression.fromDoctorSettings(this.doctorSettings)
            : new LevelProgression();
        this.applyProgressionSettings();

        if (this.rehaPianoEnabled && !this.rehaPiano.isConnected) {
            this.rehaPiano
                .connect()
                .then(() => {
                    gameDebugger.log('RehaPiano reconnected');
                })
                .catch(() => {});
        }

        Array.from(document.getElementsByClassName('animated')).forEach((e) => {
            (e as HTMLElement).style.animationPlayState = 'running';
            (e as HTMLElement).style.webkitAnimationPlayState = 'running';
        });

        this.splash();
    }

    protected start() {
        const splashImage = document.getElementById('splash')!;
        splashImage.classList.remove('visible');
        this.state = GameState.Playing;
        this.isRunning = true;
        this.sessionStartTime = Date.now();
        this.lastRestReminder = Date.now();

        console.log(
            '[Game] Started. Control:',
            this.rehaPianoEnabled && this.rehaPiano.isConnected ? 'RehaPiano' : 'Keyboard',
        );

        this.applyProgressionSettings();
    }

    protected async die() {
        this.isRunning = false;

        this.state = GameState.PlayerDying;

        Array.from(document.getElementsByClassName('animated')).forEach((e) => {
            (e as HTMLElement).style.animationPlayState = 'paused';
            (e as HTMLElement).style.webkitAnimationPlayState = 'paused';
        });

        await this.bird.die();

        this.state = GameState.PlayerDead;

        await wait(500);

        sounds.swoosh.play();

        const scoreboard = document.getElementById('scoreboard')!;
        scoreboard.classList.add('visible');
        await wait(600);

        sounds.swoosh.play();

        const replay = document.getElementById('replay')!;
        replay.classList.add('visible');

        const wonMedal = this.medals.find(([minimumScore]) => this.currentScore >= minimumScore);

        if (wonMedal) {
            gameDebugger.log('Medal won!', wonMedal);
            const medalContainer = document.getElementById('medal')!;
            const medal = new Image();
            medal.src = `/assets/medal_${wonMedal[1]}.png`;
            medalContainer.replaceChildren(medal);
            medalContainer.classList.add('visible');
        }

        await wait(300);

        this.state = GameState.ScoreScreen;
    }

    protected score() {
        gameDebugger.log('Score!');
        sounds.score.play();

        this.currentScore++;

        if (this.currentScore > this.highScore) {
            gameDebugger.log('New highscore!', this.currentScore);
            this.highScore = this.currentScore;
        }

    }

    protected applyProgressionSettings(): void {
        const pipeDelay = this.levelProgression.getPipeDelay();
        const pipeGap = this.levelProgression.getPipeGap();

        this.pipes.setPipeDelay(pipeDelay);
        this.pipes.setPipeGap(pipeGap);

        const root = document.documentElement;
        const worldSpeed = this.doctorSettings?.worldSpeed ?? 1.0;
        const pipeWidth = this.doctorSettings?.pipeWidth ?? 52;
        root.style.setProperty('--world-speed-mult', String(worldSpeed));
        root.style.setProperty('--pipe-width', `${pipeWidth}px`);
    }

    protected getMaxControlVelocity(): number {
        return this.levelProgression.getMaxControlVelocity();
    }

    protected createProgressionMessageElement(): void {
        const container = document.createElement('div');
        container.id = 'progression-message';
        container.className = 'progression-message';

        const title = document.createElement('div');
        title.id = 'progression-title';
        title.className = 'progression-title';

        const description = document.createElement('div');
        description.id = 'progression-description';
        description.className = 'progression-description';

        container.appendChild(title);
        container.appendChild(description);
        this.domElements.flightArea.appendChild(container);
        this.progressionMessageElement = container;
    }

    protected showProgressionMessage(title: string, description?: string): void {
        if (!this.progressionMessageElement) return;

        if (this.progressionMessageTimeout) {
            clearTimeout(this.progressionMessageTimeout);
            this.progressionMessageTimeout = null;
        }

        const titleElement = this.progressionMessageElement.querySelector(
            '#progression-title',
        ) as HTMLElement;
        const descElement = this.progressionMessageElement.querySelector(
            '#progression-description',
        ) as HTMLElement;

        if (titleElement) {
            titleElement.textContent = title;
        }

        if (descElement) {
            if (description) {
                descElement.textContent = description;
                descElement.style.display = 'block';
            } else {
                descElement.style.display = 'none';
            }
        }

        this.progressionMessageElement.style.display = 'block';
        this.progressionMessageElement.style.opacity = '1';

        this.progressionMessageTimeout = setTimeout(() => {
            if (this.progressionMessageElement) {
                this.progressionMessageElement.style.opacity = '0';
            }
            this.progressionMessageTimeout = null;
        }, 10000);
    }

    protected numberToImageElements(digits: number, size: 'big' | 'small') {
        return digits
            .toString()
            .split('')
            .map((n) => {
                const imgDigit = new Image();
                imgDigit.src = `/assets/font_${size}_${n}.png`;
                return imgDigit;
            });
    }

    /**
     * Performs one fixed-timestep simulation step.
     * Checks session time limits and rest reminders, reads input, advances the
     * bird and pipes, detects scoring and collisions.
     */
    protected tick() {
        const now = Date.now();

        // Session time limit check
        if (this.doctorSettings && this.doctorSettings.timeLimitMinutes > 0) {
            const elapsed = (now - this.sessionStartTime) / 1000 / 60;
            if (elapsed >= this.doctorSettings.timeLimitMinutes) {
                this.showProgressionMessage(
                    'Session Complete',
                    `${this.doctorSettings.timeLimitMinutes} minute session finished. Great work!`,
                );
                this.die();
                return;
            }
        }

        // Rest reminder check
        if (
            this.doctorSettings &&
            this.doctorSettings.restReminderMinutes > 0 &&
            !this.restReminderShowing
        ) {
            const sinceLastReminder = (now - this.lastRestReminder) / 1000 / 60;
            if (sinceLastReminder >= this.doctorSettings.restReminderMinutes) {
                this.showRestReminder();
                return;
            }
        }

        let controlVelocity: number;

        if (this.rehaPianoEnabled && this.rehaPiano.isConnected) {
            controlVelocity = this.getRehaPianoControlVelocity();
        } else {
            this.updateControlVelocity();
            controlVelocity = this.keyboardControlVelocity;
        }

        this.bird.setControlVelocity(controlVelocity);

        this.bird.tick();
        this.pipes.tick(now);

        const unscoredPipe = this.pipes.nextUnscoredPipe();

        if (unscoredPipe && unscoredPipe.hasCrossed(this.bird.box)) {
            unscoredPipe.scored = true;
            this.score();
        }

        if (this.pipes.intersectsWith(this.bird.box) || this.land.intersectsWith(this.bird.box)) {
            this.die();
        }
    }

    /**
     * Pauses the game and displays a rest reminder overlay.
     * Resumes on any user input after a short delay to prevent accidental dismissal.
     * Triggered periodically based on the doctor-configured rest reminder interval.
     */
    protected showRestReminder() {
        this.restReminderShowing = true;
        this.isRunning = false;

        // Pause animations
        Array.from(document.getElementsByClassName('animated')).forEach((e) => {
            (e as HTMLElement).style.animationPlayState = 'paused';
            (e as HTMLElement).style.webkitAnimationPlayState = 'paused';
        });

        this.showProgressionMessage(
            'Time to Rest',
            'Take a short break. Press any key or tap to continue.',
        );

        const resumeHandler = () => {
            this.restReminderShowing = false;
            this.lastRestReminder = Date.now();
            this.isRunning = true;

            Array.from(document.getElementsByClassName('animated')).forEach((e) => {
                (e as HTMLElement).style.animationPlayState = 'running';
                (e as HTMLElement).style.webkitAnimationPlayState = 'running';
            });

            if (this.progressionMessageElement) {
                this.progressionMessageElement.style.opacity = '0';
            }

            document.removeEventListener('keydown', resumeHandler);
            document.removeEventListener('mousedown', resumeHandler);
            document.removeEventListener('touchstart', resumeHandler);
        };

        // Wait a moment before allowing resume to prevent accidental dismissal
        setTimeout(() => {
            document.addEventListener('keydown', resumeHandler, { once: true });
            document.addEventListener('mousedown', resumeHandler, { once: true });
            document.addEventListener('touchstart', resumeHandler, { once: true });
        }, 1000);
    }

    /**
     * Main `requestAnimationFrame` loop.
     * Accumulates elapsed time and dispatches fixed-timestep {@link tick} calls.
     * Always renders the bird regardless of whether the simulation is running.
     * @param now - High-resolution timestamp from `requestAnimationFrame`.
     */
    protected loop(now: number) {
        // Schedule the next frame immediately so the loop continues even if
        // this frame's logic throws an error.
        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));

        if (this.isRunning) {
            const delta = now - this.lastFrameTime;
            this.lastFrameTime = now;

            // Cap delta at 200ms to prevent the "spiral of death" — if the tab
            // was backgrounded for a long time, we don't want to run hundreds of
            // catch-up ticks. Instead, we accept the time skip gracefully.
            this.accumulator += Math.min(delta, 200);

            // Run as many fixed-timestep logic updates as needed to consume
            // the accumulated time. This ensures game physics are deterministic
            // at exactly 60Hz regardless of the actual display refresh rate.
            while (this.accumulator >= TICK_RATE) {
                this.tick();
                this.accumulator -= TICK_RATE;
            }
        } else {
            // When paused, keep updating lastFrameTime to avoid a large delta
            // spike when the game resumes.
            this.lastFrameTime = now;
        }

        // Always render the bird (even when paused) so it stays visible.
        this.bird.draw();
    }
}
