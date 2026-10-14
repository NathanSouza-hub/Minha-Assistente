# Front (PWA) servido pelo Caddy, que também faz o HTTPS e repassa /api para a API.
# Usada por docker-compose.prod.yml; a configuração do Caddy é deploy/Caddyfile.
FROM node:22-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# A API fica no mesmo domínio, em /api: sem CORS e com um certificado só.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /web/dist /srv
