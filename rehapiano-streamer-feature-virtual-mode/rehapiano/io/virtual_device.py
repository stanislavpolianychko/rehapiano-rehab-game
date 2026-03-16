# rehapiano/io/virtual_device.py
"""
Virtual device simulation for development without physical hardware.

Simulates two hands (left/right) with keyboard input:
- Left hand: Q, W, E, R, T (little, ring, middle, index, thumb)
- Right hand: Y, U, I, O, P (little, ring, middle, index, thumb)

Generates realistic ADC waveforms with attack/decay phases and noise.
"""
import asyncio
import time
import random
import math
from typing import Dict, Callable, Optional, Any, Set
from dataclasses import dataclass, field


# Virtual device configuration
VIRTUAL_LEFT_PORT = "/virtual/left"
VIRTUAL_RIGHT_PORT = "/virtual/right"
VIRTUAL_LEFT_UID = 2000001  # UID 2 prefix for virtual devices
VIRTUAL_RIGHT_UID = 2000002
VIRTUAL_FW = 231  # Same as real devices

# Keyboard mapping (key -> finger index 0-4)
# Finger order: 0=little, 1=ring, 2=middle, 3=index, 4=thumb
LEFT_KEYS = {'q': 0, 'w': 1, 'e': 2, 'r': 3, 't': 4}
RIGHT_KEYS = {'y': 0, 'u': 1, 'i': 2, 'o': 3, 'p': 4}

# ADC waveform parameters
MAX_ADC_VALUE = 400.0  # Maximum normalized ADC value (after /128)
MIN_ADC_VALUE = -50.0  # Baseline noise range
ATTACK_TIME = 0.08  # Time to reach peak (seconds)
DECAY_TIME = 0.15  # Time to decay to sustain level (seconds)
RELEASE_TIME = 0.25  # Time to return to baseline (seconds)
SUSTAIN_LEVEL = 0.7  # Sustain level relative to peak
NOISE_AMPLITUDE = 15.0  # Random noise amplitude
BASELINE_NOISE = 8.0  # Baseline noise when not pressed


@dataclass
class FingerState:
    """State of a single finger (key press)."""
    pressed: bool = False
    press_time: float = 0.0
    release_time: float = 0.0
    current_value: float = 0.0
    target_value: float = 0.0

    # Per-finger randomization for more realistic feel
    peak_value: float = field(default_factory=lambda: MAX_ADC_VALUE * random.uniform(0.8, 1.0))
    attack_speed: float = field(default_factory=lambda: 1.0 / (ATTACK_TIME * random.uniform(0.8, 1.2)))
    decay_speed: float = field(default_factory=lambda: 1.0 / (DECAY_TIME * random.uniform(0.8, 1.2)))
    release_speed: float = field(default_factory=lambda: 1.0 / (RELEASE_TIME * random.uniform(0.8, 1.2)))


class VirtualHandDevice:
    """Simulates a single hand device (5 fingers)."""

    def __init__(
        self,
        port: str,
        uid: int,
        hand: str,  # "left" or "right"
        key_mapping: Dict[str, int],
        on_sample: Callable,
    ):
        self.port = port
        self.uid = uid
        self.fw = VIRTUAL_FW
        self.hand = hand
        self.hand_code = 0x01 if hand == "left" else 0x81
        self.key_mapping = key_mapping
        self.on_sample = on_sample

        # State for each finger (5 fingers)
        self.fingers: list[FingerState] = [FingerState() for _ in range(5)]

        # Currently pressed keys
        self.pressed_keys: Set[str] = set()

        # Task control
        self._running = False
        self._task: Optional[asyncio.Task] = None

        # Sample timing
        self._last_sample_time = 0.0
        self._sample_interval = 0.01  # 100 Hz

    async def start(self):
        """Start the virtual device sample generation loop."""
        if self._running:
            return
        self._running = True
        self._last_sample_time = time.time()
        self._task = asyncio.create_task(self._sample_loop())
        print(f"[VIRTUAL] Started {self.hand} hand device: {self.port}")

    async def stop(self):
        """Stop the virtual device."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        print(f"[VIRTUAL] Stopped {self.hand} hand device: {self.port}")

    def key_down(self, key: str):
        """Handle key press."""
        key = key.lower()
        if key in self.key_mapping:
            finger_idx = self.key_mapping[key]
            finger = self.fingers[finger_idx]
            if not finger.pressed:
                finger.pressed = True
                finger.press_time = time.time()
                # Randomize peak for this press
                finger.peak_value = MAX_ADC_VALUE * random.uniform(0.75, 1.0)
                self.pressed_keys.add(key)

    def key_up(self, key: str):
        """Handle key release."""
        key = key.lower()
        if key in self.key_mapping:
            finger_idx = self.key_mapping[key]
            finger = self.fingers[finger_idx]
            if finger.pressed:
                finger.pressed = False
                finger.release_time = time.time()
                self.pressed_keys.discard(key)

    def _update_finger_value(self, finger: FingerState, now: float) -> float:
        """Calculate current ADC value for a finger with ADSR envelope."""
        if finger.pressed:
            # Key is down - attack/sustain phase
            time_since_press = now - finger.press_time
            attack_progress = time_since_press * finger.attack_speed

            if attack_progress < 1.0:
                # Attack phase - exponential rise
                finger.current_value = finger.peak_value * (1 - math.exp(-3 * attack_progress))
            else:
                # Decay to sustain
                decay_progress = (attack_progress - 1.0) * finger.decay_speed
                if decay_progress < 1.0:
                    # Decay phase
                    start_val = finger.peak_value
                    end_val = finger.peak_value * SUSTAIN_LEVEL
                    finger.current_value = start_val + (end_val - start_val) * (1 - math.exp(-3 * decay_progress))
                else:
                    # Sustain phase - slight variation
                    sustain_val = finger.peak_value * SUSTAIN_LEVEL
                    finger.current_value = sustain_val + random.uniform(-10, 10)
        else:
            # Key is up - release phase
            if finger.release_time > 0:
                time_since_release = now - finger.release_time
                release_progress = time_since_release * finger.release_speed

                if release_progress < 1.0:
                    # Exponential decay to baseline
                    finger.current_value *= math.exp(-5 * self._sample_interval * finger.release_speed)
                else:
                    # At baseline
                    finger.current_value = 0
            else:
                finger.current_value = 0

        # Add noise
        noise = random.gauss(0, NOISE_AMPLITUDE if finger.pressed else BASELINE_NOISE)
        return finger.current_value + noise

    def _generate_imu_data(self) -> Dict[str, float]:
        """Generate simulated IMU data with slight variations."""
        # Baseline IMU values with small noise
        base_values = {
            "linAccX": random.gauss(0, 0.05),
            "linAccY": random.gauss(0, 0.05),
            "linAccZ": random.gauss(-0.1, 0.05),
            "pitch": random.gauss(0, 0.5) if self.hand == "left" else random.gauss(0, 0.5),
            "roll": random.gauss(-89 if self.hand == "left" else 89, 0.5),
            "yaw": random.gauss(200 if self.hand == "left" else 316, 0.5),
            "gyroX": random.gauss(0, 0.3),
            "gyroY": random.gauss(0, 0.3),
            "gyroZ": random.gauss(0, 0.3),
            "gravX": -9.8 if self.hand == "left" else 9.8,
            "gravY": random.gauss(0, 0.05),
            "gravZ": random.gauss(0.1, 0.05),
            "magX": random.gauss(31 if self.hand == "left" else -31, 1),
            "magY": random.gauss(-25 if self.hand == "left" else 16, 1),
            "magZ": random.gauss(9 if self.hand == "left" else -16, 1),
            "quatW": 0.66 if self.hand == "right" else -0.13,
            "quatX": 0.27 if self.hand == "right" else 0.69,
            "quatY": -0.65 if self.hand == "right" else -0.13,
            "quatZ": 0.26 if self.hand == "right" else -0.70,
            "temp": 38.0 + random.gauss(0, 0.5),
        }
        return base_values

    async def _sample_loop(self):
        """Main loop generating samples at ~100 Hz."""
        try:
            while self._running:
                now = time.time()

                # Generate ADC values for all 5 fingers + dummy channel
                # ADC order: [dummy, little, ring, middle, index, thumb]
                # which maps to: [0, ch1, ch2, ch3, ch4, ch5]
                adc_values = [0.0]  # dummy channel
                for finger in self.fingers:
                    value = self._update_finger_value(finger, now)
                    adc_values.append(value)

                # Generate IMU data
                imu_data = self._generate_imu_data()

                # Create sample payload
                sample = {
                    "port": self.port,
                    "ts": now,
                    "type": self.hand_code,
                    "adc": adc_values,
                    "imu": imu_data,
                }

                # Call the sample callback
                await self.on_sample(sample)

                # Sleep until next sample
                elapsed = time.time() - now
                sleep_time = max(0, self._sample_interval - elapsed)
                await asyncio.sleep(sleep_time)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[VIRTUAL] Error in sample loop for {self.port}: {e}")


class VirtualDeviceManager:
    """
    Manages virtual hand devices for development/testing.

    Provides keyboard simulation:
    - Left hand: Q, W, E, R, T
    - Right hand: Y, U, I, O, P
    """

    def __init__(self, on_sample: Callable, on_device_added: Callable, on_identifier: Callable):
        self.on_sample = on_sample
        self.on_device_added = on_device_added
        self.on_identifier = on_identifier

        self._enabled = False
        self._left_device: Optional[VirtualHandDevice] = None
        self._right_device: Optional[VirtualHandDevice] = None

    @property
    def enabled(self) -> bool:
        return self._enabled

    @property
    def left_device(self) -> Optional[VirtualHandDevice]:
        return self._left_device

    @property
    def right_device(self) -> Optional[VirtualHandDevice]:
        return self._right_device

    async def enable(self):
        """Enable virtual mode - start both virtual hand devices."""
        if self._enabled:
            return

        self._enabled = True
        print("[VIRTUAL] Enabling virtual mode...")

        # Create left hand device
        self._left_device = VirtualHandDevice(
            port=VIRTUAL_LEFT_PORT,
            uid=VIRTUAL_LEFT_UID,
            hand="left",
            key_mapping=LEFT_KEYS,
            on_sample=self.on_sample,
        )

        # Create right hand device
        self._right_device = VirtualHandDevice(
            port=VIRTUAL_RIGHT_PORT,
            uid=VIRTUAL_RIGHT_UID,
            hand="right",
            key_mapping=RIGHT_KEYS,
            on_sample=self.on_sample,
        )

        # Start devices
        await self._left_device.start()
        await self._right_device.start()

        # Notify about device additions
        await self.on_device_added(VIRTUAL_LEFT_PORT)
        await self.on_device_added(VIRTUAL_RIGHT_PORT)

        # Send identifier messages
        await self.on_identifier(VIRTUAL_LEFT_PORT, VIRTUAL_LEFT_UID, VIRTUAL_FW)
        await self.on_identifier(VIRTUAL_RIGHT_PORT, VIRTUAL_RIGHT_UID, VIRTUAL_FW)

        print("[VIRTUAL] Virtual mode enabled - both hands active")
        print("[VIRTUAL] Left hand keys: Q W E R T (little→thumb)")
        print("[VIRTUAL] Right hand keys: Y U I O P (little→thumb)")

    async def disable(self):
        """Disable virtual mode - stop all virtual devices."""
        if not self._enabled:
            return

        self._enabled = False
        print("[VIRTUAL] Disabling virtual mode...")

        # Stop devices
        if self._left_device:
            await self._left_device.stop()
        if self._right_device:
            await self._right_device.stop()

        # Clear references
        self._left_device = None
        self._right_device = None

        print("[VIRTUAL] Virtual mode disabled")

    def key_down(self, key: str):
        """Handle key down event."""
        if not self._enabled:
            return

        key = key.lower()
        if key in LEFT_KEYS and self._left_device:
            self._left_device.key_down(key)
        elif key in RIGHT_KEYS and self._right_device:
            self._right_device.key_down(key)

    def key_up(self, key: str):
        """Handle key up event."""
        if not self._enabled:
            return

        key = key.lower()
        if key in LEFT_KEYS and self._left_device:
            self._left_device.key_up(key)
        elif key in RIGHT_KEYS and self._right_device:
            self._right_device.key_up(key)

    def get_state(self) -> Dict[str, Any]:
        """Get current state of virtual devices."""
        return {
            "enabled": self._enabled,
            "left": {
                "port": VIRTUAL_LEFT_PORT,
                "uid": VIRTUAL_LEFT_UID,
                "pressed_keys": list(self._left_device.pressed_keys) if self._left_device else [],
            } if self._left_device else None,
            "right": {
                "port": VIRTUAL_RIGHT_PORT,
                "uid": VIRTUAL_RIGHT_UID,
                "pressed_keys": list(self._right_device.pressed_keys) if self._right_device else [],
            } if self._right_device else None,
        }
