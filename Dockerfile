# Imagem da API (produção). Usada por docker-compose.prod.yml; guia em docs/deploy.md.
FROM node:22-alpine

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo
RUN apk add --no-cache tzdata

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY knexfile.js ./
COPY db ./db
COPY src ./src

# Anexos de viagem: o compose monta um volume aqui (precisa ser do usuário node).
RUN mkdir -p uploads && chown node:node uploads
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/saude').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Migrations e seed (idempotente) a cada subida; depois a API, que também roda o agendador.
CMD ["sh", "-c", "node_modules/.bin/knex migrate:latest && node_modules/.bin/knex seed:run && exec node src/server.js"]
