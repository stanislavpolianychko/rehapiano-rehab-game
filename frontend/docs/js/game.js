"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var Helpers;
(function (Helpers) {
    var _this = this;
    Helpers.wait = function (time) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2, new Promise(function (resolve) {
                    setTimeout(resolve, time);
                })];
        });
    }); };
    Helpers.toRad = function (degrees) {
        return degrees * Math.PI / 180;
    };
    Helpers.isBoxIntersecting = function (a, b) {
        return (a.x <= (b.x + b.width) &&
            b.x <= (a.x + a.width) &&
            a.y <= (b.y + b.height) &&
            b.y <= (a.y + a.height));
    };
})(Helpers || (Helpers = {}));
var Floppy;
(function (Floppy) {
    var testLocalStorageWorks = function () {
        try {
            window.localStorage.setItem('test', 'test');
            window.localStorage.removeItem('test');
            return true;
        }
        catch (_a) {
            return false;
        }
    };
    var isLsEnabled = testLocalStorageWorks();
    Floppy.storage = {
        setHighScore: function (score) {
            if (!isLsEnabled) {
                return;
            }
            window.localStorage.setItem('highscore', score.toString());
        },
        getHighScore: function () {
            var _a;
            if (!isLsEnabled) {
                return 0;
            }
            return parseInt((_a = window.localStorage.getItem('highscore')) !== null && _a !== void 0 ? _a : '0');
        },
    };
})(Floppy || (Floppy = {}));
var Floppy;
(function (Floppy) {
    var Assets;
    (function (Assets) {
        Assets.sounds = {
            jump: new Howl({ src: ['assets/sounds/sfx_wing.ogg'], volume: 0.3 }),
            score: new Howl({ src: ['assets/sounds/sfx_point.ogg'], volume: 0.3 }),
            hit: new Howl({ src: ['assets/sounds/sfx_hit.ogg'], volume: 0.3 }),
            die: new Howl({ src: ['assets/sounds/sfx_die.ogg'], volume: 0.3 }),
            swoosh: new Howl({ src: ['assets/sounds/sfx_swooshing.ogg'], volume: 0.3 }),
        };
    })(Assets = Floppy.Assets || (Floppy.Assets = {}));
})(Floppy || (Floppy = {}));
var Floppy;
(function (Floppy) {
    var Bird = (function () {
        function Bird(domElement, flyingProperties) {
            this.controlVelocity = 0;
            this.domElement = domElement;
            this.flyingProperties = flyingProperties;
            this.reset();
        }
        Bird.prototype.reset = function () {
            this.width = 34;
            this.height = 24;
            this.velocity = 0;
            this.position = 180;
            this.rotation = 0;
            this.controlVelocity = 0;
            this.box = { x: 60, y: 180, width: 34, height: 24 };
        };
        Bird.prototype.jump = function () {
        };
        Bird.prototype.setControlVelocity = function (velocity) {
            this.controlVelocity = velocity;
        };
        Bird.prototype.die = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.domElement.style.transition = "\n                transform 1s cubic-bezier(0.65, 0, 0.35, 1)\n            ";
                            this.position = this.flyingProperties.flightAreaBox.height - this.height;
                            this.rotation = 90;
                            Floppy.Assets.sounds.hit.play();
                            return [4, Helpers.wait(500)];
                        case 1:
                            _a.sent();
                            Floppy.Assets.sounds.die.play();
                            return [4, Helpers.wait(500)];
                        case 2:
                            _a.sent();
                            this.domElement.style.transition = '';
                            return [2];
                    }
                });
            });
        };
        Bird.prototype.tick = function () {
            this.velocity = this.controlVelocity;
            this.rotation = Math.min((this.velocity / 10) * 90, 90);
            this.position += this.velocity;
            if (this.position < 0) {
                this.position = 0;
            }
            if (this.position > this.flyingProperties.flightAreaBox.height) {
                this.position = this.flyingProperties.flightAreaBox.height;
            }
            var rotationInRadians = Math.abs(Helpers.toRad(this.rotation));
            var widthMultiplier = this.height - this.width;
            var heightMultiplier = this.width - this.height;
            this.box.width = this.width + (widthMultiplier * Math.sin(rotationInRadians));
            this.box.height = this.height + (heightMultiplier * Math.sin(rotationInRadians));
            var xShift = (this.width - this.box.width) / 2;
            var yShift = (this.height - this.box.height) / 2;
            this.box.x = 60 + xShift;
            this.box.y = this.position + yShift + this.flyingProperties.flightAreaBox.y;
        };
        Bird.prototype.draw = function () {
            gameDebugger.drawBox(this.domElement, this.box);
            this.domElement.style.transform = "\n                translate3d(0px, " + this.position + "px, 0px)\n                rotate3d(0, 0, 1, " + this.rotation + "deg)\n            ";
        };
        return Bird;
    }());
    Floppy.Bird = Bird;
})(Floppy || (Floppy = {}));
var Floppy;
(function (Floppy) {
    var Common;
    (function (Common) {
        var GameState;
        (function (GameState) {
            GameState[GameState["Loading"] = 0] = "Loading";
            GameState[GameState["SplashScreen"] = 1] = "SplashScreen";
            GameState[GameState["Playing"] = 2] = "Playing";
            GameState[GameState["PlayerDying"] = 3] = "PlayerDying";
            GameState[GameState["PlayerDead"] = 4] = "PlayerDead";
            GameState[GameState["ScoreScreen"] = 5] = "ScoreScreen";
        })(GameState = Common.GameState || (Common.GameState = {}));
    })(Common = Floppy.Common || (Floppy.Common = {}));
})(Floppy || (Floppy = {}));
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var Floppy;
(function (Floppy) {
    var Game = (function () {
        function Game(domElements, options) {
            var _this = this;
            var _a, _b, _c, _d;
            this.keyboardControlVelocity = 0;
            this.targetControlVelocity = 0;
            this.BASE_MAX_CONTROL_VELOCITY = 0.5;
            this.progressionMessageElement = null;
            this.progressionMessageTimeout = null;
            this.rehaPianoEnabled = false;
            this.rehaPianoApiBase = '';
            this.hasLoggedFirstInput = false;
            this.virtualKeysDown = new Set();
            this.medals = [
                [40, 'platinum'],
                [30, 'gold'],
                [20, 'silver'],
                [10, 'bronze'],
            ];
            this.domElements = domElements;
            this.bird = new Floppy.Bird(domElements.bird, {
                gravity: 0,
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
            this.rehaPianoThreshold = (_a = options.rehaPianoThreshold) !== null && _a !== void 0 ? _a : 5.0;
            this.rehaPianoScale = (_b = options.rehaPianoScale) !== null && _b !== void 0 ? _b : 0.01;
            this.rehaPianoEnabled = (_c = options.rehaPianoEnabled) !== null && _c !== void 0 ? _c : true;
            var rehaPianoUrl = (_d = options.rehaPianoUrl) !== null && _d !== void 0 ? _d : 'ws://localhost:5555/ws';
            this.rehaPiano = new Floppy.RehaPianoConnection(rehaPianoUrl);
            this.rehaPianoApiBase = rehaPianoUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
            if (this.rehaPianoEnabled) {
                console.log('[Game] Connecting to RehaPiano at', rehaPianoUrl);
                this.rehaPiano.connect().then(function () {
                    console.log('[Game] RehaPiano connected');
                    gameDebugger.log('RehaPiano connected');
                    _this.createRehaPianoStatusIndicator();
                    _this.enableVirtualMode();
                }).catch(function (error) {
                    console.warn('[Game] RehaPiano connection failed, keyboard fallback:', error);
                    _this.rehaPianoEnabled = false;
                    _this.createRehaPianoStatusIndicator();
                });
            }
            else {
                this.createRehaPianoStatusIndicator();
            }
            this.createProgressionMessageElement();
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            document.addEventListener('keyup', this.handleKeyUp.bind(this));
            requestAnimationFrame(this.draw.bind(this));
        }
        Game.prototype.onScreenTouch = function (_ev) {
            if (this.state === Floppy.Common.GameState.SplashScreen) {
                this.start();
            }
            else if (this.state === Floppy.Common.GameState.ScoreScreen) {
                this.reset();
            }
        };
        Game.prototype.splash = function () {
            return __awaiter(this, void 0, void 0, function () {
                var splashImage;
                return __generator(this, function (_a) {
                    splashImage = document.getElementById('splash');
                    splashImage.classList.add('visible');
                    Floppy.Assets.sounds.swoosh.play();
                    this.state = Floppy.Common.GameState.SplashScreen;
                    return [2];
                });
            });
        };
        Object.defineProperty(Game.prototype, "state", {
            get: function () {
                return this._state;
            },
            set: function (newState) {
                gameDebugger.logStateChange(this._state, newState);
                document.body.className = "state-" + Floppy.Common.GameState[newState];
                this._state = newState;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Game.prototype, "currentScore", {
            get: function () {
                return this._currentScore;
            },
            set: function (newScore) {
                var _a, _b;
                this._currentScore = newScore;
                (_a = this.domElements.bigScore).replaceChildren.apply(_a, __spreadArray([], __read(this.numberToImageElements(newScore, 'big')), false));
                (_b = this.domElements.currentScore).replaceChildren.apply(_b, __spreadArray([], __read(this.numberToImageElements(newScore, 'small')), false));
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Game.prototype, "highScore", {
            get: function () {
                return this._highScore;
            },
            set: function (newScore) {
                var _a;
                this._highScore = newScore;
                (_a = this.domElements.highScore).replaceChildren.apply(_a, __spreadArray([], __read(this.numberToImageElements(newScore, 'small')), false));
                Floppy.storage.setHighScore(newScore);
            },
            enumerable: false,
            configurable: true
        });
        Game.prototype.setGameOptionButtons = function (options) {
            var optionsButtons = document.getElementById('game-options');
            var easyMode = optionsButtons.getElementsByClassName('option-easy')[0];
            var debugMode = optionsButtons.getElementsByClassName('option-debug')[0];
            easyMode.innerText = "easy mode (" + (options.isEasyModeOn ? 'ON' : 'OFF') + ")";
            easyMode.href = '?';
            easyMode.href += options.isEasyModeOn ? '' : 'easy';
            easyMode.href += options.isDebugOn ? 'debug' : '';
            debugMode.innerText = "debug (" + (options.isDebugOn ? 'ON' : 'OFF') + ")";
            debugMode.href = '?';
            debugMode.href += options.isEasyModeOn ? 'easy' : '';
            debugMode.href += options.isDebugOn ? '' : 'debug';
        };
        Game.prototype.handleKeyDown = function (ev) {
            var keyLower = ev.key.toLowerCase();
            if (Game.VIRTUAL_KEYS.has(keyLower) && this.rehaPianoEnabled && this.rehaPiano.isConnected) {
                if (!this.virtualKeysDown.has(ev.key)) {
                    this.virtualKeysDown.add(ev.key);
                    var apiKey = ev.shiftKey ? keyLower.toUpperCase() : keyLower;
                    this.sendVirtualKey(apiKey, 'down');
                }
                ev.preventDefault();
                return;
            }
            if (this.state === Floppy.Common.GameState.SplashScreen) {
                this.start();
                return;
            }
            if (this.state === Floppy.Common.GameState.ScoreScreen) {
                this.reset();
                return;
            }
            if (this.rehaPianoEnabled && this.rehaPiano.isConnected) {
                return;
            }
            if (this.state !== Floppy.Common.GameState.Playing)
                return;
            if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
                this.targetControlVelocity = -this.getMaxControlVelocity();
            }
            else if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
                this.targetControlVelocity = this.getMaxControlVelocity();
            }
        };
        Game.prototype.handleKeyUp = function (ev) {
            var keyLower = ev.key.toLowerCase();
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
        };
        Game.prototype.enableVirtualMode = function () {
            fetch(this.rehaPianoApiBase + "/api/virtual/enable", { method: 'POST' })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                console.log('[Game] Virtual mode enabled:', data);
                console.log('[Game] Press Q/W/E/R/T (left) or Y/U/I/O/P (right) for compression');
                console.log('[Game] Hold Shift + same keys for extension (decompression)');
            })
                .catch(function (err) { return console.warn('[Game] Could not enable virtual mode:', err); });
        };
        Game.prototype.sendVirtualKey = function (key, action) {
            fetch(this.rehaPianoApiBase + "/api/virtual/key", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: key, action: action }),
            }).catch(function () { });
        };
        Game.prototype.updateControlVelocity = function () {
            var accelerationRate = this.levelProgression.getAccelerationRate();
            var diff = this.targetControlVelocity - this.keyboardControlVelocity;
            if (Math.abs(diff) > 0.01) {
                this.keyboardControlVelocity += Math.sign(diff) * Math.min(Math.abs(diff), accelerationRate);
            }
            else {
                this.keyboardControlVelocity = this.targetControlVelocity;
            }
        };
        Game.prototype.getRehaPianoControlVelocity = function () {
            if (!this.rehaPianoEnabled || !this.rehaPiano.isConnected)
                return 0;
            if (!this.rehaPiano.isDataFresh())
                return 0;
            var avgForce = this.rehaPiano.getAverageFingerValue();
            if (Math.abs(avgForce) < this.rehaPianoThreshold)
                return 0;
            var velocity = avgForce * this.rehaPianoScale;
            var maxVelocity = this.getMaxControlVelocity();
            velocity = Math.max(-maxVelocity, Math.min(maxVelocity, velocity));
            if (!this.hasLoggedFirstInput && Math.abs(velocity) > 0.01) {
                this.hasLoggedFirstInput = true;
                var dir = avgForce > 0 ? 'compression/DOWN' : 'extension/UP';
                console.log('[Game] RehaPiano input — force:', avgForce.toFixed(1), dir, 'velocity:', velocity.toFixed(3));
            }
            return velocity;
        };
        Game.prototype.createRehaPianoStatusIndicator = function () {
            var _this = this;
            var existing = document.getElementById('rehapiano-status');
            if (existing)
                existing.remove();
            var indicator = document.createElement('div');
            indicator.id = 'rehapiano-status';
            indicator.style.cssText = "\n                position: fixed;\n                top: 10px;\n                right: 10px;\n                padding: 8px 12px;\n                border-radius: 5px;\n                font-family: monospace;\n                font-size: 11px;\n                z-index: 10000;\n                color: white;\n                font-weight: bold;\n                background: rgba(244, 67, 54, 0.9);\n            ";
            document.body.appendChild(indicator);
            setInterval(function () {
                var wsOk = _this.rehaPianoEnabled && _this.rehaPiano.isConnected;
                var left = _this.rehaPiano.leftHandConnected;
                var right = _this.rehaPiano.rightHandConnected;
                var fresh = _this.rehaPiano.isDataFresh();
                var avg = _this.rehaPiano.getAverageFingerValue();
                var parts = ['RP:'];
                if (!wsOk) {
                    parts.push('disconnected');
                }
                else {
                    parts.push(left ? 'L:ok' : 'L:--');
                    parts.push(right ? 'R:ok' : 'R:--');
                    if (fresh)
                        parts.push(avg.toFixed(0));
                }
                indicator.textContent = parts.join(' ');
                indicator.style.background = wsOk && (left || right) && fresh
                    ? 'rgba(76, 175, 80, 0.9)'
                    : wsOk
                        ? 'rgba(255, 152, 0, 0.9)'
                        : 'rgba(244, 67, 54, 0.9)';
            }, 500);
        };
        Game.prototype.onReplayTouch = function () {
            if (this.state === Floppy.Common.GameState.ScoreScreen) {
                this.reset();
            }
        };
        Game.prototype.reset = function () {
            return __awaiter(this, void 0, void 0, function () {
                var scoreboard;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.state = Floppy.Common.GameState.Loading;
                            Floppy.Assets.sounds.swoosh.play();
                            scoreboard = document.getElementById('scoreboard');
                            scoreboard.classList.add('slide-up');
                            return [4, Helpers.wait(750)];
                        case 1:
                            _a.sent();
                            scoreboard.classList.remove('visible', 'slide-up');
                            Array.from(scoreboard.getElementsByClassName('visible')).forEach(function (e) { return e.classList.remove('visible'); });
                            gameDebugger.resetBoxes();
                            this.pipes.removeAll();
                            this.bird.reset();
                            this.currentScore = 0;
                            this.keyboardControlVelocity = 0;
                            this.targetControlVelocity = 0;
                            this.levelProgression.reset();
                            this.applyProgressionSettings();
                            if (this.rehaPianoEnabled && !this.rehaPiano.isConnected) {
                                this.rehaPiano.connect().then(function () {
                                    gameDebugger.log('RehaPiano reconnected');
                                }).catch(function () {
                                });
                            }
                            Array.from(document.getElementsByClassName('animated')).forEach(function (e) {
                                e.style.animationPlayState = 'running';
                                e.style.webkitAnimationPlayState = 'running';
                            });
                            this.splash();
                            return [2];
                    }
                });
            });
        };
        Game.prototype.start = function () {
            var splashImage = document.getElementById('splash');
            splashImage.classList.remove('visible');
            this.state = Floppy.Common.GameState.Playing;
            this.gameLoop = setInterval(this.tick.bind(this), 1000 / 60);
            console.log('[Game] Started. Control:', this.rehaPianoEnabled && this.rehaPiano.isConnected ? 'RehaPiano' : 'Keyboard');
            this.applyProgressionSettings();
        };
        Game.prototype.die = function () {
            return __awaiter(this, void 0, void 0, function () {
                var scoreboard, replay, wonMedal, medalContainer, medal;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            clearInterval(this.gameLoop);
                            this.state = Floppy.Common.GameState.PlayerDying;
                            Array.from(document.getElementsByClassName('animated')).forEach(function (e) {
                                e.style.animationPlayState = 'paused';
                                e.style.webkitAnimationPlayState = 'paused';
                            });
                            return [4, this.bird.die()];
                        case 1:
                            _a.sent();
                            this.state = Floppy.Common.GameState.PlayerDead;
                            return [4, Helpers.wait(500)];
                        case 2:
                            _a.sent();
                            Floppy.Assets.sounds.swoosh.play();
                            scoreboard = document.getElementById('scoreboard');
                            scoreboard.classList.add('visible');
                            return [4, Helpers.wait(600)];
                        case 3:
                            _a.sent();
                            Floppy.Assets.sounds.swoosh.play();
                            replay = document.getElementById('replay');
                            replay.classList.add('visible');
                            wonMedal = this.medals.find(function (_a) {
                                var _b = __read(_a, 1), minimumScore = _b[0];
                                return _this.currentScore >= minimumScore;
                            });
                            if (wonMedal) {
                                gameDebugger.log('Medal won!', wonMedal);
                                medalContainer = document.getElementById('medal');
                                medal = new Image();
                                medal.src = "assets/medal_" + wonMedal[1] + ".png";
                                medalContainer.replaceChildren(medal);
                                medalContainer.classList.add('visible');
                            }
                            return [4, Helpers.wait(300)];
                        case 4:
                            _a.sent();
                            this.state = Floppy.Common.GameState.ScoreScreen;
                            return [2];
                    }
                });
            });
        };
        Game.prototype.score = function () {
            var _this = this;
            gameDebugger.log('Score!');
            Floppy.Assets.sounds.score.play();
            this.currentScore++;
            if (this.currentScore > this.highScore) {
                gameDebugger.log('New highscore!', this.currentScore);
                this.highScore = this.currentScore;
            }
            var progression = this.levelProgression.checkProgression(this.currentScore);
            if (progression.progressed) {
                this.showProgressionMessage(progression.message || "Level " + progression.level, progression.description);
                setTimeout(function () {
                    _this.applyProgressionSettings();
                }, 500);
            }
        };
        Game.prototype.applyProgressionSettings = function () {
            var pipeDelay = this.levelProgression.getPipeDelay();
            var pipeGap = this.levelProgression.getPipeGap();
            this.pipes.setPipeDelay(pipeDelay);
            this.pipes.setPipeGap(pipeGap);
        };
        Game.prototype.getMaxControlVelocity = function () {
            return this.levelProgression.getMaxControlVelocity();
        };
        Game.prototype.createProgressionMessageElement = function () {
            var container = document.createElement('div');
            container.id = 'progression-message';
            container.style.cssText = "\n                position: absolute;\n                top: 15%;\n                left: 50%;\n                transform: translateX(-50%);\n                background: rgba(0, 0, 0, 0.9);\n                color: white;\n                padding: 30px 50px;\n                border-radius: 15px;\n                border: 3px solid #4CAF50;\n                z-index: 1000;\n                opacity: 0;\n                transition: opacity 0.5s;\n                pointer-events: none;\n                text-align: center;\n                max-width: 500px;\n                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);\n            ";
            var title = document.createElement('div');
            title.id = 'progression-title';
            title.style.cssText = "\n                font-size: 28px;\n                font-weight: bold;\n                margin-bottom: 15px;\n                color: #4CAF50;\n            ";
            var description = document.createElement('div');
            description.id = 'progression-description';
            description.style.cssText = "\n                font-size: 18px;\n                line-height: 1.5;\n                color: #E0E0E0;\n            ";
            container.appendChild(title);
            container.appendChild(description);
            this.domElements.flightArea.appendChild(container);
            this.progressionMessageElement = container;
        };
        Game.prototype.showProgressionMessage = function (title, description) {
            var _this = this;
            if (!this.progressionMessageElement)
                return;
            if (this.progressionMessageTimeout) {
                clearTimeout(this.progressionMessageTimeout);
                this.progressionMessageTimeout = null;
            }
            var titleElement = this.progressionMessageElement.querySelector('#progression-title');
            var descElement = this.progressionMessageElement.querySelector('#progression-description');
            if (titleElement) {
                titleElement.textContent = title;
            }
            if (descElement) {
                if (description) {
                    descElement.textContent = description;
                    descElement.style.display = 'block';
                }
                else {
                    descElement.style.display = 'none';
                }
            }
            this.progressionMessageElement.style.display = 'block';
            this.progressionMessageElement.style.opacity = '1';
            this.progressionMessageTimeout = setTimeout(function () {
                if (_this.progressionMessageElement) {
                    _this.progressionMessageElement.style.opacity = '0';
                }
                _this.progressionMessageTimeout = null;
            }, 10000);
        };
        Game.prototype.numberToImageElements = function (digits, size) {
            return digits.toString().split('').map(function (n) {
                var imgDigit = new Image();
                imgDigit.src = "assets/font_" + size + "_" + n + ".png";
                return imgDigit;
            });
        };
        Game.prototype.tick = function () {
            var now = Date.now();
            var controlVelocity = 0;
            if (this.rehaPianoEnabled && this.rehaPiano.isConnected) {
                controlVelocity = this.getRehaPianoControlVelocity();
            }
            else {
                this.updateControlVelocity();
                controlVelocity = this.keyboardControlVelocity;
            }
            this.bird.setControlVelocity(controlVelocity);
            this.bird.tick();
            this.pipes.tick(now);
            var unscoredPipe = this.pipes.nextUnscoredPipe();
            if (unscoredPipe && unscoredPipe.hasCrossed(this.bird.box)) {
                unscoredPipe.scored = true;
                this.score();
            }
            if (this.pipes.intersectsWith(this.bird.box) || this.land.intersectsWith(this.bird.box)) {
                this.die();
            }
        };
        Game.prototype.draw = function () {
            requestAnimationFrame(this.draw.bind(this));
            this.bird.draw();
        };
        Game.VIRTUAL_KEYS = new Set(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']);
        return Game;
    }());
    Floppy.Game = Game;
})(Floppy || (Floppy = {}));
var Floppy;
(function (Floppy) {
    var GameDebugger = (function () {
        function GameDebugger(enabled) {
            this.domLogs = document.getElementById('debug-logs');
            this.domState = document.getElementById('debug-state');
            this.domBoxContainer = document.getElementById('debug');
            this.domBoxes = new Map();
            this.enabled = enabled;
        }
        GameDebugger.prototype.drawBox = function (key, box) {
            if (!this.enabled) {
                return;
            }
            if (!this.domBoxes.has(key)) {
                var newDebugBox = document.createElement('div');
                newDebugBox.className = 'boundingbox';
                this.domBoxContainer.appendChild(newDebugBox);
                this.domBoxes.set(key, newDebugBox);
            }
            var boudingBox = this.domBoxes.get(key);
            if (boudingBox == null) {
                this.log("couldn't create a debug box for " + key);
                return;
            }
            boudingBox.style.top = box.y + "px";
            boudingBox.style.left = box.x + "px";
            boudingBox.style.width = box.width + "px";
            boudingBox.style.height = box.height + "px";
        };
        GameDebugger.prototype.resetBoxes = function () {
            var _this = this;
            if (!this.enabled) {
                return;
            }
            this.domBoxes.forEach(function (debugBox, pipe) {
                if (pipe.className.includes('pipe')) {
                    debugBox.remove();
                    _this.domBoxes.delete(pipe);
                }
            });
        };
        GameDebugger.prototype.logStateChange = function (oldState, newState) {
            if (!this.enabled) {
                return;
            }
            this.log('Changing state', Floppy.Common.GameState[oldState], Floppy.Common.GameState[newState]);
            this.domState.innerText = Floppy.Common.GameState[newState];
        };
        GameDebugger.prototype.log = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (!this.enabled) {
                return;
            }
            var shortTime = ("00000" + Date.now() % 100000).slice(-5);
            console.log.apply(console, __spreadArray(["[" + shortTime + "]"], __read(args), false));
            this.domLogs.innerText += "[" + shortTime + "] " + args.map(function (a) { return a === null || a === void 0 ? void 0 : a.toString(); }).join(' ') + "\n";
        };
        return GameDebugger;
    }());
    Floppy.GameDebugger = GameDebugger;
})(Floppy || (Floppy = {}));
var Floppy;
(function (Floppy) {
    var Land = (function () {
        function Land(domElement) {
            this.domElement = domElement;
            this.box = domElement.getBoundingClientRect();
            gameDebugger.drawBox(this.domElement, this.box);
        }
        Land.prototype.intersectsWith = function (box) {
            return Helpers.isBoxIntersecting(this.box, box);
        };
        return Land;
    }());
    Floppy.Land = Land;
})(Floppy || (Floppy = {}));
var Floppy;
(function (Floppy) {
    var LevelProgression = (function () {
        function LevelProgression() {
            this.PROGRESSION_INTERVAL = 5;
            this.MAX_LEVEL = 1000;
            this.BASE_VELOCITY = 0.5;
            this.BASE_DELAY = 5000;
            this.BASE_GAP = 140;
            this.VELOCITY_REDUCTION_PER_STEP = 0.008;
            this.DELAY_REDUCTION_PER_STEP = 40;
            this.GAP_REDUCTION_PER_STEP = 1.5;
            this.ACCELERATION_RATE_REDUCTION_PER_STEP = 0.002;
            this.MIN_VELOCITY = 0.3;
            this.MIN_DELAY = 2000;
            this.MIN_GAP = 90;
            this.currentLevel = 0;
            this.lastProgressionScore = 0;
            this.activeProgressions = new Map();
            this.PROGRESSION_TYPES = [
                'hand_tension',
                'fast_reaction',
                'precision_control',
                'speed_challenge',
                'endurance',
                'coordination',
                'fine_motor',
                'range_of_motion'
            ];
        }
        LevelProgression.prototype.getLevel = function () {
            return this.currentLevel;
        };
        LevelProgression.prototype.checkProgression = function (score) {
            var scoreIncrease = score - this.lastProgressionScore;
            if (scoreIncrease >= this.PROGRESSION_INTERVAL) {
                this.currentLevel++;
                this.lastProgressionScore = score;
                var progressionType = void 0;
                var message = void 0;
                var description = void 0;
                if (this.currentLevel === 1) {
                    message = "Level " + this.currentLevel + ": Getting Started";
                    description = "Great job! The game will gradually become more challenging. You'll adapt step by step!";
                }
                else {
                    progressionType = this.selectRandomProgressionType();
                    var currentSteps = this.activeProgressions.get(progressionType) || 0;
                    this.activeProgressions.set(progressionType, currentSteps + 1);
                    var stepCount = this.activeProgressions.get(progressionType) || 1;
                    var messageData = this.getProgressionMessage(progressionType, stepCount);
                    message = messageData.message;
                    description = messageData.description;
                }
                return {
                    progressed: true,
                    level: this.currentLevel,
                    progressionType: progressionType,
                    message: message,
                    description: description
                };
            }
            return {
                progressed: false,
                level: this.currentLevel
            };
        };
        LevelProgression.prototype.selectRandomProgressionType = function () {
            var randomIndex = Math.floor(Math.random() * this.PROGRESSION_TYPES.length);
            return this.PROGRESSION_TYPES[randomIndex];
        };
        LevelProgression.prototype.getProgressionMessage = function (type, stepCount) {
            var level = this.currentLevel;
            switch (type) {
                case 'hand_tension':
                    return {
                        message: "Level " + level + ": More Hand Tension",
                        description: "Step " + stepCount + ": You'll need to press/extend your hand with more force to move the bird. Build your strength gradually!"
                    };
                case 'fast_reaction':
                    var delay = Math.round(this.getPipeDelay() / 1000);
                    return {
                        message: "Level " + level + ": Fast Reaction",
                        description: "Step " + stepCount + ": Barriers will appear more often (every " + delay + "s). React quickly and stay alert!"
                    };
                case 'precision_control':
                    var gap = Math.round(this.getPipeGap());
                    return {
                        message: "Level " + level + ": Precision Control",
                        description: "Step " + stepCount + ": Openings are getting narrower (" + gap + "px). Move with precision and control!"
                    };
                case 'speed_challenge':
                    return {
                        message: "Level " + level + ": Speed Challenge",
                        description: "Step " + stepCount + ": Movement response is faster. Practice smooth, controlled movements!"
                    };
                case 'endurance':
                    return {
                        message: "Level " + level + ": Endurance Training",
                        description: "Step " + stepCount + ": Longer sessions ahead. Build your endurance and maintain steady control!"
                    };
                case 'coordination':
                    return {
                        message: "Level " + level + ": Hand Coordination",
                        description: "Step " + stepCount + ": Practice using both extension and compression. Coordinate your movements smoothly!"
                    };
                case 'fine_motor':
                    return {
                        message: "Level " + level + ": Fine Motor Control",
                        description: "Step " + stepCount + ": Smaller, more precise movements are needed. Focus on fine motor skills!"
                    };
                case 'range_of_motion':
                    return {
                        message: "Level " + level + ": Full Range of Motion",
                        description: "Step " + stepCount + ": Use full extension and compression. Expand your range of motion gradually!"
                    };
                default:
                    return {
                        message: "Level " + level,
                        description: "Keep going! The challenge continues to grow gradually."
                    };
            }
        };
        LevelProgression.prototype.getMaxControlVelocity = function () {
            var velocity = this.BASE_VELOCITY;
            var tensionSteps = this.activeProgressions.get('hand_tension') || 0;
            if (tensionSteps > 0) {
                var reduction = tensionSteps * this.VELOCITY_REDUCTION_PER_STEP;
                velocity = Math.max(this.MIN_VELOCITY, velocity - reduction);
            }
            var speedSteps = this.activeProgressions.get('speed_challenge') || 0;
            if (speedSteps > 0) {
                velocity = Math.min(velocity * 1.1, this.BASE_VELOCITY * 1.2);
            }
            return velocity;
        };
        LevelProgression.prototype.getAccelerationRate = function () {
            var baseRate = 0.05;
            var speedSteps = this.activeProgressions.get('speed_challenge') || 0;
            if (speedSteps > 0) {
                var reduction = speedSteps * this.ACCELERATION_RATE_REDUCTION_PER_STEP;
                return Math.max(0.02, baseRate - reduction);
            }
            return baseRate;
        };
        LevelProgression.prototype.getPipeDelay = function () {
            var delay = this.BASE_DELAY;
            var reactionSteps = this.activeProgressions.get('fast_reaction') || 0;
            if (reactionSteps > 0) {
                var reduction = reactionSteps * this.DELAY_REDUCTION_PER_STEP;
                delay = Math.max(this.MIN_DELAY, delay - reduction);
            }
            var enduranceSteps = this.activeProgressions.get('endurance') || 0;
            if (enduranceSteps > 0) {
                var reduction = enduranceSteps * (this.DELAY_REDUCTION_PER_STEP * 0.5);
                delay = Math.max(this.MIN_DELAY, delay - reduction);
            }
            return delay;
        };
        LevelProgression.prototype.getPipeGap = function () {
            var gap = this.BASE_GAP;
            var precisionSteps = this.activeProgressions.get('precision_control') || 0;
            if (precisionSteps > 0) {
                var reduction = precisionSteps * this.GAP_REDUCTION_PER_STEP;
                gap = Math.max(this.MIN_GAP, gap - reduction);
            }
            var reactionSteps = this.activeProgressions.get('fast_reaction') || 0;
            if (reactionSteps > 0) {
                var reduction = reactionSteps * (this.GAP_REDUCTION_PER_STEP * 0.3);
                gap = Math.max(this.MIN_GAP, gap - reduction);
            }
            return gap;
        };
        LevelProgression.prototype.getActiveProgressions = function () {
            return Array.from(this.activeProgressions.keys());
        };
        LevelProgression.prototype.reset = function () {
            this.currentLevel = 0;
            this.lastProgressionScore = 0;
            this.activeProgressions.clear();
        };
        return LevelProgression;
    }());
    Floppy.LevelProgression = LevelProgression;
})(Floppy || (Floppy = {}));
var Floppy;
(function (Floppy) {
    var Pipe = (function () {
        function Pipe(options) {
            this.scored = false;
            this.upperBox = { x: 0, y: 0, width: 0, height: 0 };
            this.lowerBox = { x: 0, y: 0, width: 0, height: 0 };
            this.domElement = document.createElement('div');
            this.domElement.className = 'pipe animated';
            this.upperPipeDomElement = document.createElement('div');
            this.upperPipeDomElement.className = 'pipe_upper';
            this.upperPipeDomElement.style.height = options.topPipeHeight + "px";
            this.lowerPipeDomElement = document.createElement('div');
            this.lowerPipeDomElement.className = 'pipe_lower';
            this.lowerPipeDomElement.style.height = options.bottomPipeHeight + "px";
            this.domElement.appendChild(this.upperPipeDomElement);
            this.domElement.appendChild(this.lowerPipeDomElement);
        }
        Pipe.prototype.isOffScreen = function () {
            return this.upperBox.x <= -100;
        };
        Pipe.prototype.hasCrossed = function (box) {
            return this.upperBox.width !== 0 && this.upperBox.x + this.upperBox.width <= box.x;
        };
        Pipe.prototype.intersectsWith = function (box) {
            return Helpers.isBoxIntersecting(this.upperBox, box) || Helpers.isBoxIntersecting(this.lowerBox, box);
        };
        Pipe.prototype.tick = function () {
            this.upperBox = this.upperPipeDomElement.getBoundingClientRect();
            this.lowerBox = this.lowerPipeDomElement.getBoundingClientRect();
            gameDebugger.drawBox(this.upperPipeDomElement, this.upperBox);
            gameDebugger.drawBox(this.lowerPipeDomElement, this.lowerBox);
        };
        return Pipe;
    }());
    Floppy.Pipe = Pipe;
})(Floppy || (Floppy = {}));
var Floppy;
(function (Floppy) {
    var PipeManager = (function () {
        function PipeManager(pipeAreaDomElement, easyMode) {
            if (easyMode === void 0) { easyMode = false; }
            this.pipeDelay = 5000;
            this.lastPipeInsertedTimestamp = 0;
            this.pipes = [];
            this.currentGap = 140;
            this.pipeAreaDomElement = pipeAreaDomElement;
            this.easyMode = easyMode;
            this.currentGap = easyMode ? 140 : 90;
        }
        PipeManager.prototype.setPipeDelay = function (delay) {
            this.pipeDelay = delay;
        };
        PipeManager.prototype.setPipeGap = function (gap) {
            this.currentGap = gap;
        };
        PipeManager.prototype.tick = function (now) {
            this.pipes.forEach(function (pipe) { return pipe.tick(); });
            if (now - this.lastPipeInsertedTimestamp < this.pipeDelay) {
                return;
            }
            gameDebugger.log('inserting pipe after', now - this.lastPipeInsertedTimestamp, 'ms');
            this.lastPipeInsertedTimestamp = now;
            var pipeDimension = this.createPipeDimensions({
                gap: this.currentGap,
            });
            var pipe = new Floppy.Pipe(pipeDimension);
            this.pipes.push(pipe);
            this.pipeAreaDomElement.appendChild(pipe.domElement);
            this.pipes = this.pipes.filter(function (pipe) {
                if (pipe.isOffScreen()) {
                    gameDebugger.log('pruning a pipe');
                    pipe.domElement.remove();
                    return false;
                }
                return true;
            });
        };
        PipeManager.prototype.intersectsWith = function (box) {
            return this.pipes.find(function (pipe) { return pipe.intersectsWith(box); }) != null;
        };
        PipeManager.prototype.removeAll = function () {
            this.pipes.forEach(function (pipe) { return pipe.domElement.remove(); });
            this.pipes = [];
        };
        PipeManager.prototype.nextUnscoredPipe = function () {
            return this.pipes.find(function (pipe) { return pipe.scored === false; });
        };
        PipeManager.prototype.createPipeDimensions = function (options) {
            var topPipeBuffer = 80;
            var bottomPipeBuffer = 420 - options.gap - topPipeBuffer;
            var topPipeHeight = this.randomNumberBetween(topPipeBuffer, bottomPipeBuffer);
            var bottomPipeHeight = 420 - options.gap - topPipeHeight;
            return { topPipeHeight: topPipeHeight, bottomPipeHeight: bottomPipeHeight };
        };
        PipeManager.prototype.randomNumberBetween = function (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        };
        return PipeManager;
    }());
    Floppy.PipeManager = PipeManager;
})(Floppy || (Floppy = {}));
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var Floppy;
(function (Floppy) {
    var RehaPianoConnectionState;
    (function (RehaPianoConnectionState) {
        RehaPianoConnectionState["Disconnected"] = "disconnected";
        RehaPianoConnectionState["Connecting"] = "connecting";
        RehaPianoConnectionState["Connected"] = "connected";
        RehaPianoConnectionState["Error"] = "error";
    })(RehaPianoConnectionState = Floppy.RehaPianoConnectionState || (Floppy.RehaPianoConnectionState = {}));
    var RehaPianoConnection = (function () {
        function RehaPianoConnection(url) {
            if (url === void 0) { url = 'ws://localhost:5555/ws'; }
            this.DEFAULT_MAX_DATA_AGE = 200;
            this.ws = null;
            this.connectionState = RehaPianoConnectionState.Disconnected;
            this.leftHand = { connected: false, port: null, adc: [0, 0, 0, 0, 0, 0], lastSeen: 0 };
            this.rightHand = { connected: false, port: null, adc: [0, 0, 0, 0, 0, 0], lastSeen: 0 };
            this.lastDataReceivedTime = 0;
            this.messageCount = 0;
            this.reconnectAttempts = 0;
            this.MAX_RECONNECT_ATTEMPTS = 5;
            this.RECONNECT_DELAY_BASE = 1000;
            this.reconnectTimeout = null;
            this.url = url;
        }
        Object.defineProperty(RehaPianoConnection.prototype, "isConnected", {
            get: function () {
                return this.connectionState === RehaPianoConnectionState.Connected &&
                    this.ws !== null &&
                    this.ws.readyState === WebSocket.OPEN;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(RehaPianoConnection.prototype, "state", {
            get: function () {
                return this.connectionState;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(RehaPianoConnection.prototype, "leftHandConnected", {
            get: function () { return this.leftHand.connected; },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(RehaPianoConnection.prototype, "rightHandConnected", {
            get: function () { return this.rightHand.connected; },
            enumerable: false,
            configurable: true
        });
        RehaPianoConnection.prototype.connect = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    if (this.isConnected)
                        return [2];
                    if (this.connectionState === RehaPianoConnectionState.Connecting)
                        return [2];
                    this.connectionState = RehaPianoConnectionState.Connecting;
                    this.reconnectAttempts = 0;
                    return [2, this.attemptConnection()];
                });
            });
        };
        RehaPianoConnection.prototype.attemptConnection = function () {
            var _this = this;
            return new Promise(function (resolve, reject) {
                try {
                    _this.ws = new WebSocket(_this.url);
                    _this.ws.onopen = function () {
                        _this.connectionState = RehaPianoConnectionState.Connected;
                        _this.reconnectAttempts = 0;
                        _this.lastDataReceivedTime = Date.now();
                        console.log('[RehaPiano] Connected to', _this.url);
                        resolve();
                    };
                    _this.ws.onmessage = function (event) {
                        if (typeof event.data === 'string') {
                            _this.handleJsonMessage(event.data);
                        }
                    };
                    _this.ws.onerror = function () {
                        _this.connectionState = RehaPianoConnectionState.Error;
                        reject(new Error('WebSocket connection error'));
                    };
                    _this.ws.onclose = function (event) {
                        _this.connectionState = RehaPianoConnectionState.Disconnected;
                        _this.ws = null;
                        console.warn('[RehaPiano] Connection closed. Code:', event.code);
                        if (_this.reconnectAttempts < _this.MAX_RECONNECT_ATTEMPTS) {
                            _this.scheduleReconnect();
                        }
                    };
                }
                catch (error) {
                    _this.connectionState = RehaPianoConnectionState.Error;
                    reject(error);
                }
            });
        };
        RehaPianoConnection.prototype.scheduleReconnect = function () {
            var _this = this;
            if (this.reconnectTimeout)
                clearTimeout(this.reconnectTimeout);
            this.reconnectAttempts++;
            var delay = this.RECONNECT_DELAY_BASE * Math.pow(2, this.reconnectAttempts - 1);
            this.reconnectTimeout = setTimeout(function () {
                _this.attemptConnection().catch(function () { });
            }, delay);
        };
        RehaPianoConnection.prototype.handleJsonMessage = function (raw) {
            try {
                var msg = JSON.parse(raw);
                switch (msg.kind) {
                    case 'sample':
                        this.handleSample(msg);
                        break;
                    case 'identifier':
                        this.handleIdentifier(msg);
                        break;
                    case 'device_removed':
                        this.handleDeviceRemoved(msg);
                        break;
                }
            }
            catch (e) {
                console.error('[RehaPiano] Failed to parse message:', e);
            }
        };
        RehaPianoConnection.prototype.handleSample = function (msg) {
            var hand = this.getHandState(msg.hand);
            if (!hand)
                return;
            hand.adc = msg.adc || [0, 0, 0, 0, 0, 0];
            hand.lastSeen = Date.now();
            hand.connected = true;
            this.lastDataReceivedTime = Date.now();
            this.messageCount++;
            if (this.messageCount === 1) {
                console.log('[RehaPiano] First sample from', msg.hand, 'hand — ADC:', hand.adc);
            }
        };
        RehaPianoConnection.prototype.handleIdentifier = function (msg) {
            var hand = this.getHandState(msg.hand);
            if (!hand)
                return;
            hand.port = msg.port || null;
            hand.connected = true;
            console.log('[RehaPiano] Identified:', msg.hand, 'port:', msg.port, 'uid:', msg.uid_hex);
        };
        RehaPianoConnection.prototype.handleDeviceRemoved = function (msg) {
            var hand = this.getHandState(msg.hand);
            if (!hand)
                return;
            hand.connected = false;
            hand.port = null;
            hand.adc = [0, 0, 0, 0, 0, 0];
            console.log('[RehaPiano] Removed:', msg.hand);
        };
        RehaPianoConnection.prototype.getHandState = function (hand) {
            if (hand === 'left')
                return this.leftHand;
            if (hand === 'right')
                return this.rightHand;
            return null;
        };
        RehaPianoConnection.prototype.disconnect = function () {
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
            this.reconnectAttempts = this.MAX_RECONNECT_ATTEMPTS;
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            this.connectionState = RehaPianoConnectionState.Disconnected;
        };
        RehaPianoConnection.prototype.getAverageFingerValue = function () {
            var e_1, _a, e_2, _b;
            var sum = 0;
            var count = 0;
            try {
                for (var _c = __values([this.leftHand, this.rightHand]), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var hand = _d.value;
                    if (!hand.connected)
                        continue;
                    try {
                        for (var _e = (e_2 = void 0, __values(RehaPianoConnection.FINGER_ADC_INDICES)), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var idx = _f.value;
                            sum += hand.adc[idx] || 0;
                            count++;
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            if (count === 0)
                return 0;
            return sum / count;
        };
        RehaPianoConnection.prototype.getFingerPressure = function (hand, fingerIndex) {
            var state = hand === 'left' ? this.leftHand : this.rightHand;
            if (!state.connected)
                return 0;
            var adcIndex = fingerIndex + 1;
            return Math.abs(state.adc[adcIndex] || 0);
        };
        RehaPianoConnection.prototype.getHandAdc = function (hand) {
            var state = hand === 'left' ? this.leftHand : this.rightHand;
            return __spreadArray([], __read(state.adc), false);
        };
        RehaPianoConnection.prototype.isAnyFingerPressed = function (threshold) {
            var e_3, _a, e_4, _b;
            if (threshold === void 0) { threshold = 10; }
            try {
                for (var _c = __values([this.leftHand, this.rightHand]), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var hand = _d.value;
                    if (!hand.connected)
                        continue;
                    try {
                        for (var _e = (e_4 = void 0, __values(RehaPianoConnection.FINGER_ADC_INDICES)), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var idx = _f.value;
                            if (Math.abs(hand.adc[idx] || 0) >= threshold)
                                return true;
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_3) throw e_3.error; }
            }
            return false;
        };
        RehaPianoConnection.prototype.isDataFresh = function (maxAge) {
            if (maxAge === void 0) { maxAge = this.DEFAULT_MAX_DATA_AGE; }
            if (this.lastDataReceivedTime === 0)
                return false;
            return (Date.now() - this.lastDataReceivedTime) <= maxAge;
        };
        RehaPianoConnection.prototype.hasAnyHand = function () {
            return this.leftHand.connected || this.rightHand.connected;
        };
        RehaPianoConnection.FINGER_ADC_INDICES = [1, 2, 3, 4, 5];
        return RehaPianoConnection;
    }());
    Floppy.RehaPianoConnection = RehaPianoConnection;
})(Floppy || (Floppy = {}));
var isDebugOn = window.location.search.includes('debug');
var isEasyModeOn = window.location.search.includes('easy');
var gameDebugger = new Floppy.GameDebugger(isDebugOn);
function getUrlParam(name) {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name) || undefined;
}
function getUrlParamNumber(name, defaultValue) {
    var value = getUrlParam(name);
    if (value === undefined)
        return defaultValue;
    var num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
}
(function () {
    var bird = document.getElementById('player');
    var land = document.getElementById('land');
    var flightArea = document.getElementById('flyarea');
    var replayButton = document.getElementById('replay');
    var bigScore = document.getElementById('bigscore');
    var currentScore = document.getElementById('currentscore');
    var highScore = document.getElementById('highscore');
    if (bird == null || flightArea == null || land == null || replayButton == null || bigScore == null || currentScore == null || highScore == null) {
        throw new Error('Missing an element');
    }
    var rehaPianoUrl = getUrlParam('rpUrl') || 'ws://localhost:5555/ws';
    var rehaPianoThreshold = getUrlParamNumber('rpThreshold', 5.0);
    var rehaPianoScale = getUrlParamNumber('rpScale', 0.01);
    var rehaPianoEnabled = getUrlParam('rpDisabled') === undefined;
    var game = new Floppy.Game({ bird: bird, land: land, flightArea: flightArea, replayButton: replayButton, bigScore: bigScore, currentScore: currentScore, highScore: highScore }, {
        isDebugOn: isDebugOn,
        isEasyModeOn: isEasyModeOn,
        rehaPianoUrl: rehaPianoUrl,
        rehaPianoThreshold: rehaPianoThreshold,
        rehaPianoScale: rehaPianoScale,
        rehaPianoEnabled: rehaPianoEnabled
    });
    if ('ontouchstart' in document) {
        document.ontouchstart = game.onScreenTouch.bind(game);
    }
    else {
        document.onmousedown = game.onScreenTouch.bind(game);
    }
    game.splash();
})();
//# sourceMappingURL=game.js.map