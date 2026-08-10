FROM node:22-alpine AS build

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . ./
RUN NITRO_PRESET=node-server pnpm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./

EXPOSE 3000
ENV PORT=3000
CMD ["node", ".output/server/index.mjs"]
