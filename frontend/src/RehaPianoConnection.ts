namespace Floppy {
    export enum RehaPianoConnectionState {
        Disconnected = 'disconnected',
        Connecting = 'connecting',
        Connected = 'connected',
        Error = 'error'
    }

    export class RehaPianoConnection {
        protected readonly FINGER_POSITIONS: readonly number[] = [0, 1, 2, 3, 4, 12, 11, 10, 9, 8];
        protected readonly DEFAULT_THRESHOLD = 0.05;
        protected readonly DEFAULT_MAX_DATA_AGE = 100; // milliseconds

        protected ws: WebSocket | null = null;
        protected connectionState: RehaPianoConnectionState = RehaPianoConnectionState.Disconnected;
        protected url: string;
        
        // Latest decoded data
        protected latestTimestamp: number = 0;
        protected latestChannels: Float32Array | null = null;
        protected lastDataReceivedTime: number = 0;
        protected messageCount: number = 0;

        // Reconnection settings
        protected reconnectAttempts: number = 0;
        protected readonly MAX_RECONNECT_ATTEMPTS = 5;
        protected readonly RECONNECT_DELAY_BASE = 1000; // 1 second base delay
        protected reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

        constructor(url: string = 'ws://localhost:8005') {
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

        public async connect(): Promise<void> {
            if (this.isConnected) {
                return; // Already connected
            }

            if (this.connectionState === RehaPianoConnectionState.Connecting) {
                return; // Already connecting
            }

            this.connectionState = RehaPianoConnectionState.Connecting;
            this.reconnectAttempts = 0;

            return this.attemptConnection();
        }

        protected attemptConnection(): Promise<void> {
            return new Promise((resolve, reject) => {
                try {
                    this.ws = new WebSocket(this.url);
                    this.ws.binaryType = 'arraybuffer';

                    this.ws.onopen = () => {
                        this.connectionState = RehaPianoConnectionState.Connected;
                        this.reconnectAttempts = 0;
                        this.lastDataReceivedTime = Date.now();
                        console.log('[RehaPiano] ✅ Connected successfully to', this.url);
                        console.log('[RehaPiano] 🔍 WebSocket readyState:', this.ws?.readyState, '(1=OPEN)');
                        console.log('[RehaPiano] 🔍 WebSocket binaryType:', this.ws?.binaryType);
                        resolve();
                    };

                    this.ws.onmessage = (event: MessageEvent) => {
                        // Debug: Always log first message
                        if (this.lastDataReceivedTime === 0) {
                            console.log('[RehaPiano] 📨 onmessage triggered! Data type:', typeof event.data, 'is ArrayBuffer:', event.data instanceof ArrayBuffer);
                            if (event.data instanceof ArrayBuffer) {
                                console.log('[RehaPiano] 📨 First message received! Size:', event.data.byteLength, 'bytes');
                            } else {
                                console.log('[RehaPiano] 📨 First message data:', event.data);
                            }
                        }
                        
                        if (event.data instanceof ArrayBuffer) {
                            this.handleBinaryData(event.data);
                        } else {
                            console.warn('[RehaPiano] ⚠️ Received non-ArrayBuffer data:', typeof event.data, event.data);
                        }
                    };

                    this.ws.onerror = (_error: Event) => {
                        this.connectionState = RehaPianoConnectionState.Error;
                        console.error('[RehaPiano] ❌ WebSocket connection error');
                        reject(new Error('WebSocket connection error'));
                    };

                    this.ws.onclose = (event: CloseEvent) => {
                        this.connectionState = RehaPianoConnectionState.Disconnected;
                        this.ws = null;
                        console.warn('[RehaPiano] ⚠️ Connection closed. Code:', event.code, 'Reason:', event.reason);
                        
                        // Attempt reconnection if not manually disconnected
                        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                            console.log('[RehaPiano] 🔄 Attempting reconnection...');
                            this.scheduleReconnect();
                        } else {
                            console.error('[RehaPiano] ❌ Max reconnection attempts reached');
                        }
                    };
                } catch (error) {
                    this.connectionState = RehaPianoConnectionState.Error;
                    reject(error);
                }
            });
        }

        protected scheduleReconnect(): void {
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
            }

            this.reconnectAttempts++;
            const delay = this.RECONNECT_DELAY_BASE * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

            this.reconnectTimeout = setTimeout(() => {
                this.attemptConnection().catch(() => {
                    // Reconnection failed, will try again if under max attempts
                });
            }, delay);
        }

        protected handleBinaryData(data: ArrayBuffer): void {
            // Always log the first few messages for debugging
            const isFirstMessage = this.latestChannels === null;
            
            if (isFirstMessage) {
                console.log('[RehaPiano] 🔍 handleBinaryData called! Data size:', data.byteLength);
            }
            
            if (data.byteLength !== 72) {
                // Expected: 8 bytes timestamp + 64 bytes (16 channels × 4 bytes)
                console.warn('[RehaPiano] ⚠️ Invalid data length:', data.byteLength, 'expected 72');
                return;
            }
            
            if (isFirstMessage) {
                console.log('[RehaPiano] ✅ Processing first data packet - connection is working!');
            }

            try {
                const view = new DataView(data);
                
                // Decode timestamp (8 bytes, double, little-endian)
                this.latestTimestamp = view.getFloat64(0, true);
                
                if (isFirstMessage) {
                    console.log('[RehaPiano] 🔍 Decoded timestamp:', this.latestTimestamp);
                }
                
                // Decode channels (16 channels × 4 bytes each, float, little-endian)
                const channels = new Float32Array(16);
                for (let i = 0; i < 16; i++) {
                    const offset = 8 + (i * 4);
                    channels[i] = view.getFloat32(offset, true);
                }
                
                if (isFirstMessage) {
                    console.log('[RehaPiano] 🔍 Decoded channels:', Array.from(channels).map((v, i) => `[${i}]=${v.toFixed(4)}`).join(', '));
                }
                
                this.latestChannels = channels;
                this.lastDataReceivedTime = Date.now();
                
                // Debug logging (only log occasionally and when there's activity)
                const avgValue = this.getAverageFingerValue();
                const maxValue = Math.max(...Array.from(channels).map(Math.abs));
                
                if (isFirstMessage) {
                    console.log('[RehaPiano] 📊 First packet stats - Avg:', avgValue.toFixed(4), 'Max:', maxValue.toFixed(4), 'Threshold:', this.DEFAULT_THRESHOLD);
                    console.log('[RehaPiano] ✅ Data processing complete! Connection is fully operational.');
                    
                    // Always log first few messages to debug
                    if (maxValue < 0.01) {
                        console.warn('[RehaPiano] ⚠️ WARNING: All values are zero or very small!');
                        console.warn('[RehaPiano] 💡 Press keys (q,w,e,r,t,y,u,i,a,s,d,f,g,h,j,k) on the server to generate test data');
                        console.warn('[RehaPiano] 💡 Or check if keyboard permissions are granted on macOS');
                    }
                }
                
                // Log first 10 messages always, then occasionally
                this.messageCount++;
                const shouldLog = isFirstMessage || this.messageCount <= 10 || Math.abs(maxValue) > 0.01 || Math.random() < 0.005;
                
                if (shouldLog) {
                    if (Math.abs(maxValue) > 0.01) {
                        console.log('[RehaPiano] 📊 Data received - Avg:', avgValue.toFixed(3), 'Max:', maxValue.toFixed(3), 'Channels:', Array.from(channels).map(v => v.toFixed(2)).join(', '));
                    } else {
                        console.log('[RehaPiano] 📊 Data received (all zeros) - Press keys on server to test');
                    }
                }
            } catch (error) {
                console.error('[RehaPiano] ❌ Error decoding binary data:', error);
            }
        }

        public disconnect(): void {
            // Cancel any pending reconnection
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }

            // Reset reconnection attempts to prevent auto-reconnect
            this.reconnectAttempts = this.MAX_RECONNECT_ATTEMPTS;

            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }

            this.connectionState = RehaPianoConnectionState.Disconnected;
            this.latestChannels = null;
            this.latestTimestamp = 0;
        }

        public getRawSensorValues(): Float32Array | null {
            return this.latestChannels;
        }

        public getFingerPressure(fingerIndex: number): number {
            if (fingerIndex < 0 || fingerIndex >= this.FINGER_POSITIONS.length) {
                return 0;
            }

            if (!this.latestChannels) {
                return 0;
            }

            const channelIndex = this.FINGER_POSITIONS[fingerIndex];
            const value = this.latestChannels[channelIndex];
            
            // Return absolute pressure value
            return Math.abs(value);
        }

        public getAverageFingerValue(): number {
            if (!this.latestChannels) {
                return 0;
            }

            let sum = 0;
            let activeCount = 0;
            const fingerValues: number[] = [];
            
            for (let i = 0; i < this.FINGER_POSITIONS.length; i++) {
                const channelIndex = this.FINGER_POSITIONS[i];
                const value = this.latestChannels[channelIndex];
                fingerValues.push(value);
                sum += value;
                if (Math.abs(value) > 0.001) {
                    activeCount++;
                }
            }

            // Return average with sign preserved (negative = extension, positive = compression)
            const average = sum / this.FINGER_POSITIONS.length;
            
            // Log more frequently to debug
            if (this.messageCount <= 20 || Math.abs(average) > 0.01 || Math.random() < 0.02) {
                const maxValue = Math.max(...fingerValues.map(Math.abs));
                if (maxValue > 0.01 || this.messageCount <= 20) {
                    console.log('[RehaPiano] 🎯 Average:', average.toFixed(4), 'Max:', maxValue.toFixed(4), 'Active:', activeCount, 'Values:', fingerValues.map(v => v.toFixed(2)).join(','));
                }
            }
            
            return average;
        }

        public isAnyFingerPressed(threshold: number = this.DEFAULT_THRESHOLD): boolean {
            if (!this.latestChannels) {
                return false;
            }

            for (let i = 0; i < this.FINGER_POSITIONS.length; i++) {
                const channelIndex = this.FINGER_POSITIONS[i];
                const value = Math.abs(this.latestChannels[channelIndex]);
                if (value >= threshold) {
                    return true;
                }
            }

            return false;
        }

        public getLatestTimestamp(): number {
            return this.latestTimestamp;
        }

        public isDataFresh(maxAge: number = this.DEFAULT_MAX_DATA_AGE): boolean {
            if (!this.latestChannels) {
                return false;
            }

            const age = Date.now() - this.lastDataReceivedTime;
            return age <= maxAge;
        }
    }
}

