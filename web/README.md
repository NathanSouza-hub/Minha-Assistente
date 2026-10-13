# Minha Assistente — PWA

Front-end do Minha Assistente, secretária pessoal multiusuário. Instalável no iPhone, Android e
computador. O back-end fica na raiz deste repositório (contrato em `../docs/arquitetura.md`).

## Rodando

```bash
npm install
cp .env.example .env.local   # VITE_API_MOCK=true usa a API falsa (MSW)
npm run dev                  # http://localhost:5173
```

Para usar o back-end real: suba-o na raiz do repositório (`npm run dev`, porta 3000) e coloque
`VITE_API_MOCK=false` no `.env.local`.

| Comando | O que faz |
|---|---|
| `npm test` | testes (Vitest) |
| `npm run build` | checa os tipos e gera `dist/` com o service worker |
| `npm run lint` | oxlint |
| `npx pwa-assets-generator --override` | regenera os ícones a partir de `public/favicon.svg` |
