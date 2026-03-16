namespace Floppy {
    export class Game {
        protected _state!: Floppy.Common.GameState;
        protected _highScore!: number;
        protected _currentScore!: number;
    
        protected domElements: Floppy.Common.GameHtmlElements;
        protected bird: Floppy.Bird;
        protected land: Floppy.Land;
        protected pipes: Floppy.PipeManager;
        protected gameLoop: ReturnType<typeof setInterval> | undefined;
        protected keyboardControlVelocity: number = 0;
        protected targetControlVelocity: number = 0;
        protected readonly BASE_MAX_CONTROL_VELOCITY: number = 0.5; // Base maximum control velocity
        protected levelProgression: Floppy.LevelProgression;
        protected progressionMessageElement: HTMLElement | null = null;
        protected progressionMessageTimeout: ReturnType<typeof setTimeout> | null = null;
        
        // RehaPiano integration
        protected rehaPiano: Floppy.RehaPianoConnection;
        protected rehaPianoEnabled: boolean = false;
        protected readonly rehaPianoThreshold: number;
        protected readonly rehaPianoScale: number;
        protected hasLoggedControlVelocity: boolean = false;
        protected hasLoggedBelowThreshold: boolean = false;
        protected hasLoggedValidInput: boolean = false;
        protected hasLoggedTick: boolean = false;
    
        protected medals = [
            [40, 'platinum'],
            [30, 'gold'],
            [20, 'silver'],
            [10, 'bronze'],
        ] as const;
    
        constructor(domElements: Floppy.Common.GameHtmlElements, options: Floppy.Common.GameOptions) {
            this.domElements = domElements;
            this.bird = new Floppy.Bird(domElements.bird, {
                gravity: 0, // No gravity - bird moves only via control input
                jumpVelocity: -4.6,
                flightAreaBox: domElements.flightArea.getBoundingClientRect(),
            });
            this.pipes = new Floppy.PipeManager(domElements.flightArea, options.isEasyModeOn);
            this.land = new Floppy.Land(domElements.land);
            this.levelProgression = new Floppy.LevelProgression();
            this.state = Floppy.Common.GameState.Loading;
            this.domElements.replayButton.onclick = this.onReplayTouch.bind(this);
            this.highScore = Floppy.storage.getHighScore();
            this.currentScore = 0;
            this.setGameOptionButtons(options);
            
            // Initialize RehaPiano connection
            // Threshold is per-channel, not per-average
            // Since average divides by 10 fingers, we need a much lower threshold
            this.rehaPianoThreshold = options.rehaPianoThreshold ?? 0.01; // Lower threshold for average (0.01 avg = ~0.1 per channel)
            this.rehaPianoScale = options.rehaPianoScale ?? 4.0; // Higher scale for more responsiveness
            this.rehaPianoEnabled = options.rehaPianoEnabled ?? true;
            const rehaPianoUrl = options.rehaPianoUrl ?? 'ws://localhost:8005';
            this.rehaPiano = new Floppy.RehaPianoConnection(rehaPianoUrl);
            
            // Attempt to connect to RehaPiano (async, non-blocking)
            if (this.rehaPianoEnabled) {
                console.log('[Game] 🔌 Attempting to connect to RehaPiano at', rehaPianoUrl);
                console.log('[Game] ⚙️ Settings - Threshold:', this.rehaPianoThreshold, 'Scale:', this.rehaPianoScale);
                this.rehaPiano.connect().then(() => {
                    console.log('[Game] ✅ RehaPiano connected successfully!');
                    gameDebugger.log('RehaPiano connected successfully');
                    this.createRehaPianoStatusIndicator(true);
                }).catch((error) => {
                    console.error('[Game] ❌ RehaPiano connection failed, using keyboard fallback:', error);
                    gameDebugger.log('RehaPiano connection failed, using keyboard fallback:', error);
                    this.rehaPianoEnabled = false;
                    this.createRehaPianoStatusIndicator(false);
                });
            } else {
                console.log('[Game] ⏸️ RehaPiano is disabled, using keyboard control');
                this.createRehaPianoStatusIndicator(false);
            }
            
            // Create progression message element
            this.createProgressionMessageElement();
            
            // Register keyboard event listeners for continuous control (fallback)
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
            requestAnimationFrame(this.draw.bind(this));
        }
    
        public onScreenTouch(_ev: UIEvent) {
            // Jump is disabled - using continuous control instead
            // Allow any touch/click to start or restart the game
            if (this.state === Floppy.Common.GameState.SplashScreen) {
                this.start();
            } else if (this.state === Floppy.Common.GameState.ScoreScreen) {
                // Allow any touch/click to restart from score screen
                this.reset();
            }
        }
    
        public async splash() {
            const splashImage = document.getElementById('splash')!;
            splashImage.classList.add('visible');
            Floppy.Assets.sounds.swoosh.play();
            this.state = Floppy.Common.GameState.SplashScreen;
        }
    
        protected get state() {
            return this._state;
        }
    
        protected set state(newState: Floppy.Common.GameState) {
            gameDebugger.logStateChange(this._state, newState);
            document.body.className = `state-${Floppy.Common.GameState[newState]}`;
            this._state = newState;
        }
    
        protected get currentScore() {
            return this._currentScore;
        }
    
        protected set currentScore(newScore: number) {
            this._currentScore = newScore;
            this.domElements.bigScore.replaceChildren(...this.numberToImageElements(newScore, 'big'));
            this.domElements.currentScore.replaceChildren(...this.numberToImageElements(newScore, 'small'));
        }
    
        protected get highScore() {
            return this._highScore;
        }
    
        protected set highScore(newScore: number) {
            this._highScore = newScore;
            this.domElements.highScore.replaceChildren(...this.numberToImageElements(newScore, 'small'));
            Floppy.storage.setHighScore(newScore);
        }

        protected setGameOptionButtons(options: Floppy.Common.GameOptions) {
            const optionsButtons = document.getElementById('game-options')!;
            const easyMode = optionsButtons.getElementsByClassName('option-easy')[0] as HTMLAnchorElement;
            const debugMode = optionsButtons.getElementsByClassName('option-debug')[0] as HTMLAnchorElement;

            easyMode.innerText = `easy mode (${options.isEasyModeOn ? 'ON' : 'OFF' })`;
            easyMode.href = '?';
            easyMode.href += options.isEasyModeOn ? '' : 'easy';
            easyMode.href += options.isDebugOn ? 'debug' : '';

            debugMode.innerText = `debug (${options.isDebugOn ? 'ON' : 'OFF' })`;
            debugMode.href = '?';
            debugMode.href += options.isEasyModeOn ? 'easy' : '';
            debugMode.href += options.isDebugOn ? '' : 'debug';
        }
        
        protected handleKeyDown(ev: KeyboardEvent): void {
            // Allow any key to start game from splash screen
            if (this.state === Floppy.Common.GameState.SplashScreen) {
                this.start();
                return;
            }
            
            // Allow any key to restart game from score screen
            if (this.state === Floppy.Common.GameState.ScoreScreen) {
                this.reset();
                return;
            }
            
            // Only process keyboard input if RehaPiano is not active
            if (this.rehaPianoEnabled && this.rehaPiano.isConnected) {
                return; // RehaPiano is active, ignore keyboard input
            }
            
            if (this.state !== Floppy.Common.GameState.Playing) return;
            
            if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
                this.targetControlVelocity = -this.getMaxControlVelocity(); // Up (negative = up)
            } else if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
                this.targetControlVelocity = this.getMaxControlVelocity(); // Down (positive = down)
            }
        }
        
        protected handleKeyUp(ev: KeyboardEvent): void {
            if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W' ||
                ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
                this.targetControlVelocity = 0;
            }
        }
        
        protected updateControlVelocity(): void {
            // Gradually move keyboardControlVelocity toward targetControlVelocity
            // This simulates pressure-sensitive control
            // Acceleration rate is dynamic based on progression
            const accelerationRate = this.levelProgression.getAccelerationRate();
            const diff = this.targetControlVelocity - this.keyboardControlVelocity;
            if (Math.abs(diff) > 0.01) {
                this.keyboardControlVelocity += Math.sign(diff) * Math.min(Math.abs(diff), accelerationRate);
            } else {
                this.keyboardControlVelocity = this.targetControlVelocity;
            }
        }
        
        protected getRehaPianoControlVelocity(): number {
            // Check if RehaPiano is enabled and connected
            if (!this.rehaPianoEnabled || !this.rehaPiano.isConnected) {
                if (!this.hasLoggedControlVelocity) {
                    this.hasLoggedControlVelocity = true;
                    console.warn('[Game] ⚠️ RehaPiano not enabled or not connected');
                }
                return 0;
            }
            
            // Check if data is fresh
            if (!this.rehaPiano.isDataFresh()) {
                // Log more frequently when data is stale
                if (Math.random() < 0.05) {
                    console.warn('[Game] ⚠️ RehaPiano data is stale');
                }
                return 0;
            }
            
            // Get average finger value (preserves sign: negative = extension, positive = compression)
            const averageValue = this.rehaPiano.getAverageFingerValue();
            
            // Debug: Log more frequently to see what's happening
            if (!this.hasLoggedControlVelocity || Math.abs(averageValue) > 0.01) {
                if (!this.hasLoggedControlVelocity) {
                    this.hasLoggedControlVelocity = true;
                    console.log('[Game] 🎮 getRehaPianoControlVelocity called - Avg:', averageValue.toFixed(4), 'Threshold:', this.rehaPianoThreshold);
                }
            }
            
            // Check if any individual finger channel is above threshold (not just average)
            // This is important because average divides by 10, so a single active channel
            // might have a low average but still be a valid input
            const rawValues = this.rehaPiano.getRawSensorValues();
            
            // Debug: Log sign of values to see if shift is working
            if (rawValues && Math.abs(averageValue) > 0.01 && Math.random() < 0.1) {
                const fingerPositions = [0, 1, 2, 3, 4, 12, 11, 10, 9, 8];
                const activeChannels = fingerPositions.map(i => ({idx: i, val: rawValues[i]})).filter(c => Math.abs(c.val) > 0.01);
                if (activeChannels.length > 0) {
                    console.log('[Game] 🔍 Active channels:', activeChannels.map(c => `[${c.idx}]=${c.val.toFixed(3)}`).join(', '), 'Average:', averageValue.toFixed(4));
                }
            }
            let hasValidInput = false;
            if (rawValues) {
                // Check if any finger channel (mapped positions) exceeds threshold
                // Lower threshold multiplier for more sensitivity (was 10, now 5)
                const fingerPositions = [0, 1, 2, 3, 4, 12, 11, 10, 9, 8];
                for (const channelIndex of fingerPositions) {
                    if (Math.abs(rawValues[channelIndex]) >= this.rehaPianoThreshold * 5) {
                        // Individual channel threshold is 5x the average threshold
                        // (lower multiplier = more sensitive)
                        hasValidInput = true;
                        break;
                    }
                }
            }
            
            // Apply dead zone to prevent jitter (but log when we're close)
            if (!hasValidInput && Math.abs(averageValue) < this.rehaPianoThreshold) {
                // Log more frequently to show we're receiving data but below threshold
                if (Math.abs(averageValue) > 0.001 && (Math.random() < 0.1 || !this.hasLoggedBelowThreshold)) {
                    if (!this.hasLoggedBelowThreshold) {
                        this.hasLoggedBelowThreshold = true;
                    }
                    console.log('[Game] 📉 Value below threshold - Avg:', averageValue.toFixed(4), 'threshold:', this.rehaPianoThreshold);
                    if (rawValues) {
                        const maxChannel = Math.max(...[0, 1, 2, 3, 4, 12, 11, 10, 9, 8].map(i => Math.abs(rawValues[i])));
                        console.log('[Game] 📊 Max channel value:', maxChannel.toFixed(4), '(need', (this.rehaPianoThreshold * 10).toFixed(4), 'for single channel)');
                    }
                    if (Math.abs(averageValue) > 0.01) {
                        console.log('[Game] 💡 Try pressing more keys or use z/x/c for higher intensity');
                    }
                }
                return 0;
            }
            
            // Apply scale factor for sensitivity
            // Mapping: positive values (no shift) = UP, negative values (with shift) = DOWN
            // In the bird: positive velocity = down, negative velocity = up
            // So: positive averageValue → negative velocity → UP
            //     negative averageValue → positive velocity → DOWN
            // 
            // Make velocity directly proportional to input strength (pressure)
            // Higher input values = faster movement
            // Server sends: 0.25 (light), 0.5 (medium with z), 0.75 (strong with x), 1.0 (max with c)
            // Velocity scales linearly: light press = slow, hard press = fast
            
            // Calculate velocity directly proportional to input strength
            // No normalization needed - the values already represent pressure levels
            // Scale factor amplifies the response, and input magnitude determines speed
            let velocity = -averageValue * this.rehaPianoScale;
            
            // The velocity is already proportional because:
            // - averageValue of 0.025 (from 0.25 input) → slower movement
            // - averageValue of 0.1 (from 1.0 input) → 4x faster movement
            
            // Debug: Log the actual values being used
            if (Math.abs(averageValue) > 0.01 && Math.random() < 0.2) {
                const inputMagnitude = Math.abs(averageValue);
                const pressureLevel = inputMagnitude * 4; // Convert to 0-1 scale (0.25 base = 1.0)
                console.log('[Game] 🔍 Pressure level:', pressureLevel.toFixed(2), 'Input:', averageValue.toFixed(4), '→ velocity:', velocity.toFixed(4));
            }
            
            // Clamp to max velocity limits (respecting level progression)
            const maxVelocity = this.getMaxControlVelocity();
            velocity = Math.max(-maxVelocity, Math.min(maxVelocity, velocity));
            
            // Log when we get valid control input (always log first time)
            if (!this.hasLoggedValidInput || Math.abs(velocity) > 0.05) {
                if (!this.hasLoggedValidInput) {
                    this.hasLoggedValidInput = true;
                }
                const direction = velocity < 0 ? 'UP' : velocity > 0 ? 'DOWN' : 'NONE';
                console.log('[Game] ✅ Valid control input! Velocity:', velocity.toFixed(3), 'Direction:', direction, 'from average:', averageValue.toFixed(3));
            }
            
            // Log significant movements for debugging
            if (Math.abs(velocity) > 0.1 && Math.random() < 0.2) {
                console.log('[Game] 🎮 Control velocity:', velocity.toFixed(3), 'from average:', averageValue.toFixed(3));
            }
            
            return velocity;
        }
        
        protected createRehaPianoStatusIndicator(connected: boolean): void {
            // Remove existing indicator if any
            const existing = document.getElementById('rehapiano-status');
            if (existing) {
                existing.remove();
            }
            
            const indicator = document.createElement('div');
            indicator.id = 'rehapiano-status';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 10px 15px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                z-index: 10000;
                background: ${connected ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)'};
                color: white;
                font-weight: bold;
            `;
            indicator.textContent = `RehaPiano: ${connected ? '✅ Connected' : '❌ Disconnected'}`;
            document.body.appendChild(indicator);
            
            // Update status periodically
            setInterval(() => {
                const isConnected = this.rehaPianoEnabled && this.rehaPiano.isConnected;
                const isDataFresh = this.rehaPiano.isDataFresh();
                const avgValue = this.rehaPiano.getAverageFingerValue();
                
                indicator.textContent = `RehaPiano: ${isConnected ? '✅' : '❌'} ${isDataFresh ? '📡' : '⏸️'} ${avgValue.toFixed(2)}`;
                indicator.style.background = isConnected && isDataFresh 
                    ? 'rgba(76, 175, 80, 0.9)' 
                    : isConnected 
                        ? 'rgba(255, 152, 0, 0.9)' 
                        : 'rgba(244, 67, 54, 0.9)';
            }, 500);
        }
    
        protected onReplayTouch() {
            if (this.state === Floppy.Common.GameState.ScoreScreen) {
                this.reset();
            }
        }
    
        protected async reset() {
            this.state = Floppy.Common.GameState.Loading;
            Floppy.Assets.sounds.swoosh.play();
    
            const scoreboard = document.getElementById('scoreboard')!;
            scoreboard.classList.add('slide-up');
            // The above animation takes 600ms, but let's add a bit more delay
            await Helpers.wait(750);
    
            scoreboard.classList.remove('visible', 'slide-up');
            Array.from(scoreboard.getElementsByClassName('visible')).forEach(e => e.classList.remove('visible'));
    
            gameDebugger.resetBoxes();
    
            this.pipes.removeAll();
            this.bird.reset();
            this.currentScore = 0;
            this.keyboardControlVelocity = 0;
            this.targetControlVelocity = 0;
            this.levelProgression.reset();
            this.applyProgressionSettings();
            
            // Attempt to reconnect RehaPiano if it was enabled but disconnected
            if (this.rehaPianoEnabled && !this.rehaPiano.isConnected) {
                this.rehaPiano.connect().then(() => {
                    gameDebugger.log('RehaPiano reconnected');
                }).catch(() => {
                    // Silent fail, will use keyboard fallback
                });
            }
    
            // Find everything that's animated and start it.
            Array.from(document.getElementsByClassName('animated')).forEach(e => {
                (e as HTMLElement).style.animationPlayState = 'running';
                (e as HTMLElement).style.webkitAnimationPlayState = 'running';
            });
    
            this.splash();
        }
    
        protected start() {
            const splashImage = document.getElementById('splash')!;
            splashImage.classList.remove('visible');
            this.state = Floppy.Common.GameState.Playing;
            this.gameLoop = setInterval(this.tick.bind(this), 1000 / 60);
            
            console.log('[Game] 🎮 Game started! Game loop running at 60 FPS');
            if (this.rehaPianoEnabled && this.rehaPiano.isConnected) {
                console.log('[Game] 🎹 RehaPiano control is active - bird will move based on sensor data');
            } else {
                console.log('[Game] ⌨️ Keyboard control is active - use arrow keys or WASD');
            }
    
            // Apply initial progression settings
            this.applyProgressionSettings();
        }
    
        protected async die() {
            clearInterval(this.gameLoop);
    
            this.state = Floppy.Common.GameState.PlayerDying;
    
            // Find everything that's animated and stop it.
            Array.from(document.getElementsByClassName('animated')).forEach(e => {
                (e as HTMLElement).style.animationPlayState = 'paused';
                (e as HTMLElement).style.webkitAnimationPlayState = 'paused';
            });
    
            await this.bird.die();
    
            this.state = Floppy.Common.GameState.PlayerDead;
    
            await Helpers.wait(500);
    
            Floppy.Assets.sounds.swoosh.play();
    
            const scoreboard = document.getElementById('scoreboard')!;
            scoreboard.classList.add('visible');
            // The above animation takes 600ms.
            await Helpers.wait(600);
    
            Floppy.Assets.sounds.swoosh.play();
    
            const replay = document.getElementById('replay')!;
            replay.classList.add('visible');
    
            const wonMedal = this.medals.find(([minimumScore]) => this.currentScore >= minimumScore);
    
            if (wonMedal) {
                gameDebugger.log('Medal won!', wonMedal);
                const medalContainer = document.getElementById('medal')!;
                const medal = new Image();
                medal.src = `assets/medal_${wonMedal[1]}.png`;
                medalContainer.replaceChildren(medal);
                medalContainer.classList.add('visible');
            }
    
            // The above animations takes nearly 1200ms. But we don't need to wait
            // the entirety of it to let them replay if they're in a fit of rage.
            await Helpers.wait(300);
    
            this.state = Floppy.Common.GameState.ScoreScreen;
        }
    
        protected score() {
            gameDebugger.log('Score!');
            Floppy.Assets.sounds.score.play();
    
            this.currentScore++;
    
            if (this.currentScore > this.highScore) {
            gameDebugger.log('New highscore!', this.currentScore);
            this.highScore = this.currentScore;
            }
            
            // Check for level progression
            const progression = this.levelProgression.checkProgression(this.currentScore);
            if (progression.progressed) {
                // Show progression message with description
                this.showProgressionMessage(
                    progression.message || `Level ${progression.level}`,
                    progression.description
                );
                // Apply new settings after a brief delay to let user read the message
                setTimeout(() => {
                    this.applyProgressionSettings();
                }, 500);
            }
        }
        
        protected applyProgressionSettings(): void {
            // Apply tension progression (requires more pressure) - handled dynamically via getMaxControlVelocity()
            // Apply reaction progression (faster pipes, narrower gaps)
            const pipeDelay = this.levelProgression.getPipeDelay();
            const pipeGap = this.levelProgression.getPipeGap();
            
            this.pipes.setPipeDelay(pipeDelay);
            this.pipes.setPipeGap(pipeGap);
        }
        
        protected getMaxControlVelocity(): number {
            return this.levelProgression.getMaxControlVelocity();
        }
        
        protected createProgressionMessageElement(): void {
            const container = document.createElement('div');
            container.id = 'progression-message';
            container.style.cssText = `
                position: absolute;
                top: 15%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 30px 50px;
                border-radius: 15px;
                border: 3px solid #4CAF50;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.5s;
                pointer-events: none;
                text-align: center;
                max-width: 500px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            `;
            
            const title = document.createElement('div');
            title.id = 'progression-title';
            title.style.cssText = `
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 15px;
                color: #4CAF50;
            `;
            
            const description = document.createElement('div');
            description.id = 'progression-description';
            description.style.cssText = `
                font-size: 18px;
                line-height: 1.5;
                color: #E0E0E0;
            `;
            
            container.appendChild(title);
            container.appendChild(description);
            this.domElements.flightArea.appendChild(container);
            this.progressionMessageElement = container;
        }
        
        protected showProgressionMessage(title: string, description?: string): void {
            if (!this.progressionMessageElement) return;
            
            // Clear any existing timeout to reset the timer
            if (this.progressionMessageTimeout) {
                clearTimeout(this.progressionMessageTimeout);
                this.progressionMessageTimeout = null;
            }
            
            const titleElement = this.progressionMessageElement.querySelector('#progression-title') as HTMLElement;
            const descElement = this.progressionMessageElement.querySelector('#progression-description') as HTMLElement;
            
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
            
            // Force show message immediately (reset opacity and display)
            this.progressionMessageElement.style.display = 'block';
            this.progressionMessageElement.style.opacity = '1';
            
            // Set new timeout - each new banner resets the timer to 10 seconds
            // This means if a new banner appears while one is showing, it extends the display time
            this.progressionMessageTimeout = setTimeout(() => {
                if (this.progressionMessageElement) {
                    this.progressionMessageElement.style.opacity = '0';
                    // Don't hide display, just fade out
                }
                this.progressionMessageTimeout = null;
            }, 10000);
        }
    
        protected numberToImageElements(digits: number, size: 'big' | 'small') {
            return digits.toString().split('').map(n => {
                const imgDigit = new Image();
                imgDigit.src = `assets/font_${size}_${n}.png`
                return imgDigit;
            });
        }
    
        protected tick() {
            const now = Date.now();
    
            // Determine control velocity source
            let controlVelocity = 0;
            
            if (this.rehaPianoEnabled && this.rehaPiano.isConnected) {
                // Use RehaPiano sensor data
                controlVelocity = this.getRehaPianoControlVelocity();
                
                // Log first few ticks to verify control is working
                if (!this.hasLoggedTick) {
                    this.hasLoggedTick = true;
                    console.log('[Game] 🔄 Game tick - RehaPiano control velocity:', controlVelocity.toFixed(4));
                }
            } else {
                // Fallback to keyboard control
                this.updateControlVelocity();
                controlVelocity = this.keyboardControlVelocity;
            }
            
            // Apply control velocity to bird
            this.bird.setControlVelocity(controlVelocity);
    
            this.bird.tick();
            this.pipes.tick(now);
    
            let unscoredPipe = this.pipes.nextUnscoredPipe();
    
            if (unscoredPipe && unscoredPipe.hasCrossed(this.bird.box)) {
                unscoredPipe.scored = true;
                this.score();
            }
    
            if (this.pipes.intersectsWith(this.bird.box) || this.land.intersectsWith(this.bird.box)) {
                this.die();
            }
        }
    
        protected draw() {
            requestAnimationFrame(this.draw.bind(this));
    
            this.bird.draw();
        }
    }
}