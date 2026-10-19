# Deploy no VPS (Hostinger KVM 1)

Tudo roda no próprio servidor, com Docker Compose (`docker-compose.prod.yml`):

```
Internet ──443──▶ Caddy (container "web")
                   ├── /        → front (PWA), arquivos do build
                   └── /api/*   → API (container "api", porta 3000, sem acesso de fora)
                                   └── Postgres (container "postgres", sem acesso de fora)
```

- **HTTPS automático**: o Caddy tira e renova o certificado sozinho (Let's Encrypt).
- **Um domínio só**: o front chama a API em `/api`, então não há CORS para configurar.
- **Migrations automáticas**: a API aplica as migrations toda vez que sobe.
- **Lembretes**: o agendador roda dentro da API. Mantenha **um** container `api` só.
- **Dados** ficam em volumes do Docker: `postgres-dados` (banco), `anexos` (arquivos das viagens)
  e `caddy-dados` (certificados). Recriar os containers não apaga nada; `down -v` apaga.

O KVM 1 (1 vCPU, 4 GB) sobra para este app: em uso normal ele fica em 300–500 MB de RAM.

---

## 1. Preparar o servidor (uma vez)

Pegue o IP e a senha de root no hPanel: **VPS → Visão geral → Acesso SSH**. No computador:

```bash
ssh root@IP_DO_SERVIDOR
```

**O servidor já tem outra coisa?** Veja se as portas 80 e 443 estão livres — o Caddy precisa delas:

```bash
ss -ltnp | grep -E ':(80|443)\s'   # sem saída = livres
```

Se as portas estiverem ocupadas, há outro site no servidor: veja **"Servidor com proxy
compartilhado"** no fim deste guia antes de seguir.

Atualize e instale o Docker (pule a instalação se você escolheu o modelo "Ubuntu com Docker"):

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
docker compose version   # deve mostrar v2.x
```

Firewall: deixe passar só SSH, HTTP e HTTPS.

```bash
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
ufw --force enable
```

No hPanel, se o **Firewall** do VPS estiver ligado, libere também as portas 80 e 443 (TCP) lá.

## 2. Baixar o código

O repositório é privado. Crie uma chave só para o servidor ler o repositório (deploy key):

```bash
ssh-keygen -t ed25519 -C "vps-minha-assistente" -f ~/.ssh/github_minha_assistente -N ""
cat ~/.ssh/github_minha_assistente.pub
```

No GitHub: **repositório → Settings → Deploy keys → Add deploy key**. Cole a chave, deixe
**"Allow write access" desmarcado** e salve. De volta no servidor:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_minha_assistente
EOF
git clone git@github.com:NathanSouza-hub/Minha-Assistente.git /opt/minha-assistente
cd /opt/minha-assistente
```

## 3. Configurar o `.env`

```bash
cp .env.producao.example .env
nano .env
```

Preencha cada linha (gere os valores com os comandos abaixo e cole):

| Variável | Como preencher |
|---|---|
| `DOMINIO` | Sem domínio ainda: o IP com traços + `.sslip.io` (IP `203.0.113.10` → `203-0-113-10.sslip.io`) |
| `EMAIL_CERTIFICADO` | Seu e-mail (o Let's Encrypt avisa se o certificado tiver problema) |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` | `docker run --rm node:22-alpine npx -y web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:` + seu e-mail |

**Guarde uma cópia do `.env` num lugar seguro** (gerenciador de senhas). Sem ele não dá para
ler os backups com as mesmas chaves, e:
- trocar as chaves **VAPID** desliga as notificações de todos os aparelhos (cada um precisa ativar de novo);
- trocar o **JWT_SECRET** desconecta todo mundo (precisam entrar de novo).

## 4. Subir

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps      # os três "running"; api "healthy"
docker compose -f docker-compose.prod.yml logs -f  # Ctrl+C para sair
```

A primeira vez demora alguns minutos (build das imagens). Confira:

- `https://SEU_DOMINIO/api/saude` → `{"status":"ok","banco":"ok"}`
- `https://SEU_DOMINIO` → tela de entrar. Crie sua conta.
- No celular, abra o endereço, instale (Android: menu → **Instalar app**; iPhone: Safari →
  **Compartilhar → Adicionar à Tela de Início**) e em **Mais → Notificações** toque em
  **Ativar** e depois em **Enviar notificação de teste**.

Se o certificado não sair (veja `logs web`): com `sslip.io`, o Let's Encrypt às vezes limita
pedidos, porque o domínio é compartilhado por muita gente; o Caddy tenta de novo e também tenta
outro emissor (ZeroSSL). O definitivo é um domínio próprio (item 7).

## 5. Atualizar para uma versão nova

**Automático**: todo push na `main` roda os testes da API e do front (`.github/workflows/ci.yml`)
e, se passarem, publica no servidor: o workflow manda o código (`git archive`) por SSH para
`deploy/atualizar.sh`, que faz backup, troca os arquivos de `/opt/minha-assistente` (mantém `.env`
e `uploads`), reconstrói os containers e espera ficarem saudáveis. Dá para disparar à mão em
*Actions → CI e deploy → Run workflow*.

Configuração (uma vez):

```bash
# no seu computador: chave só para o deploy, sem senha
ssh-keygen -t ed25519 -N "" -C github-actions-minha-assistente -f deploy-github

# no servidor (usuário deploy): a chave só pode rodar o script de atualização
echo "restrict,command=\"/opt/minha-assistente/deploy/atualizar.sh\" $(cat deploy-github.pub)" \
  | ssh deploy@IP_DO_SERVIDOR 'cat >> ~/.ssh/authorized_keys'

# secrets do repositório (precisa ser admin do repo)
gh secret set VPS_HOST --body IP_DO_SERVIDOR
gh secret set VPS_SSH_KEY < deploy-github
ssh-keyscan -t ed25519 IP_DO_SERVIDOR | gh secret set VPS_KNOWN_HOSTS
rm deploy-github deploy-github.pub
```

**Manual** (do seu computador, mesma coisa que o workflow faz):

```bash
git archive HEAD | ssh deploy@IP_DO_SERVIDOR \
  "/opt/minha-assistente/deploy/atualizar.sh $(git rev-parse --short HEAD)"
```

As migrations novas rodam sozinhas quando a API sobe. Os aparelhos recebem o app novo na
próxima vez que abrirem (o service worker se atualiza sozinho).

### Criar a conta de alguém

O cadastro pelo app fica fechado em produção (`CADASTRO_ABERTO=false`). Para criar uma conta,
rode no servidor e passe a senha temporária à pessoa (ela troca depois em Mais → Trocar senha):

```bash
cd /opt/minha-assistente
docker compose exec api node src/cli/criar-conta.js email@da.pessoa "Nome da Pessoa"
```

Para reabrir o cadastro pelo app, ponha `CADASTRO_ABERTO=true` no `.env` e rode
`docker compose up -d api`.

### Alguém esqueceu a senha

Enquanto não há redefinição por e-mail, gere uma senha temporária no servidor e passe à pessoa
(ela troca depois em Mais → Trocar senha). Todas as sessões dela são encerradas:

```bash
cd /opt/minha-assistente
docker compose exec api node src/cli/redefinir-senha.js email@da.pessoa
```

## 6. Backups

`deploy/backup.sh` salva o banco (`pg_dump`) e os anexos em `/var/backups/minha-assistente` e
apaga os com mais de 14 dias. Agende todo dia às 3h:

```bash
crontab -e
# acrescente a linha:
0 3 * * * /opt/minha-assistente/deploy/backup.sh >> /var/log/minha-assistente-backup.log 2>&1
```

Teste agora com `./deploy/backup.sh`. **Backup no mesmo servidor não protege se o servidor
sumir**: ative também os backups/snapshots do VPS no hPanel e, de vez em quando, copie a pasta
para o seu computador:

```bash
# no seu computador
scp -r root@IP_DO_SERVIDOR:/var/backups/minha-assistente ./backups-minha-assistente
```

**Restaurar** (troque as datas pelos arquivos que quer usar):

```bash
cd /opt/minha-assistente
C="docker compose -f docker-compose.prod.yml"
$C stop api web
$C exec -T postgres pg_restore -U minha_assistente -d minha_assistente --clean --if-exists \
  < /var/backups/minha-assistente/banco_AAAA-MM-DD_HHMM.dump
$C run --rm --no-deps -T api sh -c 'tar -xzf - -C /app' \
  < /var/backups/minha-assistente/anexos_AAAA-MM-DD_HHMM.tar.gz
$C up -d
```

## 7. Quando tiver um domínio

1. No painel do domínio (Hostinger, Registro.br...), crie um registro **A** com o nome que
   quiser (ex.: `assistente`) apontando para o **IP do servidor**.
2. Espere propagar: `ping assistente.seudominio.com.br` deve responder com o IP do servidor.
3. No servidor, troque `DOMINIO` no `.env` e aplique:

```bash
docker compose -f docker-compose.prod.yml up -d web
```

O Caddy tira o certificado do domínio novo. O endereço muda, então nos aparelhos é preciso
abrir o novo endereço, instalar de novo e reativar as notificações.

## 8. Comandos úteis

```bash
C="docker compose -f docker-compose.prod.yml"
$C ps                         # situação dos containers
$C logs -f api                # logs da API (erros de lembretes aparecem com [lembretes])
$C restart api                # reinicia a API
$C exec postgres psql -U minha_assistente minha_assistente   # SQL direto no banco
docker stats --no-stream      # uso de memória e CPU
```

A documentação da API (Swagger) fica em `https://SEU_DOMINIO/api/docs`.

## Servidor com proxy compartilhado

Quando outro Caddy já ocupa as portas 80/443 e atende vários sistemas por uma rede Docker
externa chamada `proxy` (é o caso do VPS atual: `/opt/proxy`), o container `web` deste app não
publica portas nem tira certificado. Ele atende só HTTP na rede `proxy`, com o nome
`minha-assistente-web`, e o proxy faz o HTTPS. Quem liga isso é `docker-compose.proxy.yml`.

1. No `.env` do projeto, acrescente a linha abaixo. Assim os comandos `docker compose` (sem
   `-f`) já usam os dois arquivos:
   ```
   COMPOSE_FILE=docker-compose.prod.yml:docker-compose.proxy.yml
   ```
2. Suba com `docker compose up -d --build`. Nos itens 5 e 8, troque
   `docker compose -f docker-compose.prod.yml` por `docker compose`.
3. No Caddyfile do proxy, acrescente o site e recarregue sem reiniciar (os outros sites não caem):
   ```
   SEU_DOMINIO {
   	encode zstd gzip
   	reverse_proxy minha-assistente-web:80
   }
   ```
   ```bash
   cd /opt/proxy && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```

O IP do cliente chega à API certo (o limite de tentativas de login é por IP): o proxy manda o
IP em `X-Forwarded-For`, o Caddy do app confia nele por estar numa rede privada
(`PROXIES_CONFIAVEIS`) e repassa só esse IP.
