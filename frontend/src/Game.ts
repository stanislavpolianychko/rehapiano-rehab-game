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
        protected readonly rehaPianoThreshold: number; // minimum avg force to register (normalized ADC units)
        protected readonly rehaPianoScale: number;     // force-to-velocity multiplier
        protected rehaPianoApiBase: string = '';        // HTTP base URL for streamer API
        protected hasLoggedFirstInput: boolean = false;
        protected virtualKeysDown: Set<string> = new Set(); // track keys forwarded to virtual API
    
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
            this.rehaPianoThreshold = options.rehaPianoThreshold ?? 5.0;
            this.rehaPianoScale = options.rehaPianoScale ?? 0.01;
            this.rehaPianoEnabled = options.rehaPianoEnabled ?? true;
            const rehaPianoUrl = options.rehaPianoUrl ?? 'ws://localhost:5555/ws';
            this.rehaPiano = new Floppy.RehaPianoConnection(rehaPianoUrl);

            // Derive HTTP API base from WebSocket URL (ws://host:port/ws → http://host:port)
            this.rehaPianoApiBase = rehaPianoUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');

            if (this.rehaPianoEnabled) {
                console.log('[Game] Connecting to RehaPiano at', rehaPianoUrl);
                this.rehaPiano.connect().then(() => {
                    console.log('[Game] RehaPiano connected');
                    gameDebugger.log('RehaPiano connected');
                    this.createRehaPianoStatusIndicator();
                    // Auto-enable virtual mode on the streamer
                    this.enableVirtualMode();
                }).catch((error) => {
                    console.warn('[Game] RehaPiano connection failed, keyboard fallback:', error);
                    this.rehaPianoEnabled = false;
                    this.createRehaPianoStatusIndicator();
                });
            } else {
                this.createRehaPianoStatusIndicator();
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
        
        // Virtual finger keys: lowercase = compression, Shift+key = extension
        protected static readonly VIRTUAL_KEYS = new Set(['q','w','e','r','t','y','u','i','o','p']);

        protected handleKeyDown(ev: KeyboardEvent): void {
            // Forward virtual finger keys to streamer API
            const keyLower = ev.key.toLowerCase();
            if (Game.VIRTUAL_KEYS.has(keyLower) && this.rehaPianoEnabled && this.rehaPiano.isConnected) {
                if (!this.virtualKeysDown.has(ev.key)) {
                    this.virtualKeysDown.add(ev.key);
                    // Shift held = extension (uppercase key), normal = compression
                    const apiKey = ev.shiftKey ? keyLower.toUpperCase() : keyLower;
                    this.sendVirtualKey(apiKey, 'down');
                }
                ev.preventDefault();
                return;
            }

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
                return;
            }

            if (this.state !== Floppy.Common.GameState.Playing) return;

            if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
                this.targetControlVelocity = -this.getMaxControlVelocity();
            } else if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
                this.targetControlVelocity = this.getMaxControlVelocity();
            }
        }

        protected handleKeyUp(ev: KeyboardEvent): void {
            // Forward virtual finger key releases
            const keyLower = ev.key.toLowerCase();
            if (Game.VIRTUAL_KEYS.has(keyLower) && this.virtualKeysDown.has(ev.key)) {
                this.virtualKeysDown.delete(ev.key);
                this.sendVirtualKey(keyLower, 'up');
                ev.preventDefault();
                return;
            }

            if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W' ||
                ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
                this.targetControlVelocity = 0;
            }
        }
        
        protected enableVirtualMode(): void {
            fetch(`${this.rehaPianoApiBase}/api/virtual/enable`, { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    console.log('[Game] Virtual mode enabled:', data);
                    console.log('[Game] Press Q/W/E/R/T (left) or Y/U/I/O/P (right) for compression');
                    console.log('[Game] Hold Shift + same keys for extension (decompression)');
                })
                .catch(err => console.warn('[Game] Could not enable virtual mode:', err));
        }

        protected sendVirtualKey(key: string, action: 'down' | 'up'): void {
            fetch(`${this.rehaPianoApiBase}/api/virtual/key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, action }),
            }).catch(() => {}); // fire-and-forget
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
            if (!this.rehaPianoEnabled || !this.rehaPiano.isConnected) return 0;
            if (!this.rehaPiano.isDataFresh()) return 0;

            // Average finger force across all connected hands (normalized ADC)
            // Positive = compression (pressing down), Negative = extension (lifting up)
            const avgForce = this.rehaPiano.getAverageFingerValue();

            // Dead zone: ignore noise below threshold
            if (Math.abs(avgForce) < this.rehaPianoThreshold) return 0;

            // Direct signed mapping:
            //   Compression (positive force) → positive velocity → bird moves DOWN
            //   Extension (negative force)   → negative velocity → bird moves UP
            // This is intuitive: extend/lift fingers = bird flies up
            let velocity = avgForce * this.rehaPianoScale;

            // Clamp to max velocity (respecting level progression)
            const maxVelocity = this.getMaxControlVelocity();
            velocity = Math.max(-maxVelocity, Math.min(maxVelocity, velocity));

            if (!this.hasLoggedFirstInput && Math.abs(velocity) > 0.01) {
                this.hasLoggedFirstInput = true;
                const dir = avgForce > 0 ? 'compression/DOWN' : 'extension/UP';
                console.log('[Game] RehaPiano input — force:', avgForce.toFixed(1), dir, 'velocity:', velocity.toFixed(3));
            }

            return velocity;
        }
        
        protected createRehaPianoStatusIndicator(): void {
            const existing = document.getElementById('rehapiano-status');
            if (existing) existing.remove();

            const indicator = document.createElement('div');
            indicator.id = 'rehapiano-status';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 8px 12px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 11px;
                z-index: 10000;
                color: white;
                font-weight: bold;
                background: rgba(244, 67, 54, 0.9);
            `;
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
                indicator.style.background = wsOk && (left || right) && fresh
                    ? 'rgba(76, 175, 80, 0.9)'
                    : wsOk
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
            
            console.log('[Game] Started. Control:', this.rehaPianoEnabled && this.rehaPiano.isConnected ? 'RehaPiano' : 'Keyboard');
    
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
                controlVelocity = this.getRehaPianoControlVelocity();
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