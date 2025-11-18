# 🚀 Deploy LearnTrack to Render - Quick Guide

## Easiest Way to Deploy (All-in-One)

---

## ✅ What You Need

1. **GitHub Account** (free)
2. **Render Account** (free at render.com)
3. **Supabase Account** (free at supabase.com)
4. **Stripe Account** (for payments)

---

## 🚀 5-Step Deployment

### Step 1: Push to GitHub (5 minutes)

```bash
# In your LearnTrack folder
git init
git add .
git commit -m "Ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/yourusername/learntrack.git
git branch -M main
git push -u origin main
```

---

### Step 2: Set Up Supabase (10 minutes)

1. Go to **supabase.com** → Create project
2. **SQL Editor** → Run `database-migration.sql`
3. **Storage** → Create buckets:
   - `course-videos` (Private, 50MB)
   - `course-documents` (Private, 10MB)
   - `course-thumbnails` (Public, 5MB)
4. **Settings → API** → Copy these:
   - URL
   - anon key
   - service_role key

---

### Step 3: Get Stripe Keys (5 minutes)

1. Go to **stripe.com** → Sign up/Sign in
2. **Developers → API Keys**
3. Copy:
   - Publishable key (pk_test_...)
   - Secret key (sk_test_...)

---

### Step 4: Deploy on Render (10 minutes)

1. **Go to:** render.com → Sign up/Sign in
2. **Click:** "New +" → "Web Service"
3. **Connect:** Your GitHub repository
4. **Configure:**
   - Name: `learntrack`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free (or Starter for production)

5. **Add Environment Variables:**

Click "Advanced" → Add these:

```
NODE_ENV = production

CORS_ORIGIN = https://learntrack.onrender.com
(Replace 'learntrack' with your app name)

SUPABASE_URL = (paste from Supabase)

SUPABASE_ANON_KEY = (paste from Supabase)

SUPABASE_SERVICE_ROLE_KEY = (paste from Supabase)

STRIPE_SECRET_KEY = (paste from Stripe)

STRIPE_PUBLISHABLE_KEY = (paste from Stripe)

FRONTEND_URL = https://learntrack.onrender.com
(Replace 'learntrack' with your app name)
```

6. **Click:** "Create Web Service"

---

### Step 5: Wait & Test (5 minutes)

1. **Wait** for build to complete (2-5 minutes)
2. **Your app will be live at:** `https://your-app-name.onrender.com`
3. **Test:**
   - Visit the URL
   - Sign up as student
   - Sign up as instructor (test payment)
   - Create a course
   - Enroll in a course

---

## 🎉 That's It!

Your LearnTrack platform is now **LIVE** on the internet!

**Your URL:** `https://your-app-name.onrender.com`

---

## 🧪 Test Payment

Use Stripe test card:
```
Card: 4242 4242 4242 4242
Expiry: 12/34
CVC: 123
ZIP: 12345
```

---

## ⚠️ Important Notes

### Free Tier Limitations:
- App sleeps after 15 min inactivity
- First request after sleep takes 30-60 seconds (cold start)
- Good for testing, not ideal for production

### For Production:
- Upgrade to **Starter plan ($7/month)**
- App stays always on
- No cold starts
- Better performance

---

## 🔄 Updating Your App

### After making changes:

```bash
git add .
git commit -m "Update feature"
git push origin main

# Render auto-deploys! ✅
```

---

## 🐛 Troubleshooting

### Build Fails?
- Check build logs in Render dashboard
- Verify package.json is correct
- Test locally: `npm install && npm start`

### App Crashes?
- Check logs in Render dashboard
- Verify all environment variables are set
- Check Supabase credentials

### CORS Errors?
- Verify `CORS_ORIGIN` matches your Render URL exactly
- Include `https://` in the URL

### Payment Not Working?
- Verify Stripe keys are correct
- Check `FRONTEND_URL` matches Render URL
- Test with Stripe test card

---

## 📊 Monitor Your App

**Render Dashboard:**
- **Logs:** Real-time application logs
- **Metrics:** CPU, Memory, Requests
- **Events:** Deployments, crashes, restarts

**Access:** dashboard.render.com → Your Service

---

## 💰 Pricing

**Free Tier:**
- 750 hours/month
- Sleeps after inactivity
- Good for testing

**Starter ($7/month):**
- Always on
- No sleep
- Better for production

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Supabase project created
- [ ] Database migrated
- [ ] Storage buckets created
- [ ] Stripe keys obtained
- [ ] Render web service created
- [ ] Environment variables added
- [ ] Deployment successful
- [ ] App tested and working
- [ ] All features verified

---

## 🎊 Success!

**Your LearnTrack platform is live!**

Share your URL: `https://your-app-name.onrender.com`

**For detailed guide:** See `RENDER_DEPLOYMENT.md`

---

**Deployment Time:** ~35 minutes total  
**Difficulty:** Easy  
**Cost:** Free (or $7/month for production)  
**Status:** ✅ READY TO DEPLOY
