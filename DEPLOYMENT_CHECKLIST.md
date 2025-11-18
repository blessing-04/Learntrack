# ✅ LearnTrack - Production Deployment Checklist

## Pre-Deployment Preparation

---

## 🔧 1. Environment Configuration

### Update .env File

- [ ] Copy `.env.production.example` to `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Update `PORT` (usually 443 for HTTPS or 80 for HTTP)
- [ ] Set `CORS_ORIGIN` to your production domain
- [ ] Update `FRONTEND_URL` to your production domain

### Supabase Configuration

- [ ] Create production Supabase project
- [ ] Copy production `SUPABASE_URL`
- [ ] Copy production `SUPABASE_ANON_KEY`
- [ ] Copy production `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Run `database-migration.sql` in production database
- [ ] Create storage buckets (course-videos, course-documents, course-thumbnails)
- [ ] Configure RLS policies
- [ ] Test database connection

### Stripe Configuration

- [ ] Switch Stripe dashboard to **Live Mode**
- [ ] Copy **Live** `STRIPE_SECRET_KEY` (sk_live_...)
- [ ] Copy **Live** `STRIPE_PUBLISHABLE_KEY` (pk_live_...)
- [ ] Update keys in `.env`
- [ ] Configure webhook endpoint: `https://yourdomain.com/webhook/stripe`
- [ ] Copy `STRIPE_WEBHOOK_SECRET`
- [ ] Test with small real payment

---

## 🌐 2. Domain & DNS Configuration

- [ ] Purchase domain name
- [ ] Configure DNS A record to point to server IP
- [ ] Configure DNS AAAA record (if using IPv6)
- [ ] Wait for DNS propagation (24-48 hours)
- [ ] Verify domain resolves: `nslookup yourdomain.com`

---

## 🔒 3. SSL/HTTPS Setup

- [ ] Install Certbot: `sudo apt install certbot python3-certbot-nginx`
- [ ] Generate SSL certificate: `sudo certbot --nginx -d yourdomain.com`
- [ ] Verify auto-renewal: `sudo certbot renew --dry-run`
- [ ] Test HTTPS access: `https://yourdomain.com`
- [ ] Force HTTPS redirect in Nginx

---

## 📦 4. Server Setup

### Install Dependencies

- [ ] Install Node.js 16+: `curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -`
- [ ] Install Node: `sudo apt-get install -y nodejs`
- [ ] Install PM2: `sudo npm install -g pm2`
- [ ] Install Nginx: `sudo apt install nginx -y`
- [ ] Verify installations

### Deploy Application

- [ ] Clone repository to server
- [ ] Navigate to project directory
- [ ] Run `npm install --production`
- [ ] Create `.env` file with production values
- [ ] Test locally: `node server.js`
- [ ] Start with PM2: `pm2 start server.js --name learntrack`
- [ ] Enable startup: `pm2 startup`
- [ ] Save PM2 config: `pm2 save`

---

## 🔧 5. Nginx Configuration

- [ ] Create Nginx config: `/etc/nginx/sites-available/learntrack`
- [ ] Add proxy configuration
- [ ] Enable site: `sudo ln -s /etc/nginx/sites-available/learntrack /etc/nginx/sites-enabled/`
- [ ] Test config: `sudo nginx -t`
- [ ] Restart Nginx: `sudo systemctl restart nginx`
- [ ] Verify proxy working

---

## 🧪 6. Testing (Production)

### Authentication Tests

- [ ] Sign up as student works
- [ ] Sign up as instructor works
- [ ] Instructor payment works (test with real card, small amount)
- [ ] Sign in works
- [ ] Token storage works
- [ ] Session persistence works

### Course Tests

- [ ] Create course works
- [ ] Upload video works
- [ ] Upload document works
- [ ] Publish course works
- [ ] Browse courses works
- [ ] Course detail page works

### Enrollment Tests

- [ ] Enroll in free course works
- [ ] Enroll in paid course works
- [ ] Payment processing works
- [ ] Enrollment verification works
- [ ] Access to enrolled course works

### Profile Tests

- [ ] View profile works
- [ ] Edit profile works
- [ ] Save profile works
- [ ] Profile data persists

### Payment Tests

- [ ] Instructor registration payment works
- [ ] Course enrollment payment works
- [ ] Payment verification works
- [ ] Stripe webhook works (if configured)
- [ ] Payment amounts correct

---

## 🔐 7. Security Verification

- [ ] HTTPS working (green padlock in browser)
- [ ] No mixed content warnings
- [ ] Security headers present (check with securityheaders.com)
- [ ] CORS configured correctly
- [ ] No API keys exposed in frontend
- [ ] `.env` file not accessible via web
- [ ] Rate limiting active (test with multiple requests)
- [ ] SQL injection prevention working
- [ ] XSS protection working

---

## 📊 8. Monitoring Setup

- [ ] Configure error tracking (Sentry, etc.)
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure log aggregation
- [ ] Set up performance monitoring
- [ ] Configure alerts for errors
- [ ] Set up backup monitoring

---

## 💾 9. Backup Configuration

- [ ] Database backup scheduled (Supabase auto-backup)
- [ ] Manual backup tested: `pg_dump`
- [ ] File storage backup configured
- [ ] Backup restoration tested
- [ ] Backup retention policy set

---

## 📧 10. Email Configuration (Optional)

- [ ] Configure SMTP settings
- [ ] Test welcome emails
- [ ] Test password reset emails
- [ ] Test payment confirmation emails
- [ ] Configure email templates

---

## 🎯 11. Performance Optimization

- [ ] Enable gzip compression in Nginx
- [ ] Configure browser caching
- [ ] Optimize images
- [ ] Minify CSS/JS (if not using CDN)
- [ ] Configure CDN (optional)
- [ ] Database indexes created
- [ ] Query optimization done

---

## 📱 12. Final Verification

### Functionality Check

- [ ] All pages load correctly
- [ ] All links work
- [ ] All forms submit correctly
- [ ] All API endpoints respond
- [ ] File uploads work
- [ ] Payments process correctly
- [ ] Emails send (if configured)

### Cross-Browser Testing

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers

### Device Testing

- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

---

## 🚀 13. Go Live

- [ ] Update DNS to point to production server
- [ ] Verify domain resolves
- [ ] Test all functionality on production domain
- [ ] Monitor logs for errors
- [ ] Announce launch
- [ ] Monitor user activity

---

## 📞 14. Post-Deployment

### Immediate (First 24 Hours)

- [ ] Monitor error logs continuously
- [ ] Check server resources (CPU, memory)
- [ ] Verify payments working
- [ ] Check database performance
- [ ] Monitor user signups
- [ ] Test all critical paths

### First Week

- [ ] Review error logs daily
- [ ] Monitor payment success rate
- [ ] Check user feedback
- [ ] Optimize slow queries
- [ ] Fix any reported bugs
- [ ] Update documentation if needed

### Ongoing

- [ ] Weekly log reviews
- [ ] Monthly security updates
- [ ] Quarterly dependency updates
- [ ] Regular backups verification
- [ ] Performance monitoring
- [ ] User feedback collection

---

## 🆘 Rollback Plan

If critical issues occur:

### Quick Rollback

```bash
# Stop current version
pm2 stop learntrack

# Restore previous version
cd /var/www/learntrack
git checkout <previous-working-commit>
npm install --production
pm2 restart learntrack
```

### Database Rollback

```bash
# Restore from backup
psql -h db.supabase.co -U postgres -d postgres < backup.sql
```

### Emergency Contacts

- System Admin: [phone/email]
- Database Admin: [phone/email]
- DevOps Team: [phone/email]

---

## ✅ Deployment Sign-Off

**Deployed By:** ___________________  
**Date:** ___________________  
**Time:** ___________________  
**Version:** 1.0.0  

**Verification:**
- [ ] All checklist items completed
- [ ] All tests passed
- [ ] Monitoring active
- [ ] Backups configured
- [ ] Team notified

**Signature:** ___________________

---

## 📊 Deployment Metrics

**Target Metrics:**
- Uptime: 99.9%
- Response time: < 500ms
- Error rate: < 0.1%
- Payment success rate: > 99%

**Monitor these in first week!**

---

**Status:** Ready for Deployment ✅  
**Last Updated:** October 2025
