# ─────────────────────────────────────────────────────────────────────────────
# 1) Build/runtime base
#    Použijeme oficiálny Python 3.11 slim (Debian), ktorý má dobrý kompromis
#    medzi veľkosťou a kompatibilitou (žiadne alpine musl/serial problémy).
# ─────────────────────────────────────────────────────────────────────────────
FROM harbor.rehapiano.com/proxy-dockerhub/library/python:3.11-slim AS runtime

# Nastavenie pracovného adresára
WORKDIR /app

# Deb balíčky: pre bežný beh nič špeciálne netreba (žiadne build-essential).
# Ak by si mal natívne moduly, sem pridaj: gcc, libusb, atď.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────────────────────
# 2) Inštalácia Python závislostí (maximalizácia cache)
# ─────────────────────────────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─────────────────────────────────────────────────────────────────────────────
# 3) Skopíruj zdrojový kód do kontajnera
#    Predpokladáme štruktúru, kde je package `rehapiano/` v root-e repa.
#    Ak používaš `static/` a `templates/`, skopíruj aj tie.
# ─────────────────────────────────────────────────────────────────────────────
COPY . .

# ─────────────────────────────────────────────────────────────────────────────
# 4) Non-root user pre bezpečnosť
# ─────────────────────────────────────────────────────────────────────────────
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# ─────────────────────────────────────────────────────────────────────────────
# 5) Runtime nastavenia
# ─────────────────────────────────────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1
# Exponujeme HTTP port (app default: 5555)
EXPOSE 5555

# # Healthcheck (očakávaš /health endpoint vo FastAPI; ak nemáš, vypusť alebo uprav)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
# CMD python - <<'PY' || exit 1
# import sys, urllib.request
# try:
#     with urllib.request.urlopen("http://127.0.0.1:5555/health", timeout=2) as r:
#         sys.exit(0 if r.status == 200 else 1)
# except Exception:
#     sys.exit(1)
# PY

# ─────────────────────────────────────────────────────────────────────────────
# 6) Entrypoint
#    Spúšťame cez modul tak, ako si zvyknutý: python -m rehapiano.app.main
# ─────────────────────────────────────────────────────────────────────────────
CMD ["python", "-m", "rehapiano.app.main", "--http-host", "0.0.0.0", "--http-port", "5555"]