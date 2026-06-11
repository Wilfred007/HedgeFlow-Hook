# HedgeFlow Backend Deployment Guide (Render)

## Overview
This guide covers deploying all HedgeFlow backend services to Render.com.

**Services to Deploy:**
1. ✅ Risk Engine (Python/FastAPI) - DEPLOYED
2. API Service (Node.js)
3. Indexer Service (Node.js)
4. Automation Service (Node.js)
5. PostgreSQL Database
6. Redis Cache

---

## Prerequisites

1. **GitHub Repository:** Push your code to GitHub
2. **Render Account:** Sign up at [render.com](https://render.com)
3. **Environment Variables:** Prepare your `.env` values

---

## Step 1: Deploy PostgreSQL Database

### Create PostgreSQL Instance

1. Go to Render Dashboard → **New** → **PostgreSQL**
2. Configure:
   - **Name:** `hedgeflow-db`
   - **Database:** `hedgeflow`
   - **User:** `hedgeflow_user`
   - **Region:** Oregon (us-west)
   - **Plan:** Free (or Starter for production)
3. Click **Create Database**
4. **Save the connection details:**
   - Internal Database URL (use this in your services)
   - External Database URL (for local testing)

**Example Internal URL:**
```
postgresql://hedgeflow_user:password@dpg-xxxxx/hedgeflow
```

---

## Step 2: Deploy Redis Cache

### Create Redis Instance

1. Go to Render Dashboard → **New** → **Redis**
2. Configure:
   - **Name:** `hedgeflow-redis`
   - **Region:** Oregon (us-west) - same as database
   - **Plan:** Free (or Starter for production)
   - **Maxmemory Policy:** `allkeys-lru`
3. Click **Create Redis**
4. **Save the connection details:**
   - Internal Redis URL

**Example Internal URL:**
```
redis://red-xxxxx:6379
```

---

## Step 3: Deploy Risk Engine (Already Done ✅)

**Deployed URL:** `https://hedgeflow-risk-engine.onrender.com`

If you need to redeploy:
1. New → **Web Service**
2. Connect GitHub repo `HedgeFlow-Hook`
3. Configure:
   - **Name:** `hedgeflow-risk-engine`
   - **Region:** Oregon
   - **Root Directory:** `backend/risk-engine`
   - **Environment:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add Environment Variables:
   - `GROQ_API_KEY` = `your_groq_key`
   - `PORT` = `8000`

---

## Step 4: Deploy API Service

### Create Web Service

1. Go to Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repository: `Wilfred007/HedgeFlow-Hook`
3. Configure:
   - **Name:** `hedgeflow-api`
   - **Region:** Oregon (us-west)
   - **Root Directory:** `backend` ⚠️ **Important: Use `backend`, not `backend/api`**
   - **Environment:** Docker
   - **Dockerfile Path:** `api/Dockerfile`
   - **Plan:** Free (or Starter for production)

4. **Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=<postgres_internal_url>
   REDIS_URL=<redis_internal_url>
   UNICHAIN_RPC_URL=https://sepolia.unichain.org
   PRIVATE_KEY=<your_private_key>
   HEDGEFLOW_HOOK_ADDRESS=<your_hook_address>
   RISK_ENGINE_URL=https://hedgeflow-risk-engine.onrender.com
   ```

5. Click **Create Web Service**

**Service will be available at:** `https://hedgeflow-api.onrender.com`

---

## Step 5: Deploy Indexer Service

### Create Background Worker

1. Go to Render Dashboard → **New** → **Background Worker**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `hedgeflow-indexer`
   - **Region:** Oregon (us-west)
   - **Root Directory:** `backend` ⚠️ **Important: Use `backend`, not `backend/indexer`**
   - **Environment:** Docker
   - **Dockerfile Path:** `indexer/Dockerfile`
   - **Plan:** Free (or Starter)

4. **Environment Variables:**
   ```
   NODE_ENV=production
   DATABASE_URL=<postgres_internal_url>
   REDIS_URL=<redis_internal_url>
   UNICHAIN_RPC_URL=https://sepolia.unichain.org
   HEDGEFLOW_HOOK_ADDRESS=<your_hook_address>
   RESERVE_VAULT_ADDRESS=<your_vault_address>
   RISK_MANAGER_ADDRESS=<your_risk_manager_address>
   ORACLE_MANAGER_ADDRESS=<your_oracle_address>
   FEE_ROUTER_ADDRESS=<your_fee_router_address>
   ```

5. Click **Create Background Worker**

---

## Step 6: Deploy Automation Service

### Create Background Worker

1. Go to Render Dashboard → **New** → **Background Worker**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `hedgeflow-automation`
   - **Region:** Oregon (us-west)
   - **Root Directory:** `backend` ⚠️ **Important: Use `backend`, not `backend/automation`**
   - **Environment:** Docker
   - **Dockerfile Path:** `automation/Dockerfile`
   - **Plan:** Free (or Starter)

4. **Environment Variables:**
   ```
   NODE_ENV=production
   DATABASE_URL=<postgres_internal_url>
   REDIS_URL=<redis_internal_url>
   UNICHAIN_RPC_URL=https://sepolia.unichain.org
   PRIVATE_KEY=<your_automation_private_key>
   HEDGEFLOW_HOOK_ADDRESS=<your_hook_address>
   RISK_MANAGER_ADDRESS=<your_risk_manager_address>
   RISK_ENGINE_URL=https://hedgeflow-risk-engine.onrender.com
   ```

5. Click **Create Background Worker**

---

## Step 7: Update Frontend Environment Variables

Update your Vercel deployment with the new backend URLs:

### Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update:
   ```
   NEXT_PUBLIC_RISK_ENGINE_URL=https://hedgeflow-risk-engine.onrender.com
   NEXT_PUBLIC_API_URL=https://hedgeflow-api.onrender.com
   NEXT_PUBLIC_PRIVY_APP_ID=cmptt7njw00ca0bl48x0xdl19
   NEXT_PUBLIC_HEDGEFLOW_HOOK_ADDRESS=<your_hook_address>
   NEXT_PUBLIC_POOL_ID=<your_pool_id>
   ```

3. Redeploy your frontend from Vercel Dashboard

---

## Step 8: Verify Deployment

### Health Checks

**Risk Engine:**
```bash
curl https://hedgeflow-risk-engine.onrender.com/health
```

**API Service:**
```bash
curl https://hedgeflow-api.onrender.com/health
```

### Test AI Integration

Visit your frontend: `https://hedge-flow-hook.vercel.app/ai-test`
- Try the preset scenarios
- Enable AI Sentiment Analysis
- Verify it connects to the deployed Risk Engine

---

## Important Notes

### ⚠️ Root Directory Setting
- For all Node.js services (API, Indexer, Automation): Set **Root Directory** to `backend` (parent folder)
- For Risk Engine: Set **Root Directory** to `backend/risk-engine`
- The Dockerfiles are configured to work with this setup

### 🔒 Security
- Never commit `.env` files
- Use Render's environment variables for all secrets
- Rotate keys regularly

### 💰 Cost Management
- **Free Tier Limits:**
  - Web Services: Spin down after 15 minutes of inactivity
  - Background Workers: 750 hours/month
  - PostgreSQL: 1GB storage, expires after 90 days
  - Redis: 25MB storage

- **Production Recommendations:**
  - Upgrade to Starter plan ($7/month per service) for always-on
  - Use Starter PostgreSQL for persistent storage
  - Consider shared resources for cost optimization

### 🚀 Deployment Tips
- **Auto-Deploy:** Enable on GitHub push in Render settings
- **Build Times:** Node.js builds take ~2-3 minutes, Python ~1 minute
- **Logs:** Monitor logs in Render Dashboard → Service → Logs
- **Rollback:** Use Render's manual deploy feature to rollback

---

## Troubleshooting

### Docker Build Fails
**Error:** `"/shared/package.json": not found`
**Solution:** Verify Root Directory is set to `backend` (not the service subfolder)

### Service Won't Start
**Check:**
1. Environment variables are set correctly
2. Database/Redis URLs are using **internal URLs** (not external)
3. Logs in Render Dashboard for specific errors

### Database Connection Issues
**Solutions:**
1. Verify `DATABASE_URL` is the internal URL from Render
2. Check PostgreSQL instance is running
3. Ensure services are in the same region (Oregon)

### Frontend Can't Connect
**Check:**
1. Vercel environment variables are updated
2. CORS is enabled in API service
3. Services are not spinning down (upgrade to paid plan)

---

## Quick Reference

**Service URLs:**
- Risk Engine: `https://hedgeflow-risk-engine.onrender.com`
- API: `https://hedgeflow-api.onrender.com` (after deployment)
- Frontend: `https://hedge-flow-hook.vercel.app`

**Internal Services:**
- PostgreSQL: `postgresql://hedgeflow_user:xxx@dpg-xxx/hedgeflow`
- Redis: `redis://red-xxx:6379`

**Support:**
- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
