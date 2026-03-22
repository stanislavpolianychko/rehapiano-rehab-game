/**
 * Game entry point for the RehaPiano rehabilitation game.
 *
 * Bootstraps the application by initializing the debug overlay,
 * loading doctor settings from localStorage, resolving required
 * DOM elements, and constructing the {@link Game} instance.
 * Binds touch/mouse input and starts the splash screen.
 *
 * @module main
 */

import './styles/reset.css';
import './styles/main.css';
import { initGameDebugger } from './debug';
import { Game } from './game/Game';
import { storage } from './storage';

const isDebugOn = window.location.search.includes('debug');
const isEasyModeOn = window.location.search.includes('easy');

initGameDebugger(isDebugOn);

const doctorSettings = storage.getDoctorSettings();

const bird = document.getElementById('player');
const land = document.getElementById('land');
const flightArea = document.getElementById('flyarea');
const replayButton = document.getElementById('replay');
const bigScore = document.getElementById('bigscore');
const currentScore = document.getElementById('currentscore');
const highScore = document.getElementById('highscore');

if (
    bird == null ||
    flightArea == null ||
    land == null ||
    replayButton == null ||
    bigScore == null ||
    currentScore == null ||
    highScore == null
) {
    throw new Error('Missing an element');
}

const game = new Game(
    { bird, land, flightArea, replayButton, bigScore, currentScore, highScore },
    {
        isDebugOn,
        isEasyModeOn,
        rehaPianoUrl: 'ws://localhost:5555/ws',
        rehaPianoThreshold: doctorSettings.minimumForce,
        rehaPianoScale: doctorSettings.responseStrength,
        rehaPianoEnabled: true,
        doctorSettings,
    },
);

if ('ontouchstart' in document) {
    document.ontouchstart = game.onScreenTouch.bind(game);
} else {
    document.onmousedown = game.onScreenTouch.bind(game);
}
game.splash();
