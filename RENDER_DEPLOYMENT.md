# 🚀 LearnTrack - Render Deployment Guide

## Deploy to Render.com (All-in-One Deployment)

---

## ✅ Why Render?

- **Simple:** Deploy in minutes
- **Free Tier:** Available for testing
- **Automatic HTTPS:** SSL included
- **Auto-Deploy:** Push to Git, auto-deploys
- **All-in-One:** Frontend + Backend together
- **No Server Management:** Fully managed

---

## 📋 Prerequisites

Before deploying to Render:

1. ✅ **GitHub Account** (or GitLab/Bitbucket)
2. ✅ **Render Account** (free at [render.com](https://render.com))
3. ✅ **Supabase Production Project** (free at [supabase.com](https://supabase.com))
4. ✅ **Stripe Account** (for payments)

---

## 🚀 Deployment Steps

### Step 1: Prepare Your Repository

#### 1.1 Push to GitHub

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Ready for Render deployment"

# Create GitHub repository and push
git remote add origin https://github.com/yourusername/learntrack.git
git branch -M main
git push -u origin main
```

#### 1.2 Verify render.yaml

The `render.yaml` file is already created in your project root. This tells Render how to deploy your app.

---

### Step 2: Set Up Supabase (Production)

1. **Go to:** [supabase.com](https://supabase.com)
2. **Create new project**
3. **Run database migration:**
   - Go to SQL Editor
   - Copy contents of `database-migration.sql`
   - Execute
4. **Create storage buckets:**
   - Go to Storage
   - Create: `course-videos` (Private, 50MB limit)
   - Create: `course-documents` (Private, 10MB limit)
   - Create: `course-thumbnails` (Public, 5MB limit)
5. **Get API keys:**
   - Settings → API
   - Copy `URL`, `anon key`, and `service_role key`

---

### Step 3: Get Stripe Keys

1. **Go to:** [stripe.com](https://stripe.com)
2. **Create account** (or sign in)
3. **For Testing:** Use test mode keys
   - Developers → API Keys
   - Copy `Publishable key` (pk_test_...)
   - Copy `Secret key` (sk_test_...)
4. **For Production:** Switch to live mode
   - Toggle "View test data" OFF
   - Copy live keys (pk_live_... and sk_live_...)

---

### Step 4: Deploy to Render

#### 4.1 Create New Web Service

1. **Go to:** [dashboard.render.com](https://dashboard.render.com)
2. **Click:** "New +" → "Web Service"
3. **Connect:** Your GitHub repository
4. **Select:** LearnTrack repository

#### 4.2 Configure Service

**Basic Settings:**
- **Name:** `learntrack` (or your choice)
- **Region:** Choose closest to your users
- **Branch:** `main`
- **Root Directory:** (leave empty - uses project root)
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

**Instance Type:**
- **Free:** For testing (sleeps after inactivity)
- **Starter ($7/month):** For production (always on)

#### 4.3 Add Environment Variables

Click "Advanced" → "Add Environment Variable"

Add these one by one:

```
NODE_ENV = production

CORS_ORIGIN = https://your-app-name.onrender.com

SUPABASE_URL = https://your-project.supabase.co

SUPABASE_ANON_KEY = your_anon_key_here

SUPABASE_SERVICE_ROLE_KEY = your_service_role_key_here

STRIPE_SECRET_KEY = sk_test_your_key (or sk_live_ for production)

STRIPE_PUBLISHABLE_KEY = pk_test_your_key (or pk_live_ for production)

FRONTEND_URL = https://your-app-name.onrender.com
```

**Important:** Replace `your-app-name` with your actual Render app name!

#### 4.4 Deploy

1. **Click:** "Create Web Service"
2. **Wait:** Render will build and deploy (2-5 minutes)
3. **Watch:** Build logs in real-time
4. **Success:** You'll see "Your service is live 🎉"

---

### Step 5: Update CORS_ORIGIN and FRONTEND_URL

After first deployment, you'll get your Render URL (e.g., `https://learntrack.onrender.com`)

1. **Go to:** Render Dashboard → Your Service → Environment
2. **Update these variables:**
   ```
   CORS_ORIGIN = https://learntrack.onrender.com
   FRONTEND_URL = https://learntrack.onrender.com
   ```
3. **Save Changes** (will auto-redeploy)

---

### Step 6: Configure Stripe Webhooks (Optional but Recommended)

1. **Go to:** Stripe Dashboard → Developers → Webhooks
2. **Add endpoint:** `https://your-app-name.onrender.com/webhook/stripe`
3. **Select events:** `checkout.session.completed`
4. **Copy webhook secret:** `whsec_...`
5. **Add to Render environment variables:**
   ```
   STRIPE_WEBHOOK_SECRET = whsec_your_secret
   ```

---

## ✅ Verify Deployment

### Test Your Deployed Application

1. **Visit:** `https://your-app-name.onrender.com`
2. **Test sign up** (student and instructor)
3. **Test instructor payment** (use test card: 4242 4242 4242 4242)
4. **Test sign in**
5. **Test course creation**
6. **Test course enrollment**
7. **Test course payment**

### Check Health Endpoint

Visit: `https://your-app-name.onrender.com/api/health`

Should return:
```json
{
  "ok": true,
  "service": "learntrack-api",
  "time": "2025-10-02T..."
}
```

---

## 🔧 Render-Specific Configuration

### Auto-Deploy from Git

Render automatically redeploys when you push to your main branch:

```bash
# Make changes
git add .
git commit -m "Update feature"
git push origin main

# Render automatically detects and redeploys!
```

### Custom Domain (Optional)

1. **Go to:** Render Dashboard → Your Service → Settings
2. **Click:** "Add Custom Domain"
3. **Enter:** `yourdomain.com`
4. **Configure DNS:** Add CNAME record as instructed
5. **Wait:** SSL certificate auto-generated

---

## 💡 Render Free Tier Limitations

### Free Tier:
- ✅ 750 hours/month
- ✅ Automatic HTTPS
- ⚠️ Sleeps after 15 min inactivity
- ⚠️ Cold start (30-60 seconds)

### Starter Tier ($7/month):
- ✅ Always on
- ✅ No sleep
- ✅ Faster
- ✅ Better for production

---

## 🐛 Troubleshooting

### Build Fails

**Check:**
- Build logs in Render dashboard
- Verify `package.json` has correct dependencies
- Ensure Node version compatible

**Solution:**
```bash
# Test locally first
npm install
npm start
```

### App Crashes on Start

**Check:**
- Environment variables set correctly
- Supabase credentials valid
- Port configuration (Render uses PORT env variable)

**Solution:**
- Review logs in Render dashboard
- Verify all environment variables

### CORS Errors

**Check:**
- `CORS_ORIGIN` matches your Render URL
- Include `https://` in the URL

**Solution:**
```
CORS_ORIGIN = https://your-app-name.onrender.com
```

### Payment Not Working

**Check:**
- Stripe keys are correct (test vs live)
- `FRONTEND_URL` matches Render URL
- Webhook configured (if using)

**Solution:**
- Verify Stripe keys in environment variables
- Check Stripe dashboard for errors

---

## 🔄 Updating Your Deployment

### Method 1: Git Push (Automatic)

```bash
# Make changes
git add .
git commit -m "Update"
git push origin main

# Render auto-deploys!
```

### Method 2: Manual Deploy

1. Go to Render Dashboard
2. Click "Manual Deploy" → "Deploy latest commit"

### Method 3: Rollback

1. Go to Render Dashboard → Deploys
2. Find previous successful deploy
3. Click "Rollback to this version"

---

## 📊 Monitoring on Render

### View Logs

1. **Go to:** Render Dashboard → Your Service
2. **Click:** "Logs" tab
3. **See:** Real-time application logs

### View Metrics

1. **Go to:** Render Dashboard → Your Service
2. **Click:** "Metrics" tab
3. **See:** CPU, Memory, Request metrics

---

## 💰 Cost Estimate

### Free Tier:
- **Cost:** $0/month
- **Good for:** Testing, development, low-traffic

### Starter Tier:
- **Cost:** $7/month
- **Good for:** Production, always-on, better performance

### Professional Tier:
- **Cost:** $25/month
- **Good for:** High traffic, scaling needs

---

## ✅ Render Deployment Checklist

- [ ] GitHub repository created and pushed
- [ ] Render account created
- [ ] Supabase production project created
- [ ] Database migration run
- [ ] Storage buckets created
- [ ] Stripe keys obtained
- [ ] Web service created on Render
- [ ] Environment variables added
- [ ] First deployment successful
- [ ] CORS_ORIGIN updated with Render URL
- [ ] FRONTEND_URL updated with Render URL
- [ ] Application tested on Render URL
- [ ] All features working
- [ ] Payments tested
- [ ] Custom domain configured (optional)

---

## 🎯 Quick Render Deployment (Summary)

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial commit"
git push origin main

# 2. On Render.com:
- New Web Service
- Connect GitHub repo
- Add environment variables
- Deploy!

# 3. Update URLs:
- CORS_ORIGIN = https://your-app.onrender.com
- FRONTEND_URL = https://your-app.onrender.com

# 4. Test:
- Visit your Render URL
- Test all features
- Done! ✅
```

---

## 🌟 Advantages of Render

### vs Traditional VPS:
- ✅ No server management
- ✅ Automatic HTTPS
- ✅ Auto-scaling
- ✅ Built-in monitoring
- ✅ Easy rollbacks
- ✅ Git-based deployment

### vs Heroku:
- ✅ More generous free tier
- ✅ Better performance
- ✅ Simpler pricing
- ✅ Modern platform

---

## 📝 Post-Deployment

### After Successful Deployment:

1. **Test Everything:**
   - Sign up (student & instructor)
   - Instructor payment
   - Sign in
   - Create course
   - Enroll in course
   - Course payment
   - Profile updates

2. **Monitor:**
   - Check logs regularly
   - Monitor error rates
   - Watch performance metrics

3. **Update Documentation:**
   - Note your Render URL
   - Document any custom configuration

---

## 🔗 Useful Render Links

- **Dashboard:** https://dashboard.render.com
- **Docs:** https://render.com/docs
- **Status:** https://status.render.com
- **Support:** https://render.com/support

---

## ✅ Your Render URL

After deployment, your app will be at:

```
https://your-app-name.onrender.com
```

**Landing Page:**
```
https://your-app-name.onrender.com/landing.html
```

**API Health Check:**
```
https://your-app-name.onrender.com/api/health
```

---

## 🎉 That's It!

Deploying to Render is **much simpler** than traditional deployment:

- ✅ No server setup
- ✅ No Nginx configuration
- ✅ No SSL certificates to manage
- ✅ No PM2 configuration
- ✅ Just push and deploy!

**Your LearnTrack app will be live in minutes!** 🚀

---

**Next Steps:**
1. Push code to GitHub
2. Connect to Render
3. Add environment variables
4. Deploy!

**See you online!** 🌐
