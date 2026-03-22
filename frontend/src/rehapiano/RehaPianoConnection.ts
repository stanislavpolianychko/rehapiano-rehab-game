export enum RehaPianoConnectionState {
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected',
    Error = 'error'
}

interface HandState {
    connected: boolean;
    port: string | null;
    adc: number[];
    lastSeen: number;
}

export class RehaPianoConnection {
    protected static readonly FINGER_ADC_INDICES = [1, 2, 3, 4, 5];
    protected readonly DEFAULT_MAX_DATA_AGE = 200;

    protected ws: WebSocket | null = null;
    protected connectionState: RehaPianoConnectionState = RehaPianoConnectionState.Disconnected;
    protected url: string;

    protected leftHand: HandState = { connected: false, port: null, adc: [0, 0, 0, 0, 0, 0], lastSeen: 0 };
    protected rightHand: HandState = { connected: false, port: null, adc: [0, 0, 0, 0, 0, 0], lastSeen: 0 };
    protected lastDataReceivedTime: number = 0;
    protected messageCount: number = 0;

    protected reconnectAttempts: number = 0;
    protected readonly MAX_RECONNECT_ATTEMPTS = 5;
    protected readonly RECONNECT_DELAY_BASE = 1000;
    protected reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(url: string = 'ws://localhost:5555/ws') {
        this.url = url;
    }

    public get isConnected(): boolean {
        return this.connectionState === RehaPianoConnectionState.Connected &&
               this.ws !== null &&
               this.ws.readyState === WebSocket.OPEN;
    }

    public get state(): RehaPianoConnectionState {
        return this.connectionState;
    }

    public get leftHandConnected(): boolean { return this.leftHand.connected; }
    public get rightHandConnected(): boolean { return this.rightHand.connected; }

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

    protected scheduleReconnect(): void {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectAttempts++;
        const delay = this.RECONNECT_DELAY_BASE * Math.pow(2, this.reconnectAttempts - 1);
        this.reconnectTimeout = setTimeout(() => {
            this.attemptConnection().catch(() => {});
        }, delay);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        console.log('[RehaPiano] Removed:', msg.hand);
    }

    protected getHandState(hand: string): HandState | null {
        if (hand === 'left') return this.leftHand;
        if (hand === 'right') return this.rightHand;
        return null;
    }

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

    public getAverageFingerValue(): number {
        let sum = 0;
        let count = 0;
        for (const hand of [this.leftHand, this.rightHand]) {
            if (!hand.connected) continue;
            for (const idx of RehaPianoConnection.FINGER_ADC_INDICES) {
                sum += hand.adc[idx] || 0;
                count++;
            }
        }
        if (count === 0) return 0;
        return sum / count;
    }

    public getFingerPressure(hand: 'left' | 'right', fingerIndex: number): number {
        const state = hand === 'left' ? this.leftHand : this.rightHand;
        if (!state.connected) return 0;
        const adcIndex = fingerIndex + 1;
        return Math.abs(state.adc[adcIndex] || 0);
    }

    public getHandAdc(hand: 'left' | 'right'): number[] {
        const state = hand === 'left' ? this.leftHand : this.rightHand;
        return [...state.adc];
    }

    public isAnyFingerPressed(threshold: number = 10): boolean {
        for (const hand of [this.leftHand, this.rightHand]) {
            if (!hand.connected) continue;
            for (const idx of RehaPianoConnection.FINGER_ADC_INDICES) {
                if (Math.abs(hand.adc[idx] || 0) >= threshold) return true;
            }
        }
        return false;
    }

    public isDataFresh(maxAge: number = this.DEFAULT_MAX_DATA_AGE): boolean {
        if (this.lastDataReceivedTime === 0) return false;
        return (Date.now() - this.lastDataReceivedTime) <= maxAge;
    }

    public hasAnyHand(): boolean {
        return this.leftHand.connected || this.rightHand.connected;
    }
}
