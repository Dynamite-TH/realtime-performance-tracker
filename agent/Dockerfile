FROM node:20-alpine

WORKDIR /agent

# If agent has package.json in future, install deps; agent currently uses builtins
#COPY agent/package*.json ./
#RUN npm ci --omit=dev

COPY agent/ .

ENV NODE_ENV=production
# agent will post to app via internal Docker hostname "app"
ENV API_URL=http://app:3030/api/metrics

CMD ["node", "agent.js"]
