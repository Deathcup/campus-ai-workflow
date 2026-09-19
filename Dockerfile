FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/agent-runtime/package.json packages/agent-runtime/package.json
COPY packages/skill-registry/package.json packages/skill-registry/package.json
RUN npm install
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4100 DATA_DIR=/app/data CAPABILITIES_DIR=/app/capabilities
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/capabilities ./capabilities
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 4100
CMD ["node", "apps/server/dist/index.js"]
