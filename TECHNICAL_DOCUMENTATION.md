# 🔧 LearnTrack - Technical Documentation

## For Developers & System Administrators

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Installation & Setup](#installation--setup)
4. [Database Schema](#database-schema)
5. [API Documentation](#api-documentation)
6. [Authentication & Security](#authentication--security)
7. [Payment Integration](#payment-integration)
8. [File Upload System](#file-upload-system)
9. [Deployment Guide](#deployment-guide)
10. [Troubleshooting](#troubleshooting)

---

## System Architecture

### Overview
LearnTrack follows a **client-server architecture** with a RESTful API backend.

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  HTML + CSS (Tailwind) + JavaScript (Vanilla ES6+)      │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────┐
│                  Express.js Server                       │
│              (Node.js Runtime)                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Routes: auth, courses, enrollments, profiles   │   │
│  │  Middleware: CORS, JSON parser, auth            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Supabase (Backend as a Service)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ PostgreSQL   │  │   Storage    │  │     Auth     │ │
│  │  Database    │  │  (Files)     │  │   (Users)    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Stripe Payment Gateway                  │
│              (Payment Processing)                        │
└─────────────────────────────────────────────────────────┘
```

### Request Flow
```
User Action → Frontend JS → API Request → Express Route → 
Supabase Client → Database/Storage → Response → Frontend Update
```

---

## Technology Stack

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Custom styles
- **Tailwind CSS v3**: Utility-first CSS framework
- **JavaScript ES6+**: Modern vanilla JavaScript
- **Stripe.js**: Payment integration

### Backend
- **Node.js v16+**: JavaScript runtime
- **Express.js v4**: Web framework
- **Supabase JS Client v2**: Database & auth SDK
- **Stripe Node SDK**: Payment processing
- **CORS**: Cross-origin resource sharing
- **dotenv**: Environment variable management

### Database & Storage
- **Supabase (PostgreSQL)**: Relational database
- **Supabase Storage**: File storage (S3-compatible)
- **Row Level Security (RLS)**: Database security

### Development Tools
- **npm**: Package manager
- **Git**: Version control
- **VS Code**: Recommended IDE

---

## Installation & Setup

### Prerequisites
```bash
# Required
Node.js >= 16.0.0
npm >= 7.0.0

# Check versions
node --version
npm --version
```

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd LearnTrack
```

### Step 2: Install Dependencies
```bash
npm install
```

**Installed Packages:**
- express: ^4.18.2
- @supabase/supabase-js: ^2.39.0
- stripe: ^14.10.0
- cors: ^2.8.5
- dotenv: ^16.3.1

### Step 3: Environment Configuration

Create `.env` file in project root:

```env
# Server Configuration
PORT=5000
CORS_ORIGIN=http://localhost:5000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:5000
```

**Getting Supabase Keys:**
1. Go to [supabase.com](https://supabase.com)
2. Create project
3. Settings → API → Copy keys

**Getting Stripe Keys:**
1. Go to [stripe.com](https://stripe.com)
2. Create account
3. Developers → API Keys → Copy keys

### Step 4: Database Setup

Run the migration script in Supabase SQL Editor:

```bash
# File: database-migration.sql
# Execute in Supabase Dashboard → SQL Editor
```

**Tables Created:**
- users (via Supabase Auth)
- courses
- enrollments
- course_sections
- course_lessons

### Step 5: Storage Buckets

Create in Supabase Dashboard → Storage:

1. **course-videos**
   - Public: No
   - File size limit: 52428800 (50MB)
   - Allowed MIME types: video/mp4

2. **course-documents**
   - Public: No
   - File size limit: 10485760 (10MB)
   - Allowed MIME types: application/pdf, application/msword

3. **course-thumbnails**
   - Public: Yes
   - File size limit: 5242880 (5MB)
   - Allowed MIME types: image/*

### Step 6: Start Server

```bash
# Development mode (auto-restart)
npm run dev

# Production mode
npm start
```

**Server will start on:** `http://localhost:5000`

---

## Database Schema

### Users Table (Supabase Auth)
```sql
-- Managed by Supabase Auth
-- user_metadata fields:
{
  "role": "student" | "instructor",
  "name": "string",
  "full_name": "string",
  "payment_status": "completed" | null,
  "payment_date": "timestamp",
  "title": "string",
  "bio": "string",
  "expertise": "string",
  "years_experience": integer,
  "linkedin": "string",
  "website": "string",
  "twitter": "string",
  "github": "string"
}
```

### Courses Table
```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  price_cents INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  thumbnail_url TEXT,
  rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Enrollments Table
```sql
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  course_id UUID REFERENCES courses(id),
  purchased BOOLEAN DEFAULT false,
  progress_percent INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);
```

### Course Sections Table
```sql
CREATE TABLE course_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Course Lessons Table
```sql
CREATE TABLE course_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID REFERENCES course_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('video', 'document', 'link', 'quiz', 'assignment')),
  content_url TEXT,
  duration_minutes INTEGER,
  order_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### POST /api/signup
**Description:** Register new user

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "student" | "instructor"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": { ... }
}
```

#### POST /api/signin
**Description:** User login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "student",
  "paymentStatus": "completed"
}
```

#### GET /api/redirect?token={token}
**Description:** Validate token and redirect to dashboard

**Response:** HTML page with session injection

---

### Payment Endpoints

#### POST /api/create-instructor-payment
**Description:** Create Stripe checkout for instructor registration

**Request:**
```json
{
  "email": "instructor@example.com",
  "name": "Jane Doe",
  "userId": "uuid",
  "amount": 150000
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "publishableKey": "pk_test_..."
}
```

#### POST /api/verify-instructor-payment
**Description:** Verify payment and activate instructor account

**Request:**
```json
{
  "sessionId": "cs_test_...",
  "email": "instructor@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified and account activated",
  "user": { ... }
}
```

#### POST /api/enrollments/create-payment
**Description:** Create Stripe checkout for course enrollment

**Request:**
```json
{
  "courseId": "uuid",
  "email": "student@example.com",
  "userId": "uuid"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "publishableKey": "pk_test_..."
}
```

#### POST /api/enrollments/verify-payment
**Description:** Verify payment and enroll student

**Request:**
```json
{
  "sessionId": "cs_test_...",
  "courseId": "uuid",
  "userId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified and enrolled successfully",
  "enrollment": { ... }
}
```

---

### Course Endpoints

#### GET /api/courses
**Description:** Get all published courses

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Course Title",
      "description": "...",
      "price_cents": 29900,
      "instructor_id": "uuid",
      "rating": 4.5
    }
  ]
}
```

#### GET /api/courses/:id
**Description:** Get course by ID

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "title": "Course Title",
    "description": "...",
    "sections": [ ... ]
  }
}
```

#### POST /api/course-management/courses
**Description:** Create new course (instructors only)

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request:**
```json
{
  "title": "New Course",
  "description": "Course description",
  "category": "Programming",
  "level": "beginner",
  "price_cents": 29900
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "title": "New Course",
    ...
  }
}
```

#### PATCH /api/course-management/:courseId
**Description:** Update course

**Request:**
```json
{
  "title": "Updated Title",
  "is_published": true
}
```

#### DELETE /api/course-management/:courseId
**Description:** Delete course

---

### Enrollment Endpoints

#### POST /api/enrollments/enroll
**Description:** Enroll in free course

**Request:**
```json
{
  "course_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

#### GET /api/enrollments/mine
**Description:** Get user's enrollments

**Response:**
```json
{
  "data": [
    {
      "course_id": "uuid",
      "progress_percent": 45,
      "purchased": true,
      "course": { ... }
    }
  ]
}
```

---

### Profile Endpoints

#### GET /api/profiles/me
**Description:** Get current user profile

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "bio": "...",
    "stats": {
      "enrolled_courses": 5,
      "completed_courses": 2,
      "learning_hours": 12.5
    }
  }
}
```

#### PATCH /api/profiles/me
**Description:** Update user profile

**Request:**
```json
{
  "full_name": "John Doe",
  "bio": "Updated bio",
  "title": "Software Developer",
  "expertise": "JavaScript, React",
  "years_experience": 5
}
```

---

## Authentication & Security

### Token-Based Authentication

**Flow:**
```
1. User signs in
2. Backend validates credentials
3. Supabase returns JWT token
4. Frontend stores in sessionStorage
5. Token sent in Authorization header
6. Backend validates token for each request
```

**Token Storage:**
```javascript
// Stored in 3 keys for compatibility
sessionStorage.setItem('token', token);
sessionStorage.setItem('auth_token', token);
sessionStorage.setItem('supabase_token', token);
```

**Token Usage:**
```javascript
// Frontend
const token = sessionStorage.getItem('token');
fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Backend
const token = req.headers?.authorization?.replace('Bearer ', '');
const { data: userData } = await supabase.auth.getUser(token);
```

### Security Features

1. **Password Security**
   - Handled by Supabase Auth
   - Bcrypt hashing
   - Minimum 8 characters

2. **Row Level Security (RLS)**
   ```sql
   -- Example RLS policy
   CREATE POLICY "Users can view own enrollments"
   ON enrollments FOR SELECT
   USING (auth.uid() = user_id);
   ```

3. **Input Validation**
   - Server-side validation
   - SQL injection prevention
   - XSS protection

4. **File Upload Security**
   - File type validation
   - Size limits enforced
   - Virus scanning (recommended)

5. **CORS Configuration**
   ```javascript
   app.use(cors({
     origin: process.env.CORS_ORIGIN,
     credentials: true
   }));
   ```

---

## Payment Integration

### Stripe Configuration

**Test Mode:**
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
```

**Test Cards:**
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
```

### Payment Flow

**Instructor Registration:**
```
1. User signs up as instructor
2. Redirected to payment page
3. Click "Pay R 1,500"
4. Stripe Checkout opens
5. Enter card details
6. Payment processed
7. Webhook/verification
8. User metadata updated
9. Account activated
```

**Course Enrollment:**
```
1. Student clicks "Enroll Now"
2. System checks if paid course
3. Creates Stripe session
4. Redirects to Stripe Checkout
5. Payment processed
6. Returns to success page
7. Backend verifies payment
8. Creates enrollment record
9. Student can access course
```

### Webhook Setup (Production)

```javascript
// Stripe webhook endpoint
app.post('/webhook/stripe', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );
  
  // Handle event
  switch (event.type) {
    case 'checkout.session.completed':
      // Handle successful payment
      break;
  }
  
  res.json({received: true});
});
```

---

## File Upload System

### Upload Endpoints

**Video Upload:**
```javascript
POST /api/course-management/:courseId/upload-video
Content-Type: multipart/form-data

FormData:
- file: video file (max 50MB)
- sectionId: UUID
- lessonTitle: string
```

**Document Upload:**
```javascript
POST /api/course-management/:courseId/upload-document
Content-Type: multipart/form-data

FormData:
- file: document file (max 10MB)
- sectionId: UUID
- lessonTitle: string
```

### Storage Structure

```
Supabase Storage Buckets:
├── course-videos/
│   └── {courseId}/
│       └── {lessonId}.mp4
├── course-documents/
│   └── {courseId}/
│       └── {lessonId}.pdf
└── course-thumbnails/
    └── {courseId}.jpg
```

### File Validation

```javascript
// Server-side validation
const allowedVideoTypes = ['video/mp4'];
const allowedDocTypes = ['application/pdf', 'application/msword'];
const maxVideoSize = 50 * 1024 * 1024; // 50MB
const maxDocSize = 10 * 1024 * 1024;   // 10MB
```

---

## Deployment Guide

### Production Checklist

- [ ] Set NODE_ENV=production
- [ ] Use production Stripe keys
- [ ] Configure production database
- [ ] Set up SSL/HTTPS
- [ ] Configure domain
- [ ] Set up CDN (optional)
- [ ] Enable logging
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Test payment flow

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=443
CORS_ORIGIN=https://yourdomain.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=prod_key
SUPABASE_SERVICE_ROLE_KEY=prod_service_key
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
FRONTEND_URL=https://yourdomain.com
```

### Deployment Options

**1. Traditional VPS (DigitalOcean, Linode)**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone project
git clone <repo>
cd LearnTrack

# Install dependencies
npm install --production

# Use PM2 for process management
npm install -g pm2
pm2 start server.js --name learntrack
pm2 startup
pm2 save
```

**2. Platform as a Service (Heroku, Railway)**
```bash
# Heroku example
heroku create learntrack
heroku config:set SUPABASE_URL=...
heroku config:set SUPABASE_ANON_KEY=...
git push heroku main
```

**3. Serverless (Vercel, Netlify)**
- Deploy frontend as static site
- Deploy backend as serverless functions

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Troubleshooting

### Common Issues

**1. Server won't start**
```bash
# Check if port is in use
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3000 npm start
```

**2. Database connection fails**
```bash
# Verify Supabase credentials
# Check .env file
# Test connection:
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"
```

**3. File upload fails**
```bash
# Check file size
# Verify MIME type
# Check storage bucket permissions
# Review Supabase storage logs
```

**4. Payment not working**
```bash
# Verify Stripe keys
# Check test mode vs live mode
# Review Stripe dashboard logs
# Verify webhook endpoint
```

**5. Token errors**
```bash
# Clear browser cache
# Check token expiration
# Verify Supabase project URL
# Re-authenticate user
```

### Debug Mode

```javascript
// Enable detailed logging
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('Request:', req.body);
  console.log('Headers:', req.headers);
}
```

### Logging

```javascript
// Recommended: Winston logger
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

---

## Performance Optimization

### Database Indexing

```sql
-- Add indexes for common queries
CREATE INDEX idx_courses_instructor ON courses(instructor_id);
CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_courses_published ON courses(is_published);
```

### Caching Strategy

```javascript
// Example: Redis caching
const redis = require('redis');
const client = redis.createClient();

// Cache course list
app.get('/api/courses', async (req, res) => {
  const cached = await client.get('courses:all');
  if (cached) return res.json(JSON.parse(cached));
  
  // Fetch from database
  const courses = await fetchCourses();
  await client.setex('courses:all', 300, JSON.stringify(courses));
  res.json(courses);
});
```

### CDN Integration

```javascript
// Serve static assets via CDN
// CloudFlare, AWS CloudFront, etc.
app.use(express.static('public', {
  maxAge: '1d',
  etag: true
}));
```

---

## Monitoring & Analytics

### Health Check Endpoint

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### Error Tracking

```javascript
// Sentry integration
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });

app.use(Sentry.Handlers.errorHandler());
```

---

## API Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## Backup & Recovery

### Database Backup

```bash
# Supabase provides automatic backups
# Manual backup via pg_dump:
pg_dump -h db.supabase.co -U postgres -d postgres > backup.sql
```

### File Storage Backup

```bash
# Sync Supabase storage to S3
# Use rclone or similar tools
rclone sync supabase:bucket s3:backup-bucket
```

---

## Testing

### Unit Tests

```javascript
// Example with Jest
const request = require('supertest');
const app = require('./server');

describe('GET /api/courses', () => {
  it('should return courses', async () => {
    const res = await request(app)
      .get('/api/courses')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });
});
```

### Integration Tests

```javascript
// Test payment flow
describe('Payment Flow', () => {
  it('should create payment session', async () => {
    const res = await request(app)
      .post('/api/enrollments/create-payment')
      .send({ courseId: 'uuid', email: 'test@test.com' });
    expect(res.body.sessionId).toBeDefined();
  });
});
```

---

## Version Control

### Git Workflow

```bash
# Feature branch workflow
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# Create pull request
# Review and merge
```

### .gitignore

```
node_modules/
.env
*.log
.DS_Store
dist/
build/
```

---

## Support & Maintenance

### Regular Tasks

- [ ] Monitor error logs
- [ ] Review database performance
- [ ] Update dependencies
- [ ] Backup database
- [ ] Check storage usage
- [ ] Review security updates
- [ ] Test payment flow
- [ ] Monitor uptime

### Dependency Updates

```bash
# Check for updates
npm outdated

# Update packages
npm update

# Update major versions
npm install package@latest
```

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** Development Team
