# Guia de Deploy - Quiz Battle

Este documento descreve o processo completo de deploy do Quiz Battle para o servidor de produção.

## Informações do Servidor

| Item | Valor |
|------|-------|
| **Provedor** | Hostinger VPS |
| **IP** | 103.199.187.87 |
| **SSH** | `ssh root@103.199.187.87` |
| **OS** | Ubuntu 24.04.1 LTS |
| **Domínio** | quiz.zillesg.tech |
| **URL Produção** | https://quiz.zillesg.tech |
| **Painel** | Easypanel (Docker Swarm) |

## Arquitetura

```
Internet (HTTPS:443)
       ↓
   Traefik (Docker Swarm - Easypanel)
       ↓ SSL automático (Let's Encrypt)
   quiz_quiz (container nginx:alpine)
       ↓
   /var/www/ZillesgQuiz/dist (volume montado)
```

## Estrutura no Servidor

```
/var/www/ZillesgQuiz/              # Projeto clonado do GitHub
├── dist/                          # Build de produção (gerado por npm run build)
├── nginx.conf                     # Configuração do Nginx para o container
├── docker-stack.yml               # Stack definition para Docker Swarm
├── node_modules/                  # Dependências
└── ...

/etc/easypanel/traefik/config/
├── main.yaml                      # Configuração principal do Traefik (gerenciado pelo Easypanel)
└── quiz.yaml                      # Configuração de rotas do Quiz (arquivo separado)
```

## Docker Stack

O Quiz roda como um serviço Docker Swarm:

```bash
# Ver serviço
docker service ls | grep quiz

# Ver logs
docker service logs quiz_quiz --tail 50 -f

# Reiniciar serviço (se necessário)
docker service update --force quiz_quiz
```

---

## Deploy de Atualização (Rotina)

### Passo 1: Commit e Push local
```bash
git add .
git commit -m "sua mensagem"
git push
```

### Passo 2: Executar deploy no servidor
```bash
ssh root@103.199.187.87 "cd /var/www/ZillesgQuiz && git pull && npm run build"
```

> **Nota:** Não é necessário reiniciar o container. Os arquivos estáticos são montados como volume e atualizados automaticamente.

### Comando único (Git + Deploy)
```bash
git push && ssh root@103.199.187.87 "cd /var/www/ZillesgQuiz && git pull && npm run build"
```

---

## Deploy Inicial (Primeira vez)

### 1. Conectar ao servidor
```bash
ssh root@103.199.187.87
```

### 2. Instalar Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### 3. Clonar repositório
```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/RodrigoZillesg/ZillesgQuiz.git
cd ZillesgQuiz
```

### 4. Configurar variáveis de ambiente
```bash
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://vgnunopfrjeufioiucml.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnbnVub3BmcmpldWZpb2l1Y21sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTc2NTIsImV4cCI6MjA4MDQzMzY1Mn0.MhXZYXqXEhvwqdsu2PAtf8OXzyxUeuIbeYIop5laAX8
EOF
```

### 5. Instalar dependências e buildar
```bash
npm install
npm run build
```

### 6. Criar configuração Nginx para o container
```bash
cat > /var/www/ZillesgQuiz/nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
```

### 7. Criar Docker Stack
```bash
cat > /var/www/ZillesgQuiz/docker-stack.yml << 'EOF'
version: '3.8'

services:
  quiz:
    image: nginx:alpine
    volumes:
      - /var/www/ZillesgQuiz/dist:/usr/share/nginx/html:ro
      - /var/www/ZillesgQuiz/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - easypanel
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.quiz-http.rule=Host(`quiz.zillesg.tech`)
        - traefik.http.routers.quiz-http.entrypoints=http
        - traefik.http.routers.quiz-http.middlewares=redirect-to-https
        - traefik.http.routers.quiz-https.rule=Host(`quiz.zillesg.tech`)
        - traefik.http.routers.quiz-https.entrypoints=https
        - traefik.http.routers.quiz-https.tls=true
        - traefik.http.routers.quiz-https.tls.certresolver=letsencrypt
        - traefik.http.services.quiz.loadbalancer.server.port=80

networks:
  easypanel:
    external: true
EOF
```

### 8. Criar configuração Traefik (arquivo separado)
```bash
cat > /etc/easypanel/traefik/config/quiz.yaml << 'EOF'
http:
  routers:
    http-quiz:
      service: quiz
      rule: "Host(`quiz.zillesg.tech`)"
      entryPoints:
        - http
      middlewares:
        - redirect-to-https
    https-quiz:
      service: quiz
      rule: "Host(`quiz.zillesg.tech`)"
      entryPoints:
        - https
      tls:
        certResolver: letsencrypt
      middlewares:
        - bad-gateway-error-page
  services:
    quiz:
      loadBalancer:
        servers:
          - url: "http://quiz_quiz:80/"
        passHostHeader: true
EOF
```

### 9. Deploy do Stack
```bash
docker stack deploy -c /var/www/ZillesgQuiz/docker-stack.yml quiz
```

### 10. Verificar se está rodando
```bash
docker service ls | grep quiz
# Deve mostrar: quiz_quiz   replicated   1/1   nginx:alpine
```

---

## Troubleshooting

### Site mostra 404 do Easypanel
O Traefik não está roteando para o serviço. Verificar:

1. Se o serviço está rodando:
   ```bash
   docker service ls | grep quiz
   ```

2. Se o arquivo de config do Traefik existe:
   ```bash
   cat /etc/easypanel/traefik/config/quiz.yaml
   ```

3. Se não existir, recriar com o passo 8 do deploy inicial.

### Container não inicia
```bash
# Ver logs detalhados
docker service logs quiz_quiz --tail 100

# Verificar se os volumes existem
ls -la /var/www/ZillesgQuiz/dist/
ls -la /var/www/ZillesgQuiz/nginx.conf
```

### SSL não funciona
Traefik gera certificados automaticamente. Se não funcionar:

1. Verificar logs do Traefik:
   ```bash
   docker service logs traefik --tail 100 | grep quiz
   ```

2. Verificar se o DNS aponta corretamente:
   ```bash
   nslookup quiz.zillesg.tech
   ```

### Build falha com erros TypeScript
1. Corrigir erros localmente primeiro:
   ```bash
   npm run build
   ```
2. Fazer push e tentar novamente.

### Easypanel sobrescreveu a config do Traefik
O arquivo `quiz.yaml` é separado do `main.yaml`, então não deveria ser afetado.
Se acontecer, recriar com o passo 8.

---

## Comandos Úteis

```bash
# Ver status do serviço
docker service ls | grep quiz

# Ver logs em tempo real
docker service logs quiz_quiz -f --tail 50

# Reiniciar serviço (força redeployment)
docker service update --force quiz_quiz

# Ver configuração do Traefik
cat /etc/easypanel/traefik/config/quiz.yaml

# Ver todos os serviços Docker Swarm
docker service ls

# Verificar espaço em disco
df -h

# Verificar uso de memória
free -h

# Ver IP do container
docker inspect $(docker ps -q -f name=quiz_quiz) --format '{{.NetworkSettings.Networks}}'
```

---

## Checklist de Deploy

- [ ] Código commitado e pushado para GitHub
- [ ] Build local funcionando (`npm run build`)
- [ ] Executar: `ssh root@103.199.187.87 "cd /var/www/ZillesgQuiz && git pull && npm run build"`
- [ ] Verificar site em https://quiz.zillesg.tech
- [ ] Se 404, verificar serviço: `docker service ls | grep quiz`
