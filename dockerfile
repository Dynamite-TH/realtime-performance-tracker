FROM node:20-alpine

WORKDIR /app


COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev


COPY server/ ./

EXPOSE 3030
CMD ["node", "server.js"]