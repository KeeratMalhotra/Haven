FROM node:22-slim AS base

WORKDIR /app

# Install dependencies using npm (more reliable in CI than pnpm frozen-lockfile)
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy application code
COPY . .

# Build arguments for Next.js public env vars (baked in at build time)
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Build the Next.js application
RUN npm run build

# Production stage
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/public ./public

# Cloud Run provides PORT (default 8080). Next.js "start" respects the PORT env var.
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
