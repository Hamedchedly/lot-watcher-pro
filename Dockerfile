FROM node:22-alpine AS build
WORKDIR /app

# Dépendances (npm, lockfile package-lock.json)
COPY package.json package-lock.json ./
RUN npm ci

# Sources + build Vite (SSR TanStack Start -> dist/)
COPY . .
RUN npm run build

# Image runtime
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Dépendances de production uniquement (le bundle SSR en a besoin)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Build SSR + serveur d'entrée
COPY --from=build /app/dist ./dist
COPY server.js ./server.js

EXPOSE 3000
CMD ["node", "server.js"]
