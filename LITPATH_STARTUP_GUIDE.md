# LitPath AI — Installation Guide

This guide covers two setup paths:

- **Part A — Local Development Setup (Windows/Mac/Linux)**: for running the project on a personal machine to review, test, or continue development.
- **Part B — Production Deployment (Ubuntu Server on Proxmox VE)**: for hosting the application on a dedicated server.

---

## Part A — Local Development Setup

### 1. Prerequisites

- Python 3.11+
- Node.js 18+
- Git
- A Supabase project (provides the PostgreSQL database) — or a local PostgreSQL instance if not using Supabase
- API keys: Google Gemini API key ([aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)), Supabase project credentials

### 2. Clone the Repository

```powershell
git clone https://github.com/APC-SoCIT/APC_2025_2026_T1_MI231_G07-LitPath-AI.git
cd APC_2025_2026_T1_MI231_G07-LitPath-AI
```

### 3. Configure Environment Variables

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` with your own credentials:

- Supabase / PostgreSQL connection details (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`)
- `GEMINI_API_KEY` — from Google AI Studio
- Auth hardening settings (`TERMS_VERSION`, `REGISTER_RATE_LIMIT`, `REGISTER_RATE_WINDOW_SECONDS`, `REQUIRE_CAPTCHA`, `RECAPTCHA_SECRET_KEY`) — defaults are fine for local development

**Security note:** never commit `.env` files to git. See `SECURITY_SETUP.md` for details.

### 4. Backend Setup (Django)

```powershell
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_admins
python manage.py runserver
```

Backend runs at: `http://localhost:8000`

`seed_admins` creates the initial admin accounts. **Change the seeded passwords immediately after first login** — do not leave default credentials active, especially before handing the project off to another party.

### 5. Frontend Setup (React + Vite + TypeScript)

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

Alternatively, use the startup script from the project root:

```powershell
.\start-backend.ps1
```

### 6. Verify the Setup

- Visit `http://localhost:8000/api/health/` — should return a healthy status
- Visit `http://localhost:5173` — the frontend should load and be able to reach the backend
- Log in with a seeded admin account and confirm the dashboard loads

### Local Setup Troubleshooting

**`python manage.py migrate` fails with a SQLite-related syntax error near `[]`:**
This project uses PostgreSQL-specific fields (`ArrayField`) that are not compatible with SQLite. Confirm `backend\.env` exists and contains valid PostgreSQL/Supabase credentials — Django falls back to SQLite only when it cannot read a configured database connection.

**`git push` fails with "permission denied" on your own fork:**
Usually means cached Git credentials belong to a different GitHub account. Clear the cached credential in Windows Credential Manager (`git:https://github.com`) and re-authenticate as the correct account, or use a Personal Access Token in place of a password.

**Migrations show as pending on server start:**
Run `python manage.py migrate` before `runserver`. Django will warn but still start the server, so check for the "unapplied migration(s)" message and apply them first.

---

## Part B — Production Deployment (Ubuntu Server on Proxmox VE)

### 1. System Requirements

- Ubuntu Server 22.04 LTS or newer
- Minimum 4GB RAM (8GB+ recommended)
- 20GB+ disk space
- Python 3.9+ and Node.js 18+

### 2. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and Node.js
sudo apt install python3 python3-pip python3-venv nodejs npm postgresql postgresql-contrib -y

# Install additional tools
sudo apt install git curl build-essential -y

# For Node.js, if the default version is too old:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Database Setup

```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE litpath_db;
CREATE USER litpath_user WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
ALTER ROLE litpath_user SET client_encoding TO 'utf8';
ALTER ROLE litpath_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE litpath_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE litpath_db TO litpath_user;
\q
EOF
```

> If using Supabase instead of a self-hosted PostgreSQL instance, skip this step and use the Supabase connection string in `DATABASE_URL` below.

### 4. Clone the Repository

```bash
cd /opt
sudo git clone https://github.com/APC-SoCIT/APC_2025_2026_T1_MI231_G07-LitPath-AI.git LitPath-AI
sudo chown -R $USER:$USER LitPath-AI
cd LitPath-AI
```

### 5. Set Up Python Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 6. Configure Environment Variables

```bash
cat > backend/.env << EOF
DEBUG=False
SECRET_KEY=$(python -c 'from django.core.management import utils; print(utils.get_random_secret_key())')
DATABASE_URL=postgresql://litpath_user:REPLACE_WITH_STRONG_PASSWORD@localhost:5432/litpath_db
GEMINI_API_KEY=your_gemini_api_key
CHROMA_PERSIST_DIR=./chromadb_data
EOF
```

Replace placeholder values with real credentials. Never commit this file.

### 7. Set Up Backend

```bash
cd backend
python manage.py migrate
python manage.py seed_admins
python manage.py collectstatic --noinput
```

### 8. Set Up Frontend

```bash
cd ../frontend
npm install

cat > .env << EOF
VITE_API_BASE_URL=http://localhost:8000
EOF

npm run build
```

### 9. Running the Application

**Development mode:**

```bash
# Backend
cd /opt/LitPath-AI/backend
source ../venv/bin/activate
python manage.py runserver 0.0.0.0:8000

# Frontend (separate terminal)
cd /opt/LitPath-AI/frontend
npm run dev -- --host 0.0.0.0
```

**Production mode — systemd service:**

Create `/etc/systemd/system/litpath-backend.service`:

```ini
[Unit]
Description=LitPath AI Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/LitPath-AI/backend
EnvironmentFile=/opt/LitPath-AI/backend/.env
ExecStart=/opt/LitPath-AI/venv/bin/python manage.py runserver 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable litpath-backend
sudo systemctl start litpath-backend
```

### 10. Nginx Reverse Proxy (Recommended for Production)

```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

Create `/etc/nginx/sites-available/litpath`:

```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://localhost:8000/admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/litpath /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 11. Admin Accounts

`seed_admins` creates the initial admin/staff accounts required to access the system.

⚠️ **Important:** Rotate all seeded account passwords immediately after first login, and before handing the system over to another party. Do not keep a written record of default credentials in any document that travels with the project once passwords have been changed.

### Production Troubleshooting

**Check service status:**

```bash
systemctl status litpath-backend
systemctl status nginx
systemctl status postgresql
```

**View backend logs:**

```bash
journalctl -u litpath-backend -f
```

**RAG system not returning results:**

1. Verify ChromaDB data exists in `./chromadb_data`
2. Confirm `GEMINI_API_KEY` is set correctly in `.env`
3. Check that thesis materials are properly indexed

**Database / migration issues:**

```bash
# Check migration status
python manage.py showmigrations

# Only if the database is empty and migrations are out of sync:
python manage.py migrate --fake-initial
```


# Part B — LitPath AI Startup Guide for Ubuntu Server in Proxmox VE

## Prerequisites

### 1. System Requirements
- Ubuntu Server 22.04 LTS or newer
- Minimum 4GB RAM (8GB+ recommended)
- 20GB+ disk space
- Python 3.9+ and Node.js 18+

### 2. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and Node.js
sudo apt install python3 python3-pip python3-venv nodejs npm postgresql postgresql-contrib -y

# Install additional tools
sudo apt install git curl build-essential -y

# For Node.js, if the default version is too old:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Database Setup
```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE litpath_db;
CREATE USER litpath_user WITH PASSWORD 'secure_password_here';
ALTER ROLE litpath_user SET client_encoding TO 'utf8';
ALTER ROLE litpath_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE litpath_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE litpath_db TO litpath_user;
\\q
EOF
```

## Installation Steps

### 1. Clone the Repository
```bash
cd /opt
sudo git clone https://github.com/your-org/LitPath-AI.git
sudo chown -R $USER:$USER LitPath-AI
cd LitPath-AI
```

### 2. Setup Python Environment
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 3. Configure Environment Variables
```bash
# Create .env file in backend directory
cat > backend/.env << EOF
DEBUG=False
SECRET_KEY=$(python -c 'from django.core.management import utils; print(utils.get_random_secret_key())')
DATABASE_URL=postgresql://litpath_user:secure_password_here@localhost:5432/litpath_db
HF_TOKEN=your_huggingface_token
GEMINI_API_KEY=your_gemini_api_key
CHROMA_PERSIST_DIR=./chromadb_data
EOF
```

### 4. Setup Backend
```bash
cd backend

# Run migrations
python manage.py migrate

# Seed initial users
python manage.py seed_users

# Collect static files (for production)
python manage.py collectstatic --noinput
```

### 5. Setup Frontend
```bash
cd ../frontend

# Install Node dependencies
npm install

# Create environment file
cat > .env << EOF
VITE_API_BASE_URL=http://localhost:8000
EOF
```

### 6. Build Frontend
```bash
npm run build
```

## Running the Application

### 1. Start Backend Service
```bash
cd /opt/LitPath-AI/backend
source ../venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

### 2. Start Frontend Service (for development)
```bash
cd /opt/LitPath-AI/frontend
npm run dev -- --host 0.0.0.0
```

### 3. For Production Deployment
Create systemd services:

#### Backend Service (`/etc/systemd/system/litpath-backend.service`):
```bash
[Unit]
Description=LitPath AI Backend
After=network.target

[Service]
Type=Simple
User=www-data
WorkingDirectory=/opt/LitPath-AI/backend
EnvironmentFile=/opt/LitPath-AI/backend/.env
ExecStart=/opt/LitPath-AI/venv/bin/python manage.py runserver 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable litpath-backend
sudo systemctl start litpath-backend
```

## Using Nginx as Reverse Proxy (Recommended for Production)

### 1. Install Nginx
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. Configure Nginx
Create `/etc/nginx/sites-available/litpath`:
```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    location / {
        proxy_pass http://localhost:5173;  # Frontend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8000/api/;  # Backend API
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://localhost:8000/admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/litpath /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Default Credentials
After seeding, you can use these accounts:

- **Admin Account 1:**
  - Email: `admin@litpath.local`
  - Password: `adminpass123`

- **Admin Account 2:**
  - Email: `admin@litpath.com`
  - Password: `admin123456`

- **Staff Account:**
  - Email: `librarian@dost.gov.ph`
  - Password: `librarian123`

⚠️ **Important**: Change these passwords immediately after first login in a production environment!

## Troubleshooting

### Check Service Status
```bash
# Backend
systemctl status litpath-backend

# Nginx
systemctl status nginx

# PostgreSQL
systemctl status postgresql
```

### View Logs
```bash
# Backend logs
journalctl -u litpath-backend -f
```

### RAG System
If the RAG system isn't working:
1. Verify ChromaDB data exists in `./chromadb_data`
2. Ensure HuggingFace and Gemini tokens are properly configured
3. Check that the RAG theses are properly indexed

### Database Issues
```bash
# Check migrations
python manage.py showmigrations

# If needed, fake initial migrations (only if database is empty):
python manage.py migrate --fake-initial
```
# LitPath AI Startup Guide for Ubuntu Server in Proxmox VE

## Prerequisites

### 1. System Requirements
- Ubuntu Server 22.04 LTS or newer
- Minimum 4GB RAM (8GB+ recommended)
- 20GB+ disk space
- Python 3.9+ and Node.js 18+

### 2. Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and Node.js
sudo apt install python3 python3-pip python3-venv nodejs npm postgresql postgresql-contrib -y

# Install additional tools
sudo apt install git curl build-essential -y

# For Node.js, if the default version is too old:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Database Setup
```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE litpath_db;
CREATE USER litpath_user WITH PASSWORD 'secure_password_here';
ALTER ROLE litpath_user SET client_encoding TO 'utf8';
ALTER ROLE litpath_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE litpath_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE litpath_db TO litpath_user;
\\q
EOF
```

## Installation Steps

### 1. Clone the Repository
```bash
cd /opt
sudo git clone https://github.com/your-org/LitPath-AI.git
sudo chown -R $USER:$USER LitPath-AI
cd LitPath-AI
```

### 2. Setup Python Environment
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 3. Configure Environment Variables
```bash
# Create .env file in backend directory
cat > backend/.env << EOF
DEBUG=False
SECRET_KEY=$(python -c 'from django.core.management import utils; print(utils.get_random_secret_key())')
DATABASE_URL=postgresql://litpath_user:secure_password_here@localhost:5432/litpath_db
HF_TOKEN=your_huggingface_token
GEMINI_API_KEY=your_gemini_api_key
CHROMA_PERSIST_DIR=./chromadb_data
EOF
```

### 4. Setup Backend
```bash
cd backend

# Run migrations
python manage.py migrate

# Seed initial users
python manage.py seed_users

# Collect static files (for production)
python manage.py collectstatic --noinput
```

### 5. Setup Frontend
```bash
cd ../frontend

# Install Node dependencies
npm install

# Create environment file
cat > .env << EOF
VITE_API_BASE_URL=http://localhost:8000
EOF
```

### 6. Build Frontend
```bash
npm run build
```

## Running the Application

### 1. Start Backend Service
```bash
cd /opt/LitPath-AI/backend
source ../venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

### 2. Start Frontend Service (for development)
```bash
cd /opt/LitPath-AI/frontend
npm run dev -- --host 0.0.0.0
```

### 3. For Production Deployment
Create systemd services:

#### Backend Service (`/etc/systemd/system/litpath-backend.service`):
```bash
[Unit]
Description=LitPath AI Backend
After=network.target

[Service]
Type=Simple
User=www-data
WorkingDirectory=/opt/LitPath-AI/backend
EnvironmentFile=/opt/LitPath-AI/backend/.env
ExecStart=/opt/LitPath-AI/venv/bin/python manage.py runserver 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable litpath-backend
sudo systemctl start litpath-backend
```

## Using Nginx as Reverse Proxy (Recommended for Production)

### 1. Install Nginx
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. Configure Nginx
Create `/etc/nginx/sites-available/litpath`:
```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    location / {
        proxy_pass http://localhost:5173;  # Frontend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8000/api/;  # Backend API
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://localhost:8000/admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/litpath /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Default Credentials
After seeding, you can use these accounts:

- **Admin Account 1:**
  - Email: `admin@litpath.local`
  - Password: `adminpass123`

- **Admin Account 2:**
  - Email: `admin@litpath.com`
  - Password: `admin123456`

- **Staff Account:**
  - Email: `librarian@dost.gov.ph`
  - Password: `librarian123`

⚠️ **Important**: Change these passwords immediately after first login in a production environment!

## Troubleshooting

### Check Service Status
```bash
# Backend
systemctl status litpath-backend

# Nginx
systemctl status nginx

# PostgreSQL
systemctl status postgresql
```

### View Logs
```bash
# Backend logs
journalctl -u litpath-backend -f
```

### RAG System
If the RAG system isn't working:
1. Verify ChromaDB data exists in `./chromadb_data`
2. Ensure HuggingFace and Gemini tokens are properly configured
3. Check that the RAG theses are properly indexed

### Database Issues
```bash
# Check migrations
python manage.py showmigrations

# If needed, fake initial migrations (only if database is empty):
python manage.py migrate --fake-initial
```