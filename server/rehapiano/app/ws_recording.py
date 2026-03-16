# rehapiano/app/ws_recording.py
import asyncio, gzip, json, os, time, uuid, tempfile
from typing import Optional, Set, Dict, Any
from .ws_tap import ws_tap

# Recording output directory - configurable via environment variable or set_recordings_dir()
# Structure: {RECORDINGS_DIR}/raw/*.jsonl.gz, {RECORDINGS_DIR}/metadata/*.meta.json
RECORDINGS_DIR = os.environ.get("RECORDINGS_DIR", "recordings")
RECORDINGS_RAW_DIR = os.path.join(RECORDINGS_DIR, "raw")
RECORDINGS_META_DIR = os.path.join(RECORDINGS_DIR, "metadata")

def set_recordings_dir(path: str):
    """Set recordings directory. Call before creating recorder instance."""
    global RECORDINGS_DIR, RECORDINGS_RAW_DIR, RECORDINGS_META_DIR
    RECORDINGS_DIR = path
    RECORDINGS_RAW_DIR = os.path.join(RECORDINGS_DIR, "raw")
    RECORDINGS_META_DIR = os.path.join(RECORDINGS_DIR, "metadata")
    print(f"[RECORDINGS] Directory set to: {RECORDINGS_DIR}")

DEFAULT_DURATION_S = 300       # klientom požadovaná dĺžka (ak nič, použije sa toto)
HARD_CAP_S = 900               # server-side tvrdý strop
DEFAULT_COMPRESS = True

def _iso(ts: Optional[float]) -> Optional[str]:
    if ts is None: return None
    import datetime
    return datetime.datetime.utcfromtimestamp(ts).isoformat() + "Z"

class SingleWsRecorder:
    def __init__(self) -> None:
        os.makedirs(RECORDINGS_RAW_DIR, exist_ok=True)
        os.makedirs(RECORDINGS_META_DIR, exist_ok=True)
        self._task: Optional[asyncio.Task] = None
        self._stop_ev = asyncio.Event()
        self._state: Dict[str, Any] = {"status":"idle"}

    def state(self) -> Dict[str, Any]:
        return dict(self._state)

    def is_recording(self) -> bool:
        return self._state.get("status") == "recording"

    async def start(self, duration_s: Optional[int], compress: Optional[bool], notes: Optional[str]) -> Dict[str, Any]:
        if self.is_recording():
            raise RuntimeError("already_recording")

        dur = int(duration_s or DEFAULT_DURATION_S)
        dur = max(1, min(dur, HARD_CAP_S))
        comp = bool(DEFAULT_COMPRESS if compress is None else compress)

        rid = f"rc_{uuid.uuid4().hex[:8]}"
        data_path = os.path.join(RECORDINGS_RAW_DIR, f"{rid}.jsonl" + (".gz" if comp else ""))
        meta_path = os.path.join(RECORDINGS_META_DIR, f"{rid}.meta.json")
        part_path = data_path + ".part"

        self._state = {
            "recording_id": rid,
            "status": "recording",
            "started_at": time.time(),
            "finished_at": None,
            "samples": 0,
            "bytes_written": 0,
            "dropped": 0,
            "channels_seen": set(),   # do meta uložíme ako list
            "duration_s": dur,
            "hard_cap_s": HARD_CAP_S,
            "compress": comp,
            "notes": notes,
            "data_path": data_path,
            "part_path": part_path,
            "meta_path": meta_path,
        }

        self._stop_ev = asyncio.Event()
        self._task = asyncio.create_task(self._run())
        return {
            "recording_id": rid,
            "status": "recording",
            "started_at": _iso(self._state["started_at"]),
            "limits": {"duration_s": dur, "hard_cap_s": HARD_CAP_S},
            "paths": {"data": data_path, "meta": meta_path}
        }

    async def stop(self) -> Dict[str, Any]:
        if not self.is_recording():
            raise RuntimeError("not_recording")
        self._stop_ev.set()
        assert self._task
        try:
            await self._task
        finally:
            self._task = None
        return self._result_payload()

    def _result_payload(self) -> Dict[str, Any]:
        st = self._state
        return {
            "recording_id": st.get("recording_id"),
            "status": st.get("status"),
            "finished_at": _iso(st.get("finished_at")),
            "stats": {
                "samples": st.get("samples", 0),
                "bytes_written": st.get("bytes_written", 0),
                "dropped": st.get("dropped", 0),
            },
            "paths": {"data": st.get("data_path"), "meta": st.get("meta_path")}
        }

    async def _run(self):
        st = self._state
        started = st["started_at"]
        deadline = started + st["duration_s"]

        opener = gzip.open if st["compress"] else open
        # píšeme do .part a po skončení premenovať
        with opener(st["part_path"], "wt", encoding="utf-8") as f:
            # meta stub
            with open(st["meta_path"], "w", encoding="utf-8") as mf:
                json.dump({
                    "recording_id": st["recording_id"],
                    "source": "websocket",
                    "status": "recording",
                    "started_at": _iso(st["started_at"]),
                    "limits": {"duration_s": st["duration_s"], "hard_cap_s": st["hard_cap_s"]},
                    "paths": {"data": st["data_path"]},
                    "notes": st["notes"],
                    "version": 1
                }, mf, ensure_ascii=False, indent=2)

            try:
                async for msg in ws_tap.subscribe():
                    now = time.time()
                    if self._stop_ev.is_set() or now >= deadline:
                        break

                    # zapisuj 1:1 (presne WS obsah)
                    try:
                        line = json.dumps(msg, ensure_ascii=False, separators=(",", ":"))
                    except Exception:
                        # ak by prišiel ne-serializovateľný objekt
                        st["dropped"] += 1
                        continue

                    f.write(line + "\n")
                    st["samples"] += 1
                    st["bytes_written"] += len(line) + 1
                    # typ správy (kind) – len info do meta
                    k = msg.get("kind")
                    if k:
                        cs: Set[str] = st["channels_seen"]
                        cs.add(str(k))
            finally:
                # finalize
                st["status"] = "stopped"
                st["finished_at"] = time.time()
                # zatvorené, premenuj .part -> finálny
                try:
                    os.replace(st["part_path"], st["data_path"])
                except Exception:
                    pass
                # dopíš meta
                with open(st["meta_path"], "w", encoding="utf-8") as mf:
                    json.dump({
                        "recording_id": st["recording_id"],
                        "source": "websocket",
                        "status": st["status"],
                        "started_at": _iso(st["started_at"]),
                        "finished_at": _iso(st["finished_at"]),
                        "limits": {"duration_s": st["duration_s"], "hard_cap_s": st["hard_cap_s"]},
                        "stats": {
                            "samples": st["samples"],
                            "bytes_written": st["bytes_written"],
                            "dropped": st["dropped"],
                            "channels_seen": sorted(list(st["channels_seen"]))
                        },
                        "paths": {"data": st["data_path"]},
                        "notes": st["notes"],
                        "version": 1
                    }, mf, ensure_ascii=False, indent=2)