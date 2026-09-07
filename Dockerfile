# ==============================================================================
# Multi-stage Dockerfile for Rapkumer
# Optimized for SvelteKit (adapter-node) + Chromium Puppeteer (PagedJS PDF)
# ==============================================================================

# --- Stage 1: Build & Dependencies ---
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Enable pnpm v9 (matches pnpm-lock.yaml lockfileVersion 9.0)
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Install dependencies (utilizing layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

# Build application (generates build/ directory)
RUN pnpm build

# Prune devDependencies to keep image lean
RUN pnpm prune --prod

# --- Stage 2: Production Runtime ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install runtime dependencies for Chromium & PDF generation + dumb-init process supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    fonts-noto-color-emoji \
    dumb-init \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    BODY_SIZE_LIMIT=50M \
    ADDRESS_HEADER=x-forwarded-for \
    XFF_DEPTH=1 \
    HOST_HEADER=x-forwarded-host \
    PROTOCOL_HEADER=x-forwarded-proto

# Create non-root user and persistent directories
RUN groupadd -r rapkumer && useradd -r -g rapkumer -m rapkumer \
    && mkdir -p /app/data /app/data/uploads /app/data/sounds /app/data/ttd \
    && chown -R rapkumer:rapkumer /app

# Copy production artifacts from builder
COPY --from=builder --chown=rapkumer:rapkumer /app/package.json ./
COPY --from=builder --chown=rapkumer:rapkumer /app/node_modules ./node_modules
COPY --from=builder --chown=rapkumer:rapkumer /app/build ./build
COPY --from=builder --chown=rapkumer:rapkumer /app/scripts ./scripts

# Switch to non-root user
USER rapkumer

# Expose web server port
EXPOSE 3000

# Volume for data persistence (uploads, database, signatures, sounds)
VOLUME ["/app/data"]

# Start with dumb-init for proper signal handling (SIGTERM, SIGINT)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build/index.js"]
