# Balance Trainer

Rehabilitačná hra pre RehaPiano zameraná na **bilaterálnu koordináciu** - pacient balancuje silu stláčania medzi ľavou a pravou rukou.

## Herný princíp

1. **Inštrukcie** - Pacient vidí vysvetlenie hry
2. **Odpočet** - Konfigurovateľný odpočet (default 3s)
3. **Hra** - Vizuálna váha ukazuje rozdiel síl medzi rukami
4. **Výsledky** - Skóre, čas v rovnováhe, štatistiky
5. **Ukončenie** - Tlačidlo "Ukončiť" zastaví kontajner a zatvorí okno

## Vizualizácia

- **Váha/Beam** - Nakláňa sa podľa rozdielu síl
- **Force bary** - Výška ukazuje silu každej ruky
- **Indikátor** - Zelený = vyvážené, Oranžový = nevyvážené
- **Skóre** - Body za čas strávený v rovnováhe

## Spustenie

### Lokálne (bez Dockera)

```bash
# Otvorte index.html v prehliadači
# alebo použite lokálny server:
python3 -m http.server 8080
# Otvorte http://localhost:8080
```

### Docker

```bash
# Build
cd games/balance-trainer
docker build -t balance-trainer:1.0.0 .

# Run (manuálne)
docker run -p 8080:80 balance-trainer:1.0.0

# Otvorte http://localhost:8080
```

### Spustenie cez Main App

Main App automaticky:
1. **Pridelí port** - Dynamicky z rozsahu 9000-9099
2. **Namapuje volume** - `/app/watched_folder` pre ukladanie dát
3. **Nastaví environment** - STREAMER_URL, HAND, HOST_PORT, atď.
4. **Otvorí prehliadač** - Nová karta s hrou (pre web hry)

```bash
# Hra beží interne na porte 80
# Main App ju namapuje na napr. http://localhost:9001
# Main App automaticky otvorí prehliadač s URL hry

# Environment variables od Main App:
# - GAME_ID: Unikátny identifikátor hry
# - STREAMER_URL: WebSocket URL (ws://host:5555/ws)
# - STREAMER_HTTP: HTTP URL (http://host:5555)
# - HAND: Postihnutá ruka (left/right)
# - HOST_PORT: Pridelený port na hostovi (9000-9099)
# - PLAYER_NUMBER: Poradie hráča
```

## Typy hier a zobrazenie

### Web hry (tento typ)

- Bežia v Docker kontajneri s nginx na porte 80
- Main App mapuje na dynamický port (9000-9099)
- **Main App otvorí novú kartu** prehliadača s hrou
- Po ukončení hry sa karta môže zavrieť (alebo zobraziť výsledky)

```
Main App → Spustí kontajner → Otvorí http://localhost:9001 v prehliadači
```

### Native hry (pygame, SDL, atď.)

- Bežia v Docker kontajneri s prístupom k X display
- **Hra sama otvorí okno** cez pygame/SDL
- Potrebujú volume mount pre `/tmp/.X11-unix` a `DISPLAY` env

```dockerfile
# Dockerfile pre native hru
ENV DISPLAY=:0
VOLUME /tmp/.X11-unix
```

```python
# Python/pygame hra
import pygame
pygame.init()
screen = pygame.display.set_mode((1920, 1080), pygame.FULLSCREEN)
```

## URL Parametre

| Parameter | Typ | Default | Popis |
|-----------|-----|---------|-------|
| `player_number` | int | `1` | Číslo hráča |
| `game_id` | string | `balance-trainer` | ID hry pre API volania |
| `countdown` | int | `3` | Dĺžka odpočtu v sekundách |
| `duration` | int | `60` | Dĺžka hry v sekundách |
| `threshold` | float | `500` | Tolerancia pre "vyvážený" stav (absolútny rozdiel) |
| `finger` | int | `3` | Index prsta (0=malíček, 1=prsteník, 2=prostredník, 3=ukazovák, 4=palec) |
| `debug` | bool | `true` | Zobraziť debug panel |

### Hardcoded služby (konvencia)

Hra používa tieto **pevné adresy** - netreba ich posielať ako parametre:

| Služba | URL |
|--------|-----|
| Streamer WebSocket | `ws://localhost:5555/ws` |
| Streamer HTTP | `http://localhost:5555` |
| Game Data API | `http://localhost:8081/api/game-data/{game_id}` |

### Príklady

```bash
# Krátka hra (30s) s dlhším odpočtom
http://localhost:8080?countdown=5&duration=30

# Prísnejšie kritériá pre rovnováhu
http://localhost:8080?threshold=10
```

## Integrácia so Streamerom

### WebSocket

Hra sa pripája na `ws://localhost:5555/ws` a spracováva:

- `device_added` - Zariadenie pripojené
- `identifier` - Identifikácia ruky (left/right)
- `sample` - Senzorové dáta (100 Hz)

### HTTP API

- `POST /api/ws-recording/start` - Začne nahrávanie
- `POST /api/ws-recording/stop` - Ukončí nahrávanie

## Výstupy

### Výsledky hry

Hra automaticky odosiela výsledky do Game Data API (ak je nakonfigurovaná):

```json
{
  "session_id": "rec_abc123",
  "player_number": 1,
  "final_score": 4250,
  "balance_time_seconds": 42.5,
  "average_deviation": 12.3,
  "max_force_left": 78.5,
  "max_force_right": 82.3,
  "sample_count": 6000,
  "actual_duration_seconds": 60.2,
  "recording_id": "rec_abc123",
  "finger_used": "UKAZOVÁK",
  "finger_index": 3,
  "balance_threshold": 500,
  "game_duration_config": 60
}
```

### Nahrávka

NDJSON súbor so všetkými senzorovými dátami (`.jsonl.gz`).

## Game Data API

Hra podporuje automatické ukladanie výsledkov cez Game Data API poskytované main-app.

### Architektúra

Main-app beží dva servery:
- **Port 8080**: Flet UI (hlavná aplikácia)
- **Port 8081**: Game Data API (FastAPI server pre hry)

Keďže hra beží v prehliadači na klientovi (nie v Docker kontajneri), pristupuje k API cez `localhost:8081`.

### Endpoint

**POST** `http://localhost:8081/api/game-data/balance-trainer`

Hra odošle JSON s výsledkami na konci hry. Main-app uloží dáta do:
```
watched_folder/apps/balance-trainer/{timestamp}_{session_id}.json
```

### Pre vývojárov hier

**Game Data API je vždy dostupné na `http://localhost:8081/api/game-data/{game_id}`**

Tento endpoint môžete hardcodeovať vo vašej hre. Alternatívne môžete použiť URL parameter `game_data_api_url` ak je poskytnutý.

### Príklad uložených dát

```json
{
  "metadata": {
    "game_id": "balance-trainer",
    "device_id": "maros-macm1pro",
    "timestamp": "2026-01-11T10:30:00.123456",
    "session_id": "rec_abc123",
    "player_number": 1
  },
  "data": {
    "final_score": 4250,
    "balance_time_seconds": 42.5,
    "average_deviation": 12.3,
    "max_force_left": 78.5,
    "max_force_right": 82.3,
    "sample_count": 6000,
    "actual_duration_seconds": 60.2,
    "recording_id": "rec_abc123",
    "finger_used": "UKAZOVÁK",
    "finger_index": 3,
    "balance_threshold": 500,
    "game_duration_config": 60
  }
}
```

### Synchronizácia

Uložené súbory automaticky synchronizuje `rehapiano-data-sync` služba do MinIO cloudu.

### Integrácia so Streamerom

Streamer poskytuje recording API pre raw senzorové dáta:

```javascript
// Začať nahrávanie pred hrou
POST /api/ws-recording/start
{
    "duration_s": 120,
    "compress": true,
    "notes": "Balance Trainer - Session XYZ"
}

// Ukončiť nahrávanie po hre
POST /api/ws-recording/stop
```

Nahrávky streamera sa ukladajú do jeho watched folder a synchronizujú automaticky.

## Ukončenie hry (Exit Button)

Po zobrazení výsledkov má hra tlačidlo **"Ukončiť"** ktoré:
1. Zastaví Docker kontajner hry
2. Zatvorí okno prehliadača

### Ako to funguje

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXIT BUTTON FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Používateľ klikne "Ukončiť"                                 │
│                    │                                             │
│                    ▼                                             │
│  2. Tlačidlo sa zmení na "Ukončujem..."                         │
│                    │                                             │
│                    ▼                                             │
│  3. Hra volá Stop Game API                                      │
│     POST http://localhost:8081/api/stop-game/{game_id}          │
│                    │                                             │
│                    ▼                                             │
│  4. Main App zastaví Docker kontajner                           │
│                    │                                             │
│                    ▼                                             │
│  5. Hra volá window.close()                                     │
│     - Funguje lebo okno bolo otvorené cez window.open()         │
│                    │                                             │
│                    ▼                                             │
│  6. Okno sa zatvorí                                             │
│     (alebo zobrazí "Môžete zavrieť kartu" ak sa nepodarilo)     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Stop Game API

**Endpoint:** `POST http://localhost:8081/api/stop-game/{game_id}`

| Parameter | Typ | Popis |
|-----------|-----|-------|
| `game_id` | string | ID hry z URL parametra |

**Response:**
```json
{
  "status": "ok",
  "game_id": "balance-trainer",
  "message": "Game balance-trainer stopped successfully"
}
```

### Implementácia v hre

```javascript
async function exitGame() {
    // Získať game_id z URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('game_id') || 'balance-trainer';

    // Disable button
    exitBtn.disabled = true;
    exitBtn.textContent = 'Ukončujem...';

    // 1. Zastaviť Docker kontajner
    try {
        await fetch(`http://localhost:8081/api/stop-game/${gameId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('Failed to stop game:', e);
    }

    // 2. Zatvoriť okno prehliadača
    window.close();

    // 3. Fallback ak sa nepodarilo zatvoriť
    setTimeout(() => {
        if (!window.closed) {
            exitBtn.textContent = 'Môžete zavrieť kartu';
            exitBtn.disabled = false;
        }
    }, 300);
}
```

### Prečo window.close() funguje?

Prehliadače z bezpečnostných dôvodov neumožňujú zatváranie okien pomocou JavaScript **okrem** prípadov keď bolo okno otvorené skriptom (`window.open()`).

Main App používa **Game Launcher** stránku ktorá otvorí hru cez `window.open()`:

```
Main App
    │
    ▼
Game Launcher (http://localhost:8081/game-launcher?url=...)
    │
    ├─ Čaká na dostupnosť hry
    │
    ▼
window.open(gameUrl, '_blank')  ← Toto umožní window.close()
    │
    ▼
Hra beží v novom okne
    │
    ▼
window.close()  ← Funguje!
```

Ak by hra bola otvorená iným spôsobom (napr. priamym odkazom), `window.close()` by nefungovalo a zobrazí sa fallback správa "Môžete zavrieť kartu".

## Požiadavky

- **Firmware**: 2.31+
- **Ruky**: Minimálne 1 (ideálne obe)
- **Rozlíšenie**: 1024x768+
- **Prehliadač**: Chrome, Firefox, Safari, Edge

## Prístupnosť

- ✅ Vysoký kontrast
- ✅ Veľké dotykové ciele (48px+)
- ✅ Farebne bezpečné pre colorblind
- ✅ Responzívny dizajn

## Vývoj

```bash
# Lokálny development
cd games/balance-trainer
python3 -m http.server 8080

# Watch for changes (optional, requires fswatch)
fswatch -o . | xargs -n1 -I{} echo "File changed"
```

## Licencia

Copyright 2024 KKUI TUKE. Všetky práva vyhradené.
