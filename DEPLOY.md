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

## Arquitetura

```
Internet (HTTPS:443)
       ↓
   Traefik (Docker Swarm)
       ↓ SSL automático (Let's Encrypt)
   Nginx (porta 8080)
       ↓
   /var/www/ZillesgQuiz/dist (arquivos estáticos)
```

## Estrutura no Servidor

```
/var/www/ZillesgQuiz/          # Projeto clonado do GitHub
├── .env                        # Variáveis de ambiente (Supabase)
├── dist/                       # Build de produção (gerado por npm run build)
├── node_modules/               # Dependências
└── ...

/etc/nginx/sites-available/quizbattle   # Configuração Nginx
/etc/easypanel/traefik/config/main.yaml # Configuração Traefik (inclui rotas do quiz)
```

---

## Deploy Inicial (Primeira vez)

### 1. Conectar ao servidor
```bash
ssh root@103.199.187.87
```

### 2. Instalar dependências do sistema
```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Nginx
DEBIAN_FRONTEND=noninteractive apt install -y nginx
systemctl enable nginx
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

### 6. Configurar Nginx
```bash
cat > /etc/nginx/sites-available/quizbattle << 'EOF'
server {
    listen 8080;
    server_name _;

    root /var/www/ZillesgQuiz/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF

ln -sf /etc/nginx/sites-available/quizbattle /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

### 7. Liberar firewall
```bash
ufw allow 8080/tcp
```

### 8. Configurar Traefik (rotas e SSL)
```bash
python3 << "PYEOF"
import json

with open("/etc/easypanel/traefik/config/main.yaml", "r") as f:
    config = json.load(f)

config["http"]["routers"]["http-quiz"] = {
    "service": "quiz",
    "rule": "Host(`quiz.zillesg.tech`)",
    "priority": 10,
    "middlewares": ["redirect-to-https", "bad-gateway-error-page"],
    "entryPoints": ["http"]
}

config["http"]["routers"]["https-quiz"] = {
    "service": "quiz",
    "rule": "Host(`quiz.zillesg.tech`)",
    "priority": 10,
    "middlewares": ["bad-gateway-error-page"],
    "tls": {
        "certResolver": "letsencrypt",
        "domains": [{"main": "quiz.zillesg.tech"}]
    },
    "entryPoints": ["https"]
}

config["http"]["services"]["quiz"] = {
    "loadBalancer": {
        "servers": [{"url": "http://172.17.0.1:8080/"}],
        "passHostHeader": True
    }
}

with open("/etc/easypanel/traefik/config/main.yaml", "w") as f:
    json.dump(config, f, indent=2)

print("Traefik configurado com sucesso!")
PYEOF
```

---

## Deploy de Atualização (Rotina)

Quando houver alterações no código, execute estes comandos:

### Via SSH direto:
```bash
ssh root@103.199.187.87 "cd /var/www/ZillesgQuiz && git pull && npm run build"
```

### Ou passo a passo:
```bash
ssh root@103.199.187.87
cd /var/www/ZillesgQuiz
git pull
npm run build
```

> **Nota:** Não é necessário reiniciar o Nginx para mudanças de código, pois são apenas arquivos estáticos.

---

## Troubleshooting

### Site não carrega (502 Bad Gateway)
1. Verificar se Nginx está rodando:
   ```bash
   systemctl status nginx
   ```
2. Verificar se a porta 8080 está escutando:
   ```bash
   ss -tlnp | grep 8080
   ```
3. Reiniciar Nginx:
   ```bash
   systemctl restart nginx
   ```

### SSL não funciona
1. Verificar rotas do Traefik:
   ```bash
   cat /etc/easypanel/traefik/config/main.yaml | python3 -c "import json,sys; d=json.load(sys.stdin); print('Quiz routers:', [k for k in d['http']['routers'] if 'quiz' in k])"
   ```
2. Se as rotas sumiram, executar novamente o script Python do passo 8.

### Build falha com erros TypeScript
1. Verificar erros localmente primeiro:
   ```bash
   npm run build
   ```
2. Corrigir erros e fazer push para o GitHub antes do deploy.

### Easypanel sobrescreveu a configuração do Traefik
Executar novamente o script Python do passo 8 para readicionar as rotas do quiz.

---

## Comandos Úteis

```bash
# Ver logs do Nginx
journalctl -u nginx -f

# Ver logs do Traefik
docker service logs traefik --tail 100 -f

# Testar configuração do Nginx
nginx -t

# Ver status dos serviços Docker
docker service ls

# Verificar espaço em disco
df -h

# Verificar uso de memória
free -h
```

---

## Checklist de Deploy

- [ ] Código commitado e pushado para GitHub
- [ ] Build local funcionando (`npm run build`)
- [ ] SSH no servidor
- [ ] `git pull` executado
- [ ] `npm run build` executado sem erros
- [ ] Site acessível em https://quiz.zillesg.tech
