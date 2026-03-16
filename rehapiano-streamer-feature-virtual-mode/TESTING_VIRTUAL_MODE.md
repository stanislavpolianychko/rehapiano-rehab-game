# Feature: Virtual Mode pre vývoj bez fyzického hardvéru

## Čo sa zmenilo

Pridaný **Virtual Mode** do RehaPiano Streamer, ktorý umožňuje simulovať dve virtuálne ruky pomocou klávesnice:

**Nové súbory:**
- `rehapiano/io/virtual_device.py` - simulácia virtuálnych zariadení

**Upravené súbory:**
- `rehapiano/app/main.py` - integrácia VirtualDeviceManager
- `rehapiano/app/server.py` - API endpointy `/api/virtual/*`
- `rehapiano/app/static/index.html` - UI toggle tlačidlo
- `rehapiano/app/static/app.js` - keyboard handling
- `rehapiano/app/static/app.css` - štýly pre virtual mode
- `README.md` - dokumentácia

**Klávesové mapovanie:**

| Ruka | Klávesy | Prsty |
|------|---------|-------|
| Ľavá | Q W E R T | malíček → palec |
| Pravá | Y U I O P | malíček → palec |

**Virtuálne zariadenia:**
- `/virtual/left` - UID `2000001`, FW `231`
- `/virtual/right` - UID `2000002`, FW `231`

---

## Čo treba otestovať

### 1. Základná funkčnosť Virtual Mode

- [ ] Spustiť streamer: `./venv/bin/python -m rehapiano.app.main --http-port 5555`
- [ ] Otvoriť http://localhost:5555
- [ ] Kliknúť na "Virtual OFF" → zmení sa na "Virtual ON"
- [ ] Overiť že sa objavia 2 virtuálne zariadenia v zozname
- [ ] Stlačiť klávesy QWERT/YUIOP a sledovať ADC grafy
- [ ] Overiť attack/sustain/release fázy pri stlačení/držaní/pustení

### 2. Prepínanie medzi fyzickými a virtuálnymi zariadeniami

- [ ] Pripojiť fyzické ruky (USB)
- [ ] Overiť že fyzické zariadenia fungujú normálne
- [ ] Zapnúť Virtual Mode
- [ ] Overiť že virtuálne zariadenia sa pridajú k fyzickým (nie nahradia)
- [ ] Prepnúť aktívne zariadenie medzi fyzickým a virtuálnym
- [ ] Vypnúť Virtual Mode
- [ ] Overiť že virtuálne zariadenia zmiznú a fyzické ostanú

### 3. Kompatibilita s RehaPiano Tiles

- [ ] Spustiť RehaPiano Tiles hru
- [ ] Zapnúť Virtual Mode v streameri
- [ ] Overiť že hra prijíma dáta z virtuálnych zariadení
- [ ] Hrať hru pomocou klávesnice (QWERT alebo YUIOP)
- [ ] Overiť že hra správne rozpoznáva stlačenia prstov
- [ ] Overiť že hra reaguje na intenzitu stlačenia (nie len binárne)

### 4. API testovanie

```bash
# Stav
curl http://localhost:5555/api/virtual

# Zapnúť
curl -X POST http://localhost:5555/api/virtual/enable

# Simulovať stlačenie
curl -X POST http://localhost:5555/api/virtual/key \
  -H "Content-Type: application/json" \
  -d '{"key":"q","action":"down"}'

# Simulovať pustenie
curl -X POST http://localhost:5555/api/virtual/key \
  -H "Content-Type: application/json" \
  -d '{"key":"q","action":"up"}'

# Vypnúť
curl -X POST http://localhost:5555/api/virtual/disable
```

### 5. Edge cases

- [ ] Prepnúť tab/okno počas stlačenej klávesy → klávesy sa majú uvoľniť
- [ ] Rýchle prepínanie Virtual Mode ON/OFF
- [ ] Virtual Mode + Recording API (ws-recording)
- [ ] Haptic feedback na virtuálne zariadenie (má ignorovať/logovat)

---

## Branch

`feature/virtual-mode`

## Súvisiace commity

- `1ac530f` feat: Add virtual mode for keyboard-based hand simulation
- `abdeba7` docs: Add Virtual Mode documentation to README

## Merge Request

https://git.rehapiano.com/rehapiano/device/rehapiano-streamer/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature%2Fvirtual-mode
