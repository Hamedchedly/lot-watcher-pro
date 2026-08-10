FROM node:22-alpine AS build
WORKDIR /app

# Dépendances (npm, lockfile package-lock.json)
COPY package.json package-lock.json ./
RUN npm ci

# Sources + build Vite (SSR TanStack Start -> dist/)
# Railway n'injecte les variables dans un build Dockerfile QUE si elles sont
# déclarées via ARG. Sans elles au moment du build, Vite ne peut pas inliner
# VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY dans le bundle client.
# Uniquement ces deux variables (publiques) sont exposées au build ; les
# variables SUPABASE_* / EXT_* restent exclusivement au runtime.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

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
