FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend ./
COPY contracts /app/contracts
RUN cd /tmp && npm exec --yes --package=typescript@5.9.3 --package=openapi-typescript@7.13.0 -- openapi-typescript /app/contracts/openapi.yaml -o /app/frontend/src/features/banking/api/schema.d.ts
RUN npm run test:api && npm run lint && npm run build
FROM nginx:1.28-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
