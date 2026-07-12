# ---- Base ----
FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- Production Runner ----
FROM node:20-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/data ./dist/data
# tsc does not emit non-TS assets; seed.js reads these from dist/db at runtime
COPY --from=builder /app/src/db/*.sql ./dist/db/
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 8000

CMD ["node", "./dist/index.js"]
