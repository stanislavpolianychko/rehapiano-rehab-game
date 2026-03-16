# Balance Trainer - RehaPiano Rehabilitation Game
#
# A bilateral coordination game where patients balance
# force between left and right hands.
#
# Build:
#   docker build -t balance-trainer:1.0.0 .
#
# Run:
#   docker run -p 8080:80 balance-trainer:1.0.0
#
# With custom parameters:
#   Open http://localhost:8080?countdown=5&duration=90&threshold=10

FROM nginx:alpine

# Metadata
LABEL maintainer="KKUI TUKE <rehapiano@tuke.sk>"
LABEL version="1.0.0"
LABEL description="RehaPiano Balance Trainer - Bilateral Coordination Game"
LABEL org.opencontainers.image.source="https://git.rehapiano.com/rehapiano/games/tuke-cit-app-devs-test/balance-trainer"

# Copy game files
COPY index.html /usr/share/nginx/html/
COPY game-config.yaml /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create health check file and fix permissions
RUN echo "OK" > /usr/share/nginx/html/health.txt && \
    chmod 644 /usr/share/nginx/html/*

# Expose port
EXPOSE 80

# Health check for Docker orchestration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
