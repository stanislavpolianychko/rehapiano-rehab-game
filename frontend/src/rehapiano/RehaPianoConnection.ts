/**
 * @module RehaPianoConnection
 *
 * WebSocket client for communicating with the RehaPiano streamer server.
 * The streamer server is provided externally (by the thesis supervisor) and
 * streams real-time sensor data from rehabilitation gloves worn by stroke
 * patients during piano-based hand rehabilitation exercises.
 *
 * This module is the client-side consumer: it connects to the streamer,
 * parses incoming JSON messages, and exposes processed sensor state
 * (per-hand ADC values, finger pressure, data freshness) for use by
 * the game frontend.
 */

/**
 * Represents the current state of the WebSocket connection to the
 * RehaPiano streamer server.
 */
export enum RehaPianoConnectionState {
    /** No active connection; initial state or after explicit disconnect. */
    Disconnected = 'disconnected',
    /** A connection attempt is in progress (WebSocket handshake pending). */
    Connecting = 'connecting',
    /** WebSocket is open and the client is receiving streamer messages. */
    Connected = 'connected',
    /** The last connection attempt failed with an error. */
    Error = 'error',
}

/**
 * Per-hand tracking state maintained by the connection.
 *
 * Each rehabilitation glove (left or right) reports its own sensor data
 * independently. This interface holds the latest snapshot for one hand.
 *
 * The `adc` array contains 6 elements representing raw ADC (analog-to-digital
 * converter) readings from the glove's flex sensors. The layout is:
 *
 *   `[dummy, little, ring, middle, index, thumb]`
 *
 * Index 0 is a dummy/unused channel; indices 1-5 map to actual fingers.
 * Values are signed integers where positive values indicate finger
 * compression (flexion) and negative values indicate extension.
 */
interface HandState {
    /** Whether this hand's glove is currently connected to the streamer. */
    connected: boolean;
    /** Serial port identifier reported by the streamer, or `null` if unknown. */
    port: string | null;
    /** Raw ADC readings: `[dummy, little, ring, middle, index, thumb]`. */
    adc: number[];
    /**
     * Per-channel resting baseline captured by {@link RehaPianoConnection.calibrate}.
     * Subtracted from raw `adc` so that "hand at rest" maps to ~0 and the bird
     * does not drift (no default down/up draft) when the patient is not pressing.
     */
    baseline: number[];
    /** Timestamp (ms since epoch) of the last received sample for this hand. */
    lastSeen: number;
}

/**
 * WebSocket client for the RehaPiano streamer server.
 *
 * Connects to the externally-provided RehaPiano streamer via a WebSocket
 * using a JSON-based protocol. The streamer relays real-time sensor data
 * from rehabilitation gloves worn by stroke patients.
 *
 * **Message types handled:**
 * - `sample` — periodic sensor data containing ADC readings for one hand.
 * - `identifier` — device identification info (port, UID) when a glove connects.
 * - `device_removed` — notification that a glove has been disconnected.
 *
 * The class tracks left and right hand state independently, provides
 * computed convenience values (average finger force, per-finger pressure,
 * any-finger-pressed detection), and includes automatic reconnection with
 * exponential backoff (up to {@link MAX_RECONNECT_ATTEMPTS} retries).
 */
export class RehaPianoConnection {
    /**
     * ADC channel indices that correspond to actual finger sensors.
     * Index 0 in the ADC array is a dummy/unused channel, so the real
     * finger data lives at indices 1 through 5 (little, ring, middle,
     * index, thumb).
     */
    protected static readonly FINGER_ADC_INDICES = [1, 2, 3, 4, 5];
    protected readonly DEFAULT_MAX_DATA_AGE = 200;

    protected ws: WebSocket | null = null;
    protected connectionState: RehaPianoConnectionState = RehaPianoConnectionState.Disconnected;
    protected url: string;

    protected leftHand: HandState = {
        connected: false,
        port: null,
        adc: [0, 0, 0, 0, 0, 0],
        baseline: [0, 0, 0, 0, 0, 0],
        lastSeen: 0,
    };
    protected rightHand: HandState = {
        connected: false,
        port: null,
        adc: [0, 0, 0, 0, 0, 0],
        baseline: [0, 0, 0, 0, 0, 0],
        lastSeen: 0,
    };
    protected lastDataReceivedTime: number = 0;
    protected messageCount: number = 0;

    protected reconnectAttempts: number = 0;
    protected readonly MAX_RECONNECT_ATTEMPTS = 5;
    protected readonly RECONNECT_DELAY_BASE = 1000;
    protected reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Creates a new RehaPiano connection instance.
     * Does not connect automatically — call {@link connect} to initiate.
     *
     * @param url - WebSocket URL of the RehaPiano streamer server.
     *              Defaults to `ws://localhost:5555/ws`.
     */
    constructor(url: string = 'ws://localhost:5555/ws') {
        this.url = url;
    }

    /**
     * Whether the WebSocket is currently open and operational.
     * @returns `true` if the connection state is `Connected` and the
     *          underlying WebSocket is in the OPEN ready state.
     */
    public get isConnected(): boolean {
        return (
            this.connectionState === RehaPianoConnectionState.Connected &&
            this.ws !== null &&
            this.ws.readyState === WebSocket.OPEN
        );
    }

    /** The current connection lifecycle state. */
    public get state(): RehaPianoConnectionState {
        return this.connectionState;
    }

    /** Whether the left-hand glove is currently connected and sending data. */
    public get leftHandConnected(): boolean {
        return this.leftHand.connected;
    }
    /** Whether the right-hand glove is currently connected and sending data. */
    public get rightHandConnected(): boolean {
        return this.rightHand.connected;
    }

    /**
     * Initiates a WebSocket connection to the RehaPiano streamer server.
     *
     * If already connected or a connection attempt is in progress, this
     * method returns immediately. On success the state transitions to
     * `Connected`; on failure it transitions to `Error`. If the connection
     * drops after being established, automatic reconnection with exponential
     * backoff is attempted up to {@link MAX_RECONNECT_ATTEMPTS} times.
     *
     * @returns A promise that resolves once the WebSocket is open, or
     *          rejects if the initial connection attempt fails.
     */
    public async connect(): Promise<void> {
        if (this.isConnected) return;
        if (this.connectionState === RehaPianoConnectionState.Connecting) return;
        this.connectionState = RehaPianoConnectionState.Connecting;
        this.reconnectAttempts = 0;
        return this.attemptConnection();
    }

    protected attemptConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    this.connectionState = RehaPianoConnectionState.Connected;
                    this.reconnectAttempts = 0;
                    this.lastDataReceivedTime = Date.now();
                    console.log('[RehaPiano] Connected to', this.url);
                    resolve();
                };

                this.ws.onmessage = (event: MessageEvent) => {
                    if (typeof event.data === 'string') {
                        this.handleJsonMessage(event.data);
                    }
                };

                this.ws.onerror = () => {
                    this.connectionState = RehaPianoConnectionState.Error;
                    reject(new Error('WebSocket connection error'));
                };

                this.ws.onclose = (event: CloseEvent) => {
                    this.connectionState = RehaPianoConnectionState.Disconnected;
                    this.ws = null;
                    console.warn('[RehaPiano] Connection closed. Code:', event.code);
                    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                        this.scheduleReconnect();
                    }
                };
            } catch (error) {
                this.connectionState = RehaPianoConnectionState.Error;
                reject(error);
            }
        });
    }

    /**
     * Schedules a reconnection attempt using exponential backoff.
     * Delays: 1s, 2s, 4s, 8s, 16s (for up to MAX_RECONNECT_ATTEMPTS).
     */
    protected scheduleReconnect(): void {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectAttempts++;
        // Exponential backoff: base * 2^(attempt-1)
        const delay = this.RECONNECT_DELAY_BASE * Math.pow(2, this.reconnectAttempts - 1);
        this.reconnectTimeout = setTimeout(() => {
            this.attemptConnection().catch(() => {});
        }, delay);
    }

    protected handleJsonMessage(raw: string): void {
        try {
            const msg = JSON.parse(raw);
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
        } catch (e) {
            console.error('[RehaPiano] Failed to parse message:', e);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected handleSample(msg: any): void {
        const hand = this.getHandState(msg.hand);
        if (!hand) return;

        hand.adc = msg.adc || [0, 0, 0, 0, 0, 0];
        hand.lastSeen = Date.now();
        hand.connected = true;
        this.lastDataReceivedTime = Date.now();
        this.messageCount++;

        if (this.messageCount === 1) {
            console.log('[RehaPiano] First sample from', msg.hand, 'hand — ADC:', hand.adc);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected handleIdentifier(msg: any): void {
        const hand = this.getHandState(msg.hand);
        if (!hand) return;
        hand.port = msg.port || null;
        hand.connected = true;
        console.log('[RehaPiano] Identified:', msg.hand, 'port:', msg.port, 'uid:', msg.uid_hex);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected handleDeviceRemoved(msg: any): void {
        const hand = this.getHandState(msg.hand);
        if (!hand) return;
        hand.connected = false;
        hand.port = null;
        hand.adc = [0, 0, 0, 0, 0, 0];
        hand.baseline = [0, 0, 0, 0, 0, 0];
        console.log('[RehaPiano] Removed:', msg.hand);
    }

    protected getHandState(hand: string): HandState | null {
        if (hand === 'left') return this.leftHand;
        if (hand === 'right') return this.rightHand;
        return null;
    }

    /**
     * Closes the WebSocket connection and stops any pending reconnection
     * attempts. After calling this method the state is `Disconnected` and
     * no further automatic reconnections will be scheduled.
     */
    public disconnect(): void {
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
    }

    /**
     * Captures the current ADC readings of every connected hand as the
     * resting baseline (zero offset).
     *
     * Flex/pressure sensors rarely read exactly 0 when the hand is at rest —
     * each channel has its own bias. Without zeroing this out the game would
     * see a constant non-zero force and the bird would continuously drift
     * (a "default down draft"). Call this when the patient's hand is relaxed
     * — e.g. right after the glove connects and at the start of each round.
     *
     * @returns `true` if at least one connected hand was calibrated.
     */
    public calibrate(): boolean {
        let calibrated = false;
        for (const hand of [this.leftHand, this.rightHand]) {
            if (!hand.connected) continue;
            hand.baseline = [...hand.adc];
            calibrated = true;
        }
        if (calibrated) {
            console.log(
                '[RehaPiano] Calibrated baseline — L:',
                this.leftHand.baseline,
                'R:',
                this.rightHand.baseline,
            );
        }
        return calibrated;
    }

    /**
     * Returns the baseline-corrected ADC array for a hand: raw readings minus
     * the resting baseline captured by {@link calibrate}. With the hand at
     * rest every channel is ~0, so callers can apply a symmetric dead zone
     * without the sensor bias leaking through as drift.
     *
     * @param hand - Which hand to query (`'left'` or `'right'`).
     * @returns A 6-element array of baseline-corrected ADC values.
     */
    public getCorrectedHandAdc(hand: 'left' | 'right'): number[] {
        const state = hand === 'left' ? this.leftHand : this.rightHand;
        return state.adc.map((v, i) => (v || 0) - (state.baseline[i] || 0));
    }

    /**
     * Computes the signed, baseline-corrected average ADC value across all
     * finger sensors of every connected hand.
     *
     * The returned value preserves sign: positive values indicate overall
     * finger compression (flexion), negative values indicate extension.
     * Only connected hands contribute to the average. If no hand is
     * connected, returns `0`.
     *
     * @returns Signed average finger sensor value across all connected hands.
     */
    public getAverageFingerValue(): number {
        let sum = 0;
        let count = 0;
        for (const hand of [this.leftHand, this.rightHand]) {
            if (!hand.connected) continue;
            for (const idx of RehaPianoConnection.FINGER_ADC_INDICES) {
                sum += (hand.adc[idx] || 0) - (hand.baseline[idx] || 0);
                count++;
            }
        }
        if (count === 0) return 0;
        return sum / count;
    }

    /**
     * Returns the absolute pressure value for a single finger on the
     * specified hand.
     *
     * The `fingerIndex` parameter maps to fingers as follows:
     * - `0` — little finger
     * - `1` — ring finger
     * - `2` — middle finger
     * - `3` — index finger
     * - `4` — thumb
     *
     * Internally, `fingerIndex` is offset by +1 to skip the dummy ADC
     * channel at index 0.
     *
     * @param hand - Which hand to query (`'left'` or `'right'`).
     * @param fingerIndex - Finger index (0-4, little to thumb).
     * @returns Absolute ADC value for the requested finger, or `0` if
     *          the hand is not connected.
     */
    public getFingerPressure(hand: 'left' | 'right', fingerIndex: number): number {
        const state = hand === 'left' ? this.leftHand : this.rightHand;
        if (!state.connected) return 0;
        const adcIndex = fingerIndex + 1;
        return Math.abs(state.adc[adcIndex] || 0);
    }

    /**
     * Returns a copy of the raw ADC array for the specified hand.
     *
     * The array layout is `[dummy, little, ring, middle, index, thumb]`.
     * A shallow copy is returned so callers cannot mutate internal state.
     *
     * @param hand - Which hand to query (`'left'` or `'right'`).
     * @returns A 6-element array of raw ADC sensor values.
     */
    public getHandAdc(hand: 'left' | 'right'): number[] {
        const state = hand === 'left' ? this.leftHand : this.rightHand;
        return [...state.adc];
    }

    /**
     * Checks whether any finger on any connected hand exceeds the given
     * pressure threshold (absolute value comparison).
     *
     * @param threshold - Minimum absolute ADC value to consider a finger
     *                    "pressed". Defaults to `10`.
     * @returns `true` if at least one finger meets or exceeds the threshold.
     */
    public isAnyFingerPressed(threshold: number = 10): boolean {
        for (const hand of [this.leftHand, this.rightHand]) {
            if (!hand.connected) continue;
            for (const idx of RehaPianoConnection.FINGER_ADC_INDICES) {
                if (Math.abs(hand.adc[idx] || 0) >= threshold) return true;
            }
        }
        return false;
    }

    /**
     * Determines whether the most recently received sensor data is still
     * "fresh" — i.e., recent enough to be used for real-time game control.
     *
     * This is important for detecting stale data when the streamer stops
     * sending samples (e.g., due to network issues or glove disconnection).
     * Game logic should check freshness before acting on sensor values to
     * avoid responding to outdated readings.
     *
     * @param maxAge - Maximum acceptable age of the last received data
     *                 in milliseconds. Defaults to {@link DEFAULT_MAX_DATA_AGE}
     *                 (200 ms).
     * @returns `true` if data was received within `maxAge` ms; `false` if
     *          no data has ever been received or the last sample is too old.
     */
    public isDataFresh(maxAge: number = this.DEFAULT_MAX_DATA_AGE): boolean {
        if (this.lastDataReceivedTime === 0) return false;
        return Date.now() - this.lastDataReceivedTime <= maxAge;
    }

    /**
     * Whether at least one hand (left or right) is currently connected.
     * @returns `true` if either glove has been identified and not yet removed.
     */
    public hasAnyHand(): boolean {
        return this.leftHand.connected || this.rightHand.connected;
    }
}
