# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the source code
COPY shared shared/
COPY backend backend/

# Generate Prisma Client
WORKDIR /app/backend
RUN npx prisma generate

# Build shared first
WORKDIR /app
RUN npm run build:shared

# Build backend
WORKDIR /app/backend
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine

# Install openssl for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy production package configs
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled code from builder
COPY --from=builder /app/shared/dist shared/dist
COPY --from=builder /app/backend/dist backend/dist
COPY --from=builder /app/backend/prisma backend/prisma

# Generate Prisma Client for the production environment
WORKDIR /app/backend
RUN npx prisma generate

EXPOSE 3005

CMD ["npm", "run", "start:prod"]
