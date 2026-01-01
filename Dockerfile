# ---------- Build Stage ----------
FROM node:20-bullseye-slim AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy semua source code
COPY . .

# Build React app
RUN npm run build

# ---------- Production Stage ----------
FROM node:20-bullseye-slim

WORKDIR /app

# Pasang serve untuk host SPA
RUN npm install -g serve

# Copy hasil build sahaja
COPY --from=build /app/dist ./dist

# Expose port (default 8080, bisa diubah via PORT env var)
EXPOSE 8080

# Use PORT environment variable if provided, otherwise default to 8080
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
