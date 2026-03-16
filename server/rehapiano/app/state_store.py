# rehapiano/app/state_store.py
from __future__ import annotations
from copy import deepcopy
from typing import Dict, Any
import time

_state: Dict[str, Dict[str, Any]] = {}

def upsert_port(port: str, **fields):
    s = _state.get(port, {
        "port": port,
        "baud": None,
        "online": False,
        "identified": False,
        "uid": None,         # int
        "uid_dec": None,     # int (to isté ako uid, pohodlné pre UI)
        "uid_hex": None,     # "0xXXXXXXXX"
        "fw": None,          # int (napr. 227)
        "hand": "unknown",   # "left"|"right"|"unknown"
        "hand_code": None,   # 0x01|0x81|None
        "last_seen": None,
        "last_sample_ts": None,
        "last_identifier_ts": None,
    })
    s.update(fields)
    _state[port] = s

def remove_port(port: str):
    _state.pop(port, None)

def snapshot() -> Dict[str, Dict[str, Any]]:
    return deepcopy(_state)