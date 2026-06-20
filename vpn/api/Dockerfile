FROM node:22-alpine

WORKDIR /app

# Install deps first (layer caches unless package.json changes)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

EXPOSE 4000
CMD ["node", "src/server.js"]