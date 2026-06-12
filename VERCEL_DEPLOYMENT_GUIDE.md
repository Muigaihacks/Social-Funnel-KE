# Vercel Deployment Guide

## 📋 Step-by-Step Deployment

### 1. Prepare Your Backend URL

**IMPORTANT**: Your frontend on Vercel needs a **publicly accessible backend URL** to communicate with your backend API and PostgreSQL database.

#### Option A: Deploy Backend to Cloud (Recommended)
Deploy your backend to one of these platforms:
- **Railway** (easiest): railway.app
- **Render**: render.com
- **AWS EC2** / **GCP Compute Engine**
- **DigitalOcean Droplets**

#### Option B: Expose Local Backend (Testing Only)
Use ngrok to temporarily expose your local backend:
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 4000

# Copy the forwarding URL (e.g., https://abc123.ngrok.io)
```

**⚠️ Note**: ngrok URLs change on restart. For production, use Option A.

---

### 2. Deploy Frontend to Vercel

#### Step 2.1: Go to Vercel Dashboard
1. Visit [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**

#### Step 2.2: Import Repository
1. Click **"Import Git Repository"**
2. Select your GitHub account
3. Choose: **`Muigaihacks/Social-Funnel-KE`**
4. Click **"Import"**

#### Step 2.3: Configure Project Settings

**Framework Preset**: Next.js ✅ (auto-detected)

**Root Directory**: 
- Click **"Edit"** next to Root Directory
- Set to: `apps/frontend`
- Click **"Continue"**

**Build Settings** (auto-detected, verify these):
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

#### Step 2.4: Environment Variables

Click **"Environment Variables"** and add:

| Name | Value | Example |
|------|-------|---------|
| `NEXT_PUBLIC_API_URL` | Your backend URL | `https://your-backend.railway.app` |
| `NEXT_PUBLIC_ENV` | `staging` or `production` | `staging` |

**Important Notes**:
- `NEXT_PUBLIC_API_URL` must be publicly accessible (no `localhost`!)
- Remove trailing slashes from URLs
- Use `https://` for production

#### Step 2.5: Deploy
1. Click **"Deploy"**
2. Wait 2-3 minutes for the build
3. Once complete, you'll get a URL like: `https://social-funnel-ke.vercel.app`

---

## 🏗️ Architecture: How Everything Communicates

### Current Local Setup
```
┌─────────────────┐
│  Frontend       │
│  localhost:3000 │──┐
└─────────────────┘  │
                     │ API calls
┌─────────────────┐  │
│  Backend        │◄─┘
│  localhost:4000 │──┐
└─────────────────┘  │
                     │ Database queries
┌─────────────────┐  │
│  PostgreSQL     │◄─┘
│  localhost:5432 │
└─────────────────┘
       ▲
       │ Webhooks
┌─────────────────┐
│  n8n (Docker)   │
│  localhost:5678 │
└─────────────────┘
```

### Production Setup (Recommended)

```
┌──────────────────────┐
│  Frontend (Vercel)   │
│  yourapp.vercel.app  │──┐
└──────────────────────┘  │
                          │ HTTPS API calls
┌──────────────────────┐  │
│  Backend (Railway)   │◄─┘
│  api.yourapp.com     │──┐
└──────────────────────┘  │
                          │ Direct connection
┌──────────────────────┐  │
│  PostgreSQL          │◄─┘
│  (Railway DB)        │
└──────────────────────┘
       ▲
       │ Webhooks (public URL)
┌──────────────────────┐
│  n8n (Railway/GCP)   │
│  n8n.yourapp.com     │
└──────────────────────┘
```

---

## 🔌 Making It All Work Together

### Scenario 1: Frontend on Vercel, Backend Local (Testing)

**Problem**: Vercel can't access `localhost:4000`

**Solution**: Use ngrok to expose your local backend
```bash
# Terminal 1: Start backend
cd apps/backend
npm run dev

# Terminal 2: Expose backend
ngrok http 4000
# Copy the URL: https://abc123.ngrok.io

# Terminal 3: Update Vercel environment variable
# Go to: vercel.com/dashboard → Your Project → Settings → Environment Variables
# Set NEXT_PUBLIC_API_URL = https://abc123.ngrok.io
# Redeploy: vercel.com/dashboard → Your Project → Deployments → Redeploy
```

### Scenario 2: Everything on Cloud (Production Ready) ✅

1. **Deploy Backend to Railway**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and deploy
   railway login
   cd apps/backend
   railway init
   railway up
   
   # Add PostgreSQL
   railway add postgresql
   
   # Get your backend URL
   railway domain
   # Example: https://your-backend.railway.app
   ```

2. **Deploy n8n to Railway** (or keep on Docker):
   - n8n can call Railway backend via public URL
   - Configure n8n webhook base URL to your Railway domain
   - Update `INTERNAL_AUTOMATION_SECRET` environment variable

3. **Configure Vercel**:
   - Set `NEXT_PUBLIC_API_URL` to Railway backend URL
   - Redeploy frontend

---

## 🔐 Environment Variables Reference

### Frontend (Vercel)
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_ENV=staging  # or "production"
```

### Backend (Railway)
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-key
INTERNAL_AUTOMATION_SECRET=your-automation-secret
RESEND_API_KEY=re_xxxxx
OPENAI_API_KEY=sk-xxxxx
NODE_ENV=production
PORT=4000
```

### n8n (Docker/Railway)
```env
N8N_HOST=n8n.yourapp.com
WEBHOOK_URL=https://n8n.yourapp.com
GENERIC_TIMEZONE=Africa/Nairobi
BACKEND_API_URL=https://your-backend.railway.app
BACKEND_SECRET=your-automation-secret
```

---

## 🧪 Testing After Deployment

1. **Test Frontend**:
   - Visit: `https://yourapp.vercel.app/admin/login`
   - Check environment badge (should show "Staging")
   - Try logging in

2. **Test API Connection**:
   - Open browser DevTools → Network
   - API calls should go to your Railway backend
   - Check for CORS errors

3. **Test n8n Workflows**:
   - Trigger a test workflow
   - Verify it can reach the backend API
   - Check workflow heartbeats appear in dashboard

---

## 🚨 Common Issues & Solutions

### Issue: "Failed to fetch" errors
**Cause**: `NEXT_PUBLIC_API_URL` not set or incorrect  
**Fix**: Add/update env var in Vercel → Redeploy

### Issue: CORS errors
**Cause**: Backend CORS not configured for Vercel domain  
**Fix**: Add Vercel domain to backend CORS whitelist:
```typescript
// apps/backend/src/index.ts
app.use(cors({
  origin: ['https://yourapp.vercel.app', 'http://localhost:3000'],
  credentials: true
}));
```

### Issue: n8n can't reach backend
**Cause**: Backend not publicly accessible  
**Fix**: Deploy backend to cloud or use ngrok

### Issue: Database connection fails
**Cause**: Backend can't reach PostgreSQL  
**Fix**: Ensure `DATABASE_URL` is set correctly in Railway

---

## 📝 Post-Deployment Checklist

- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Railway (or cloud provider)
- [ ] PostgreSQL accessible from backend
- [ ] `NEXT_PUBLIC_API_URL` set in Vercel
- [ ] `NEXT_PUBLIC_ENV` set to `staging` or `production`
- [ ] n8n configured with public backend URL
- [ ] Test login functionality
- [ ] Test API calls (check Network tab)
- [ ] Test n8n workflows can reach backend
- [ ] Verify workflow heartbeats appear in dashboard
- [ ] Custom domain configured (optional)

---

## 🎯 Next Steps

1. **Deploy Backend First**: Get your backend running on Railway/cloud
2. **Get Backend URL**: Note the public URL
3. **Deploy Frontend**: Follow Vercel steps above with backend URL
4. **Test Everything**: Verify all integrations work
5. **Configure Custom Domain** (optional): Vercel → Settings → Domains

---

Need help? Check:
- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Next.js Docs: https://nextjs.org/docs
