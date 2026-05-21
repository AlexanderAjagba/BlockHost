FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
RUN npm install
RUN npm install -g firebase-tools

COPY . .

EXPOSE 5173

CMD ["sh", "-c", "npm install && npm run dev"]
