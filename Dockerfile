# Standalone container image for the Image → PDF tool.
# Debian-slim (glibc) so sharp's prebuilt Linux binary loads cleanly;
# heic-convert is pure JS + WASM, so no extra system packages are needed.
FROM node:22-slim

WORKDIR /app

# Install only production dependencies first (better build caching).
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the application source.
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
