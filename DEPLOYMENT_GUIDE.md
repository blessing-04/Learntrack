# 🚀 LearnTrack - Deployment Guide

## Production Deployment Checklist

---

## 📋 Pre-Deployment Checklist

### 1. Environment Configuration ✅

- [ ] Update `.env` with production values
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database URL
- [ ] Add production Stripe keys
- [ ] Set production CORS origin
- [ ] Configure production frontend URL

### 2. Code Preparation ✅

- [ ] All hardcoded URLs removed
- [ ] Dynamic API configuration implemented
- [ ] Error handling in place
- [ ] Logging configured
- [ ] Security headers added

### 3. Database ✅

- [ ] Production database created
- [ ] Migration scripts run
- [ ] Storage buckets created
- [ ] RLS policies enabled
- [ ] Indexes created

### 4. Security ✅

- [ ] SSL/HTTPS configured
- [ ] Environment variables secured
- [ ] API keys rotated
- [ ] CORS properly configured
- [ ] Rate limiting enabled

---

## 🔧 Environment Configuration

### Production `.env` File

```env
# Environment
NODE_ENV=production

# Server Configuration
PORT=443
CORS_ORIGIN=https://yourdomain.com

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_key

# Stripe Configuration (LIVE KEYS)
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Optional: Logging
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn
```

---

## 🌐 Dynamic URL Configuration

### Frontend Configuration

The application now uses **dynamic URL detection**:

**File:** `public/js/config.js`

```javascript
// Automatically detects environment
if (hostname === 'localhost') {
  API_BASE_URL = 'http://localhost:5000';
} else {
  API_BASE_URL = window.location.origin;
}
```

**No hardcoded URLs!** ✅

All API calls now use: `window.APP_CONFIG.API_BASE`

---

## 📦 Deployment Options

### Option 1: Traditional VPS (DigitalOcean, Linode, AWS EC2)

#### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 16+
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

#### Step 2: Deploy Application

```bash
# Clone repository
git clone <your-repo-url>
cd LearnTrack

# Install dependencies
npm install --production

# Create .env file
nano .env
# (paste production environment variables)

# Start with PM2
pm2 start server.js --name learntrack
pm2 startup
pm2 save
```

#### Step 3: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/learntrack
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/learntrack /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 4: SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

### Option 2: Platform as a Service (Heroku)

#### Step 1: Prepare Application

```bash
# Create Procfile
echo "web: node server.js" > Procfile

# Ensure package.json has start script
# "start": "node server.js"
```

#### Step 2: Deploy

```bash
# Login to Heroku
heroku login

# Create app
heroku create learntrack-app

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=your_url
heroku config:set SUPABASE_ANON_KEY=your_key
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_service_key
heroku config:set STRIPE_SECRET_KEY=sk_live_...
heroku config:set STRIPE_PUBLISHABLE_KEY=pk_live_...
heroku config:set FRONTEND_URL=https://learntrack-app.herokuapp.com

# Deploy
git push heroku main

# Open app
heroku open
```

---

### Option 3: Vercel (Frontend) + Railway (Backend)

#### Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd public
vercel

# Set environment variables in Vercel dashboard
# Add API_BASE_URL pointing to Railway backend
```

#### Backend (Railway)

1. Connect GitHub repository
2. Add environment variables
3. Deploy automatically

---

### Option 4: Docker Deployment

#### Create Dockerfile

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
```

#### Create docker-compose.yml

```yaml
version: '3.8'

services:
  learntrack:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
    env_file:
      - .env
    restart: unless-stopped
```

#### Deploy

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## 🔒 Security Configuration

### 1. Update server.js for Production

Add security headers:

```javascript
// Add after other middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

### 2. Enable Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 3. Configure CORS Properly

```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## 📊 Monitoring & Logging

### 1. Setup Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### 2. Error Tracking (Sentry)

```javascript
const Sentry = require('@sentry/node');

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV
  });
  
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());
}
```

### 3. Health Check Endpoint

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});
```

---

## 🗄️ Database Migration

### Production Database Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Note down URL and keys

2. **Run Migration**
   ```sql
   -- Run database-migration.sql in SQL Editor
   ```

3. **Create Storage Buckets**
   - course-videos (Private, 50MB limit)
   - course-documents (Private, 10MB limit)
   - course-thumbnails (Public, 5MB limit)

4. **Configure RLS Policies**
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
   ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
   -- etc.
   ```

---

## 💳 Stripe Configuration

### Switch to Live Mode

1. **Get Live API Keys**
   - Go to Stripe Dashboard
   - Switch to "Live mode"
   - Developers → API Keys
   - Copy live keys

2. **Update Environment**
   ```env
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

3. **Configure Webhooks**
   - Stripe Dashboard → Webhooks
   - Add endpoint: `https://yourdomain.com/webhook/stripe`
   - Select events: `checkout.session.completed`
   - Copy webhook secret
   - Add to `.env`: `STRIPE_WEBHOOK_SECRET=whsec_...`

4. **Test Live Payments**
   - Use real card (small amount)
   - Verify enrollment creation
   - Check Stripe dashboard

---

## 🔄 Continuous Deployment

### GitHub Actions (Example)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run tests
      run: npm test
    
    - name: Deploy to server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/learntrack
          git pull
          npm install --production
          pm2 restart learntrack
```

---

## ✅ Post-Deployment Checklist

### 1. Functionality Testing

- [ ] Sign up works (both roles)
- [ ] Sign in works
- [ ] Instructor payment works
- [ ] Course creation works
- [ ] Course enrollment works
- [ ] File uploads work
- [ ] Profile updates work
- [ ] All pages load correctly

### 2. Performance Testing

- [ ] Page load times acceptable
- [ ] API response times good
- [ ] File uploads complete successfully
- [ ] No memory leaks
- [ ] Database queries optimized

### 3. Security Testing

- [ ] HTTPS working
- [ ] CORS configured correctly
- [ ] No exposed secrets
- [ ] Rate limiting active
- [ ] Input validation working

### 4. Monitoring Setup

- [ ] Error tracking configured
- [ ] Logging working
- [ ] Uptime monitoring active
- [ ] Performance monitoring active
- [ ] Alerts configured

---

## 🆘 Rollback Plan

If deployment fails:

```bash
# Stop current version
pm2 stop learntrack

# Restore previous version
git checkout <previous-commit>
npm install
pm2 restart learntrack

# Or restore from backup
cp -r /backup/learntrack-backup /var/www/learntrack
pm2 restart learntrack
```

---

## 📞 Support Contacts

**Technical Issues:**
- Check logs: `pm2 logs learntrack`
- Review error tracking dashboard
- Check database logs in Supabase

**Emergency Contacts:**
- System Administrator: [contact]
- Database Admin: [contact]
- DevOps Team: [contact]

---

## 📝 Maintenance Schedule

### Daily
- Check error logs
- Monitor uptime
- Review performance metrics

### Weekly
- Review security logs
- Check database performance
- Update dependencies (if needed)

### Monthly
- Full backup
- Security audit
- Performance optimization
- Dependency updates

---

**Deployment Status:** Ready for Production ✅  
**Last Updated:** October 2025  
**Version:** 1.0.0
