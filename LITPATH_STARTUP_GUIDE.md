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