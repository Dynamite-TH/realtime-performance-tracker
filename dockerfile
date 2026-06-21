FROM node:20-alpine

WORKDIR /app

# Install dependencies from the project root package.json
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY server/ ./server/
COPY client/ ./client/

ENV NODE_ENV=production
EXPOSE 3030
CMD ["node", "server/server.js"]