FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build arg for the API URL (baked into the bundle)
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

# Build the Expo web bundle
RUN npx expo export --platform web --output-dir dist

# --- Production stage: serve static files with nginx ---
FROM nginx:alpine

# Copy the built bundle
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback config
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
