# Scrum Tasks: Virtual Mode Bug Fixes

**Sprint:** Virtual Mode Feature Branch Testing
**Epic:** REHAPIANO-VIRTUAL-MODE
**Created:** 2026-02-24

---

## Task 1: [STREAMER] Add hand/type to WebSocket identifier message

**Type:** Bug Fix
**Priority:** High
**Story Points:** 2
**Assignee:** TBD
**Labels:** `bug`, `streamer`, `websocket`, `virtual-mode`

### Description
Identifier WebSocket správa neobsahovala `hand` a `type` polia, čo spôsobovalo, že herné klienty nedokázali správne identifikovať ruku zariadenia.

### Acceptance Criteria
- [x] `identifier` správa obsahuje `hand` pole ("left", "right", alebo "unknown")
- [x] `identifier` správa obsahuje `type` pole (hand code: 0x01 alebo 0x81)
- [x] Funguje pre fyzické aj virtuálne zariadenia
- [ ] Unit testy overujú novú štruktúru správy

### Files Changed
- `rehapiano/app/main.py` - pridané `hand` a `type` do broadcast

### Testing
```bash
# Spusti streamer
python -m rehapiano.app.main --http-port 5555

# Zapni virtual mode a over WebSocket správy
curl -X POST http://localhost:5555/api/virtual/enable
wscat -c ws://localhost:5555/ws
# Over že identifier správa obsahuje hand a type
```

---

## Task 2: [STREAMER] Add hand to device_added/removed messages

**Type:** Bug Fix
**Priority:** High
**Story Points:** 1
**Assignee:** TBD
**Labels:** `bug`, `streamer`, `websocket`, `virtual-mode`

### Description
`device_added` a `device_removed` správy neobsahovali `hand` pole, čo sťažovalo klientom identifikáciu ruky pri pripojení zariadenia.

### Acceptance Criteria
- [x] `device_added` správa obsahuje `hand` pole
- [x] `device_removed` správa obsahuje `hand` pole
- [x] Pre virtuálne zariadenia je hand známy ihneď ("left"/"right")
- [x] Pre fyzické zariadenia je hand "unknown" do prvého sample

### Files Changed
- `rehapiano/app/main.py` - device_added/removed s hand
- `rehapiano/app/server.py` - disable virtual mode device_removed s hand

### Testing
```bash
# Pripoj fyzické zariadenie a over device_added správu
# Zapni/vypni virtual mode a over device_added/removed správy
```

---

## Task 3: [GAMES] Update streamer.js WebSocket handlers

**Type:** Bug Fix
**Priority:** High
**Story Points:** 3
**Assignee:** TBD
**Labels:** `bug`, `games`, `javascript`, `virtual-mode`

### Description
Herný JavaScript klient (streamer.js) mal niekoľko problémov:
1. Nehandloval `snapshot` správu (initial state on connect)
2. Nehandloval `heartbeat` správu (spôsobovalo console warnings)
3. `_handleSample` neaktualizoval `hand` z sample správy
4. `_handleDeviceAdded` neinicializoval `hand` pole
5. `_handleIdentifier` bol príliš prísny pri určovaní ruky

### Acceptance Criteria
- [x] Handler pre `snapshot` správu
- [x] Handler pre `heartbeat` správu (ignore)
- [x] `_handleSample` aktualizuje `hand` ak príde v správe
- [x] `_handleDeviceAdded` inicializuje `hand` z správy
- [x] `_handleIdentifier` robustnejšie určenie ruky (fallback chain)
- [x] Event listener pre `snapshot` pridaný

### Files Changed
- `_repos/Apps/APP-CIT-DEVs-TEST-TUKE/rehapianotiles/js/streamer.js`
- `_repos/Apps/app-template-web-client/js/streamer.js`

### Testing
```bash
# Spusti hru s ?dev=true parametrom
# Zapni virtual mode v streameri
# Over v DevTools console že:
# - [STREAMER] Snapshot device: ... sa zobrazí
# - [STREAMER] Identifier: ... hand=left/right sa zobrazí
# - Hra sa spustí správne
```

---

## Task 4: [MAIN-APP] Update streamer.py WebSocket handlers

**Type:** Enhancement
**Priority:** Medium
**Story Points:** 2
**Assignee:** TBD
**Labels:** `enhancement`, `main-app`, `python`, `virtual-mode`

### Description
Mother App streamer klient teraz využíva nové `hand` pole v `identifier` a `device_added` správach, namiesto spoliehania sa len na sample správy.

### Acceptance Criteria
- [x] Handler pre `snapshot` správu
- [x] `identifier` handler používa `hand` a `type` z správy
- [x] `device_added` handler používa `hand` z správy
- [ ] Zachovaná spätná kompatibilita so starším streamerom

### Files Changed
- `_repos/Device/main-app/app/services/streamer.py`

### Testing
```bash
# Spusti main-app a streamer
# Zapni virtual mode
# Over v main-app UI že obe ruky sú zobrazené správne
```

---

## Task 5: [DOCS] Update WebSocket protocol documentation

**Type:** Documentation
**Priority:** Low
**Story Points:** 1
**Assignee:** TBD
**Labels:** `documentation`, `streamer`

### Description
Aktualizovať dokumentáciu WebSocket protokolu so správnymi príkladmi správ.

### Acceptance Criteria
- [x] README.md aktualizované s novými poliami v správach
- [x] DEVELOPER_GUIDE.md aktualizované s novými poliami
- [x] TODO sekcia vyčistená (dokončené položky odstránené)

### Files Changed
- `_repos/Device/rehapiano-streamer/README.md`
- `_repos/Apps/app-template-web-client/DEVELOPER_GUIDE.md`

---

## Task 6: [QA] Integration testing of virtual mode with games

**Type:** Testing
**Priority:** High
**Story Points:** 3
**Assignee:** TBD
**Labels:** `testing`, `qa`, `virtual-mode`

### Description
Otestovať kompletný flow virtual mode s hrami podľa pôvodných test casov.

### Test Cases
1. **Pripájanie/odpájanie fyzických rúk** - funguje bez zmien
2. **RehapianoTiles s virtuálnymi rukami** - hra sa spustí a reaguje na klávesnicu
3. **Port 5555 po zastavení Docker kontajnera** - virtual mode funguje
4. **Prepínanie medzi fyzickými a virtuálnymi zariadeniami**
5. **Health check s virtuálnymi zariadeniami**

### Acceptance Criteria
- [ ] Všetky test cases prechádzajú
- [ ] Žiadne console errors v DEV mode
- [ ] Hra správne identifikuje obe ruky

### Environment
- macOS/Linux/Windows
- Chrome/Firefox
- S a bez fyzických zariadení

---

## Bug Root Cause Summary

### Problem 1: RehapianoTiles sa nespustilo s virtual hands
**Root cause:** `identifier` WebSocket správa neobsahovala `hand` pole, takže `_determineHand(undefined)` vrátil "left" pre obe ruky. `getConnectedHands()` potom vrátil `{left: true, right: false}`.

### Problem 2: Port 5555 špecifický problém
**Possible causes:**
1. Browser cache pre localhost:5555
2. TCP TIME_WAIT po Docker container stop
3. Staré statické súbory v browser cache

**Recommendation:** Hard refresh (Ctrl+Shift+R) alebo počkať 60s po zastavení Docker kontajnera.

---

## Implementation Status

| Task | Status | PR/MR |
|------|--------|-------|
| Task 1: Streamer identifier | Done | - |
| Task 2: Streamer device_added | Done | - |
| Task 3: Games streamer.js | Done | - |
| Task 4: Main-app streamer.py | Done | - |
| Task 5: Documentation | Done | - |
| Task 6: Integration testing | Pending | - |

---

## Related Issues
- Original bug report: Virtual mode testing feedback
- Feature branch: `feature/virtual-mode`
