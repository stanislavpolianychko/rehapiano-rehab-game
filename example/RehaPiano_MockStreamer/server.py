import asyncio
import logging
import os
import sys
import time
import threading
import argparse
from collections import defaultdict
import select
import tty
import termios

import keyboard
import numpy as np
import websockets

import rehapiano_data_converter
rhc = rehapiano_data_converter.RehapianoDataConverter()

# Global key state tracker (updated by hooks and stdin)
key_states = defaultdict(bool)
# Track keys pressed via stdin (for terminal input)
stdin_key_states = defaultdict(bool)

logger = logging.getLogger('websockets')
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler())

# Suppress keyboard library background thread errors
def suppress_keyboard_thread_errors():
    """Suppress OSError from keyboard library background thread"""
    original_excepthook = threading.excepthook
    
    def custom_excepthook(args):
        # Suppress keyboard library permission errors in background threads
        if (isinstance(args.exc_value, OSError) and 
            ("Error 13" in str(args.exc_value) or "Must be run as administrator" in str(args.exc_value))):
            # Silently ignore keyboard permission errors
            return
        # Call original handler for other exceptions
        original_excepthook(args)
    
    threading.excepthook = custom_excepthook

# Set up error suppression
suppress_keyboard_thread_errors()

# Safe keyboard check function
_keyboard_available = None

def check_keyboard_available():
    global _keyboard_available
    if _keyboard_available is None:
        try:
            # Try to check a key to see if keyboard library works
            # This might trigger a background thread that needs permissions
            # Try multiple keys in case one fails
            test_keys = ["space", "a", "q"]
            for test_key in test_keys:
                try:
                    keyboard.is_pressed(test_key)
                    _keyboard_available = True
                    print("✅ Keyboard library is available")
                    return True
                except (ValueError, KeyError):
                    # This key doesn't work, try next one
                    continue
                except OSError:
                    # Permission issue
                    break
            # If we get here, no keys worked
            _keyboard_available = False
            print("⚠️  Keyboard library not available")
            print("📝 On macOS, you may need to grant Accessibility permissions:")
            print("   System Settings > Privacy & Security > Accessibility")
            print("   Add Terminal (or your Python app) to the list")
            print("🔄 Server will continue but will send zero values (no key detection)")
        except Exception as e:
            _keyboard_available = False
            print(f"⚠️  Keyboard library not available: {e}")
            print("📝 On macOS, you may need to grant Accessibility permissions:")
            print("   System Settings > Privacy & Security > Accessibility")
            print("   Add Terminal (or your Python app) to the list")
            print("🔄 Server will continue but will send zero values (no key detection)")
    return _keyboard_available

def safe_key_press(key):
    # First check stdin (terminal input) - this works when typing in terminal
    if stdin_key_states.get(key.lower(), False):
        return True
    
    # Then check keyboard library (for global detection)
    if not check_keyboard_available():
        return False
    try:
        # Use both the hook-based state and is_pressed as fallback
        # The hook updates key_states, but is_pressed is more reliable for some keys
        hook_state = key_states.get(key.lower(), False)
        pressed_state = keyboard.is_pressed(key)
        return hook_state or pressed_state
    except (ValueError, KeyError, OSError) as e:
        # Handle various keyboard library errors gracefully
        # ValueError: Unrecognized character
        # KeyError: Key not found
        # OSError: Permission issues
        return key_states.get(key.lower(), False)
    except Exception as e:
        # Catch any other unexpected errors
        return key_states.get(key.lower(), False)

# Set up keyboard hooks to track key states
def setup_keyboard_hooks():
    """Set up keyboard hooks to track key press/release events"""
    if not check_keyboard_available():
        return
    
    def on_press(event):
        try:
            key_name = event.name.lower()
            key_states[key_name] = True
            # Debug: log when keys are detected
            if key_name in ['q','w','e','r','t','y','u','i','a','s','d','f','g','h','j','k']:
                print(f"🔑 Hook detected key press: {key_name}")
        except Exception as e:
            pass
    
    def on_release(event):
        try:
            key_name = event.name.lower()
            key_states[key_name] = False
        except Exception as e:
            pass
    
    try:
        keyboard.on_press(on_press)
        keyboard.on_release(on_release)
        print("✅ Keyboard hooks set up successfully")
        print("   Hooks will detect keys globally (even when terminal is focused)")
    except Exception as e:
        print(f"⚠️  Could not set up keyboard hooks: {e}")
        print("   Will use is_pressed() method instead")

# create handler for each connection
async def handler(websocket):
    print(f"New client connected: {websocket.remote_address}")
    print("💡 Press keys (q,w,e,r,t,y,u,i,a,s,d,f,g,h,j,k) to generate data")
    print("💡 Hold x/y/z while pressing keys to control pressure:")
    print("   - No key = Light press (0.25)")
    print("   - x = Medium press (0.5)")
    print("   - y = Strong press (0.75)")
    print("   - z = Maximum press (1.0)")
    print("💡 Use Shift (or capital letters) to invert values (negative/DOWN)")
    print("⚠️  IMPORTANT: Make sure this terminal window is FOCUSED/ACTIVE when pressing keys!")
    print("⚠️  The keyboard library only detects keys when the terminal has focus.")
    try:
        while True:
            # 0-7
            q = safe_key_press("q")
            w = safe_key_press("w")
            e = safe_key_press("e")
            r = safe_key_press("r")
            t = safe_key_press("t")
            y = safe_key_press("y")
            u = safe_key_press("u")
            i = safe_key_press("i")

            # 8-15
            a = safe_key_press("a")
            s = safe_key_press("s")
            d = safe_key_press("d")
            f = safe_key_press("f")
            g = safe_key_press("g")
            h = safe_key_press("h")
            j = safe_key_press("j")
            k = safe_key_press("k")

            key_channel_list = np.array([q,w,e,r,t,y,u,i,a,s,d,f,g,h,j,k])

            # Pressure control keys - x/y/z control how hard you're pressing
            # Check both keyboard library and stdin for pressure keys
            x_pressure = safe_key_press("x") or stdin_key_states.get('x', False)
            y_pressure = safe_key_press("y") or stdin_key_states.get('y', False)
            z_pressure = safe_key_press("z") or stdin_key_states.get('z', False)

            # for sending negative values
            # Check both keyboard library and stdin for shift
            shift = safe_key_press("shift") or stdin_key_states.get('shift', False)

            """
            IDEA - Pressure Control System
            - If no pressure key is pressed -> send 0.25 (light press)
            - If 'x' is pressed -> send 0.5 (medium press)
            - If 'y' is pressed -> send 0.75 (strong press)
            - If 'z' is pressed -> send 1.0 (maximum press)
            - If shift is pressed -> invert values (negative)
            - Hold pressure key + channel key together to control intensity
            """

            inverter = 1
            if shift:
                inverter = -1

            # Determine pressure level based on which key is pressed
            # Default to light press if no pressure key is active
            size = 0.250000  # Light press (default)
            
            if x_pressure:
                size = 0.500000  # Medium press
            elif y_pressure:
                size = 0.750000  # Strong press
            elif z_pressure:
                size = 1.000000  # Maximum press

            message = key_channel_list * size * inverter
            encoded_message = rhc.encode(time_stamp=time.time(), list_of_channels=list(message))
            
            # Debug: Track message count
            if not hasattr(handler, '_message_count'):
                handler._message_count = 0
            handler._message_count += 1
            
            # Log first few messages and then occasionally
            if handler._message_count <= 5:
                print(f"📤 Sending message #{handler._message_count}, size: {len(encoded_message)} bytes")
                # Debug: Show what keys are detected in first messages
                active_keys = []
                key_map = ['q','w','e','r','t','y','u','i','a','s','d','f','g','h','j','k']
                for i, pressed in enumerate(key_channel_list):
                    if pressed:
                        active_keys.append(key_map[i])
                
                # Also check hook states and stdin for debugging
                hook_active = [k for k in key_map if key_states.get(k, False)]
                stdin_active = [k for k in key_map if stdin_key_states.get(k, False)]
                
                if active_keys:
                    print(f"🔑 Detected keys (is_pressed): {', '.join(active_keys)}")
                if hook_active:
                    print(f"🔑 Detected keys (hooks): {', '.join(hook_active)}")
                if stdin_active:
                    print(f"🔑 Detected keys (stdin): {', '.join(stdin_active)}")
                if not active_keys and not hook_active and not stdin_active:
                    print(f"⚠️  No keys detected!")
                    print(f"   Debug: key_states = {dict(key_states)}")
                    print(f"   Debug: stdin_key_states = {dict(stdin_key_states)}")
                    print(f"   Debug: key_channel_list = {key_channel_list}")
            elif handler._message_count % 250 == 0:  # Every ~1 second at 250Hz
                print(f"📤 Sent {handler._message_count} messages so far...")
            
            # Print when keys are detected (more verbose)
            if any(abs(x) > 0.01 for x in message):
                # Format message nicely for display
                active_indices = [i for i, x in enumerate(message) if abs(x) > 0.01]
                active_values = [f"{message[i]:.3f}" for i in active_indices]
                key_map = ['q','w','e','r','t','y','u','i','a','s','d','f','g','h','j','k']
                active_keys = [key_map[i] for i in active_indices]
                
                # Show pressure level
                pressure_level = "Light"
                if size >= 1.0:
                    pressure_level = "MAX (z)"
                elif size >= 0.75:
                    pressure_level = "Strong (y)"
                elif size >= 0.5:
                    pressure_level = "Medium (x)"
                
                direction = "UP" if not shift else "DOWN"
                print(f"🎹 {pressure_level} pressure - {direction} - Channels {active_indices} ({', '.join(active_keys)}): {', '.join(active_values)}")
            
            try:
                await websocket.send(encoded_message)
            except websockets.exceptions.ConnectionClosed:
                print(f"Client disconnected normally: {websocket.remote_address}")
                break
            except websockets.exceptions.ConnectionClosedError as e:
                print(f"Connection closed with error: {e.code} - {e.reason}")
                break
            except Exception as e:
                print(f"Error sending data: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                break
            await asyncio.sleep(0.004)
    except websockets.exceptions.ConnectionClosed:
        print(f"Connection closed during handler: {websocket.remote_address}")
    except Exception as e:
        print(f"Handler error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print(f"Handler finished for: {websocket.remote_address}")

async def read_stdin(loop):
    """Read characters from stdin and update key states"""
    # Use a thread to read stdin without blocking the event loop
    def stdin_reader():
        old_settings = None
        try:
            # Try to set terminal to raw mode for character-by-character input
            try:
                old_settings = termios.tcgetattr(sys.stdin)
                tty.setraw(sys.stdin.fileno())
                print("✅ Terminal set to raw mode for stdin reading")
            except Exception as e:
                print(f"⚠️  Could not set raw mode: {e}")
                print("   Stdin reader will still try to work...")
            
            print("✅ Stdin reader thread started - typing in terminal will be detected!")
            
            while True:
                try:
                    # Check if stdin is readable (non-blocking check)
                    if select.select([sys.stdin], [], [], 0.1)[0]:
                        char = sys.stdin.read(1)
                        if not char:
                            break
                        
                        # Check if this is a capital letter (shift was pressed)
                        is_shifted = char.isupper() and char.isalpha()
                        char_lower = char.lower()
                        
                        # Map characters to our key channels
                        key_map = {
                            'q': 'q', 'w': 'w', 'e': 'e', 'r': 'r', 
                            't': 't', 'y': 'y', 'u': 'u', 'i': 'i',
                            'a': 'a', 's': 's', 'd': 'd', 'f': 'f',
                            'g': 'g', 'h': 'h', 'j': 'j', 'k': 'k',
                            'z': 'z', 'x': 'x', 'y': 'y'  # x/y/z are pressure control keys
                        }
                        
                        if char_lower in key_map:
                            stdin_key_states[key_map[char_lower]] = True
                            
                            # Special handling for pressure control keys (x/y/z)
                            # These should stay active longer so they can be held while pressing other keys
                            is_pressure_key = char_lower in ['x', 'y', 'z']
                            
                            # Set shift state if capital letter
                            if is_shifted:
                                stdin_key_states['shift'] = True
                                print(f"🔑 Stdin detected: {char_lower} (with SHIFT - will send negative values)")
                            else:
                                stdin_key_states['shift'] = False
                                if is_pressure_key:
                                    print(f"🔑 Pressure key detected: {char_lower} (hold this while pressing other keys)")
                                else:
                                    print(f"🔑 Stdin detected: {char_lower} (no shift - will send positive values)")
                            
                            # Schedule auto-release
                            # Pressure keys stay active longer (0.5s) so they can be held
                            release_delay = 0.5 if is_pressure_key else 0.1
                            try:
                                asyncio.run_coroutine_threadsafe(
                                    release_key_after_delay(key_map[char_lower], release_delay),
                                    loop
                                )
                                if is_shifted:
                                    asyncio.run_coroutine_threadsafe(
                                        release_key_after_delay('shift', 0.1),
                                        loop
                                    )
                            except Exception as e:
                                # If scheduling fails, just release after delay in thread
                                import time
                                time.sleep(release_delay)
                                stdin_key_states[key_map[char_lower]] = False
                                if is_shifted:
                                    stdin_key_states['shift'] = False
                        elif char == '\x03':  # Ctrl+C
                            break
                except Exception as e:
                    print(f"⚠️  Error reading stdin: {e}")
                    import traceback
                    traceback.print_exc()
                    break
        except Exception as e:
            print(f"⚠️  Stdin reader error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            if old_settings:
                try:
                    termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
                except:
                    pass
    
    # Start stdin reader in a thread
    thread = threading.Thread(target=stdin_reader, daemon=True)
    thread.start()
    print("✅ Stdin reader task started!")
    
    # Keep the coroutine alive
    while True:
        await asyncio.sleep(1)

async def release_key_after_delay(key, delay):
    """Release a key after a delay"""
    await asyncio.sleep(delay)
    stdin_key_states[key] = False

def get_port():
    """Get port from PORT env var or --port argument (default 8005)."""
    parser = argparse.ArgumentParser(description="RehaPiano Mock Streamer")
    parser.add_argument("--port", "-p", type=int, default=None,
                        help="WebSocket port (default: 8005 or PORT env)")
    args = parser.parse_args()
    if args.port is not None:
        return args.port
    return int(os.environ.get("PORT", "8005"))


async def main():
    port = get_port()
    print("=" * 60)
    print("🎮 RehaPiano Mock Streamer")
    print("=" * 60)
    print(f"Starting server on ws://localhost:{port}")
    print()
    
    # Check keyboard availability upfront
    check_keyboard_available()
    
    # Set up keyboard hooks for better key detection
    setup_keyboard_hooks()
    
    # Start stdin reader in background
    stdin_task = None
    try:
        loop = asyncio.get_event_loop()
        stdin_task = asyncio.create_task(read_stdin(loop))
    except Exception as e:
        print(f"⚠️  Could not set up stdin reader: {e}")
        print("   Will use keyboard library only")
    print()
    
    try:
        async with websockets.serve(handler, "localhost", port):
            print("✅ Server is running and waiting for connections...")
            print(f"📡 WebSocket endpoint: ws://localhost:{port}")
            print("💡 Type keys in this terminal (q,w,e,etc.) to generate data")
            print("💡 Press Ctrl+C to stop the server")
            print()
            await asyncio.Future()  # run forever
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
        # Clean up
        if stdin_task:
            stdin_task.cancel()
        try:
            keyboard.unhook_all()
        except:
            pass
    except Exception as e:
        print(f"❌ Server error: {e}")
        import traceback
        traceback.print_exc()
        # Clean up
        if stdin_task:
            stdin_task.cancel()
        try:
            keyboard.unhook_all()
        except:
            pass

if __name__ == "__main__":
    asyncio.run(main())
#%%
