/// <reference path="helpers.ts" />
/// <reference path="storage.ts" />

/// <reference path="Assets.ts" />
/// <reference path="Bird.ts" />
/// <reference path="Common.ts" />
/// <reference path="Game.ts" />
/// <reference path="GameDebugger.ts" />
/// <reference path="Land.ts" />
/// <reference path="LevelProgression.ts" />
/// <reference path="Pipe.ts" />
/// <reference path="PipeManager.ts" />
/// <reference path="RehaPianoConnection.ts" />

// A debugger is defined globally as almost all game files rely on its presence
const isDebugOn = window.location.search.includes('debug');
const isEasyModeOn = window.location.search.includes('easy');
const gameDebugger = new Floppy.GameDebugger(isDebugOn);

// Helper function to get URL parameter
function getUrlParam(name: string): string | undefined {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name) || undefined;
}

// Helper function to get URL parameter as number
function getUrlParamNumber(name: string, defaultValue: number): number {
    const value = getUrlParam(name);
    if (value === undefined) return defaultValue;
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
}

(function() {
    const bird = document.getElementById('player');
    const land = document.getElementById('land');
    const flightArea = document.getElementById('flyarea');
    const replayButton = document.getElementById('replay');
    const bigScore = document.getElementById('bigscore');
    const currentScore = document.getElementById('currentscore');
    const highScore = document.getElementById('highscore');

    if (bird == null || flightArea == null || land == null || replayButton == null || bigScore == null || currentScore == null || highScore == null) {
        throw new Error('Missing an element');
    }

    // RehaPiano configuration from URL parameters
    const rehaPianoUrl = getUrlParam('rpUrl') || 'ws://localhost:5555/ws';
    const rehaPianoThreshold = getUrlParamNumber('rpThreshold', 5.0);  // min avg force (normalized ADC units)
    const rehaPianoScale = getUrlParamNumber('rpScale', 0.01);         // force-to-velocity multiplier
    const rehaPianoEnabled = getUrlParam('rpDisabled') === undefined;

    const game = new Floppy.Game(
        { bird, land, flightArea, replayButton, bigScore, currentScore, highScore },
        {
            isDebugOn,
            isEasyModeOn,
            rehaPianoUrl,
            rehaPianoThreshold,
            rehaPianoScale,
            rehaPianoEnabled
        }
    );

    // Touch/mouse handlers for starting/restarting game
    // Keyboard handling is done in Game.handleKeyDown() which listens to all keys
    if ('ontouchstart' in document) {
        document.ontouchstart = game.onScreenTouch.bind(game);
    } else {
        document.onmousedown = game.onScreenTouch.bind(game);
    }
    game.splash();
})();

