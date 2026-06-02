# nu PMC v4 — AWS Deployment Guide

**For: Guru Udupa**
**Version: 2026-04-22 handoff**

This guide gives you two deployment options. Both work. Pick one based on your
comfort level and how much ops you want to do after deploy.

---

## What the app needs

- **Node 20+** (handled inside Docker)
- **MariaDB 10.11** (handled inside Docker or via RDS)
- **500 MB** disk for app image, **5 GB** for uploads/DB growth
- **1 GB RAM** minimum, **2 GB** comfortable
- **One open port** (3100 for app, or 443 via nginx)

---

## Option A — EC2 + docker-compose (recommended, simplest)

One box. Docker runs both the app and the DB. You handle backups via snapshots.

### Step 1 — Provision the EC2

- **Instance type:** `t3.small` (2 vCPU, 2 GB RAM) — ~$15/month
- **AMI:** Amazon Linux 2023 or Ubuntu 22.04 LTS
- **Storage:** 30 GB gp3
- **Security group:**
  - SSH (22) from your IP
  - HTTPS (443) from 0.0.0.0/0 (once domain + TLS set up)
  - HTTP (80) from 0.0.0.0/0 (for Let's Encrypt renewal)
- **Elastic IP:** attach one so the IP doesn't change on reboot

### Step 2 — Install Docker (once, on the EC2)

```bash
# Amazon Linux 2023
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# Log out and back in so the group takes effect

# Docker Compose plugin
sudo dnf install -y docker-compose-plugin
docker compose version  # should print v2.x
```

### Step 3 — Deploy

```bash
# Upload the tarball via scp
scp nu-pmc-guru-v4.tar.gz ec2-user@your-ip:/tmp/

# On the EC2
sudo mkdir -p /opt/nu-pmc
sudo tar -xzf /tmp/nu-pmc-guru-v4.tar.gz -C /opt/nu-pmc
sudo chown -R ec2-user:ec2-user /opt/nu-pmc
cd /opt/nu-pmc

# Environment file
cp .env.docker.example .env
nano .env
# Set these three (generate random values):
#   DB_ROOT_PASSWORD=$(openssl rand -base64 24)
#   DB_PASSWORD=$(openssl rand -base64 24)
#   SESSION_SECRET=$(openssl rand -hex 32)
#
# Leave Twilio/Anthropic keys blank for now unless you have them.

# Start
docker compose up -d db
sleep 30  # wait for DB healthy
docker compose --profile seed run --rm seed
docker compose up -d app

# Verify
docker compose ps
# Both db and app should show "healthy"

curl http://localhost:3100/
# Should return the login page HTML
```

### Step 4 — HTTPS via nginx + Let's Encrypt

The app is now on port 3100 but only reachable over HTTP. For real use, front
it with nginx and get a TLS cert.

```bash
# Install nginx + certbot
sudo dnf install -y nginx
sudo dnf install -y python3-certbot-nginx  # OR: sudo pip3 install certbot certbot-nginx

# nginx config — see deploy/nginx.conf in the tarball
sudo cp /opt/nu-pmc/deploy/nginx.conf /etc/nginx/conf.d/nu-pmc.conf
# Edit: replace YOUR_DOMAIN with actual domain (e.g. YOUR_DOMAIN)

sudo nginx -t
sudo systemctl enable --now nginx

# Get a Let's Encrypt cert
sudo certbot --nginx -d YOUR_DOMAIN
# Follow prompts. Certbot will update the nginx config automatically.

# Test HTTPS
curl -I https://YOUR_DOMAIN
# Should return HTTP/2 200
```

### Step 5 — First login

Open `https://YOUR_DOMAIN` in a browser.

Default users (all password `Test1234` — **CHANGE ON FIRST LOGIN**):
- `naveen` (principal)
- `ajay` (design_principal)
- `murugesan`, `praveen` (pmc_head)

Have Naveen log in first and change his password before anyone else touches it.

### Step 6 — Backups

Named volumes `nu-pmc-db-data` and `nu-pmc-uploads` hold everything. Back up
with EBS snapshots (automated via AWS Backup) OR:

```bash
# Nightly cron — dump DB + tar uploads to S3
docker compose exec -T db mariadb-dump -u root -p"$DB_ROOT_PASSWORD" nu_pmc | gzip > /backup/nu_pmc_$(date +%Y%m%d).sql.gz
aws s3 cp /backup/nu_pmc_$(date +%Y%m%d).sql.gz s3://nu-pmc-backups/
```

### Step 7 — Updates

```bash
# Stop app, pull new tarball, rebuild, start
docker compose down app
# Replace /opt/nu-pmc source (tar over or git pull)
docker compose build app
docker compose --profile seed run --rm seed  # applies any new migrations
docker compose up -d app
```

---

## Option B — ECS Fargate + RDS (more AWS-native, more parts)

Use this if Anthropic-NU scales past one site and you want managed scaling and
DB HA. Not required for PV 90.

### Step 1 — RDS instance

- **Engine:** MariaDB 10.11 (or Aurora MySQL 5.7 compatible)
- **Class:** `db.t3.micro` for staging, `db.t3.small` for prod
- **Multi-AZ:** off for staging, on for prod
- **Security group:** allow port 3306 from the ECS task security group

Once up, create the database and user manually:
```sql
CREATE DATABASE nu_pmc CHARACTER SET utf8mb4;
CREATE USER 'nu_app'@'%' IDENTIFIED BY '<password from AWS Secrets Manager>';
GRANT ALL ON nu_pmc.* TO 'nu_app'@'%';
```

### Step 2 — Build + push image to ECR

```bash
aws ecr create-repository --repository-name nu-pmc
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com

docker build -t nu-pmc:v4 .
docker tag nu-pmc:v4 <account>.dkr.ecr.<region>.amazonaws.com/nu-pmc:v4
docker push <account>.dkr.ecr.<region>.amazonaws.com/nu-pmc:v4
```

### Step 3 — Run migrations once via ECS Run Task

Create a one-off task using the same image:
```json
{
  "family": "nu-pmc-seed",
  "containerDefinitions": [{
    "name": "seed",
    "image": "<account>.dkr.ecr.<region>.amazonaws.com/nu-pmc:v4",
    "command": ["bash", "scripts/seed-full.sh"],
    "environment": [
      {"name": "DB_HOST", "value": "<rds-endpoint>"},
      {"name": "DB_USER", "value": "nu_app"},
      {"name": "DB_NAME", "value": "nu_pmc"}
    ],
    "secrets": [
      {"name": "DB_PASSWORD", "valueFrom": "arn:...:secret:nu-pmc-db-pw"}
    ]
  }]
}
```

### Step 4 — ECS Service for the app

Create an ALB, target group on port 3100, and an ECS service using the same
image but with CMD `["node", "server.js"]`. Auto-scale on CPU > 70%.

---

## Sanity check

After deploy, run the smoke test:

```bash
# Inside the app container (or via docker compose exec)
docker compose exec app bash scripts/post-deploy-smoke.sh
```

Expected output:
- DB reachable ✓
- Schema present ✓ (91 tables)
- Governance tables populated ✓ (role_permissions: 1575+ rows)
- Login endpoint responds with 200 or 401 ✓
- A test user can authenticate ✓

---

## Emergency contacts

- **Naveen Bhat** — principal, final decisions
- **Guru Udupa** — you (AWS + deploy)
- **PMC team — site ops; your field testers

If something's wrong and you need Claude help: copy the error, the `docker
compose logs app` output, and the relevant env var names (values redacted).
Start a fresh chat and attach `HANDOFF.md` plus the error bundle.

---

## Cost estimate

Option A (EC2 single box):
- t3.small: $15/month
- Elastic IP (always attached): free
- 30 GB gp3: $3/month
- Route 53 hosted zone: $0.50/month
- Total: **~$20/month**

Option B (ECS + RDS):
- RDS db.t3.micro single-AZ: $15/month
- ECS Fargate 0.5 vCPU, 1 GB RAM, 24×7: $12/month
- ALB: $18/month
- Total: **~$45/month**

For one active project, Option A is right. Re-evaluate at the second project.
