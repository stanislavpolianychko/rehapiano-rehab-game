from __future__ import annotations
import os, numbers
from typing import Any, Dict, Tuple
import yaml

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_CONFIG = os.path.normpath(os.path.join(_BASE_DIR, "..", "config", "normalization.yaml"))
DEFAULT_FILE = os.getenv("REHAPIANO_NORMALIZATION_FILE", _DEFAULT_CONFIG)

def _is_number(x: Any) -> bool:
    return isinstance(x, numbers.Number)

def _divide_deep(value: Any, divisor: float) -> Any:
    if divisor in (0, 0.0):
        divisor = 1.0
    if _is_number(value):
        return value / divisor
    if isinstance(value, dict):
        return {k: _divide_deep(v, divisor) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        t = type(value)
        return t(_divide_deep(v, divisor) for v in value)
    return value

class PayloadNormalizer:
    """
    Pravidlá z YAML:
      - 'section': aplikuje divisor na celé pole (list/dict) podľa prvého segmentu (napr. 'adc')
      - 'key': aplikuje divisor na presný kľúč (napr. 'imu.pitch')
      - 'prefix': aplikuje divisor na všetky kľúče s prefixom v sekcii (napr. 'imu.gyro*')
    """
    def __init__(self, config_file: str = DEFAULT_FILE):
        self.config_file = config_file
        self.rules: Dict[str, Tuple[str, float]] = {}
        self._load()

    def _load(self) -> None:
        with open(self.config_file, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        # ulož ako: path -> (match_type, divisor)
        rules = {}
        for path, item in cfg.items():
            mtype = str(item.get("match", "section")).lower()
            divisor = float(item.get("divisor", 1))
            rules[path] = (mtype, divisor)
        self.rules = rules

    def normalize_payload(self, parsed: Dict[str, Any]) -> Dict[str, Any]:
        out = dict(parsed)
        for path, (mtype, divisor) in self.rules.items():
            # rozparsuj "imu.gyro*" / "imu.pitch" / "adc"
            parts = path.split(".")
            # navigácia do rodiča cieľového uzla
            parent = out
            ok = True
            for i, seg in enumerate(parts):
                is_last = (i == len(parts) - 1)
                star = seg.endswith("*")
                base = seg[:-1] if star else seg

                if mtype == "section" and not is_last:
                    # sekcia má byť jednotlivý koreňový kľúč, takže ak je viac segmentov, preskoč
                    ok = False
                    break

                if is_last:
                    if mtype == "section":
                        # aplikuje sa na celé 'base' pole v roote (napr. 'adc')
                        if base in out:
                            out[base] = _divide_deep(out[base], divisor)
                        continue

                    # key/prefix vnútri nejakej sekcie (napr. imu.*)
                    # najprv zistíme rodiča
                    if len(parts) == 1:
                        # 'imu.pitch' nemá rodiča? v tom prípade sme priamo v roote
                        target_parent = out
                        keyseg = seg
                    else:
                        # rodič je všetko okrem posledného segmentu
                        parent_path = parts[:-1]
                        target_parent = out
                        for p in parent_path:
                            if isinstance(target_parent, dict) and p in target_parent:
                                target_parent = target_parent[p]
                            else:
                                target_parent = None
                                break
                        keyseg = seg
                    if not isinstance(target_parent, dict):
                        break

                    if mtype == "key":
                        # presný kľúč
                        if keyseg in target_parent:
                            target_parent[keyseg] = _divide_deep(target_parent[keyseg], divisor)

                    elif mtype == "prefix":
                        star = keyseg.endswith("*")
                        prefix = keyseg[:-1] if star else keyseg
                        for k in list(target_parent.keys()):
                            if k.startswith(prefix):
                                target_parent[k] = _divide_deep(target_parent[k], divisor)
                else:
                    # medzikrok pri prechode (napr. 'imu' v 'imu.gyro*')
                    if isinstance(parent, dict) and base in parent:
                        parent = parent[base]
                    else:
                        ok = False
                        break
            if not ok:
                continue
        return out