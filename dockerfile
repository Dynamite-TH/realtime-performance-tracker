FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

WORKDIR /app
COPY server/ ./server/
COPY client/ ./client/

ENV NODE_ENV=production
EXPOSE 3030
CMD ["node", "server/server.js"]