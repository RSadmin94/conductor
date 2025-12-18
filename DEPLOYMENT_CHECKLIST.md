# Deployment Checklist - Railway

## Phase 1: Pre-Deployment ✅

- [x] Critical traps fixed
  - [x] Trap A: Workers check DATABASE_URL and REDIS_URL
  - [x] Trap B: PORT read from env (no hardcoded)
  - [x] Trap C: Schema includes all fields (stage, etc.)
  - [x] Trap D: .gitignore created

- [x] Deployment files created
  - [x] railway.json
  - [x] railway.toml
  - [x] Procfile
  - [x] src/worker-all.js
  - [x] smoke-test.js
  - [x] schema/complete_schema.sql

## Phase 2: GitHub Push

```bash
git init
git add .
git commit -m "Deploy to Railway"
git remote add origin <your-repo-url>
git push -u origin main
```

**Verify:** GitHub push succeeds before proceeding

## Phase 3: Railway Deployment

1. **Create Railway Project:**
   - Go to railway.app
   - New Project → Deploy from GitHub
   - Select repository

2. **Add Services:**
   - PostgreSQL service (auto-provisioned)
   - Redis service (auto-provisioned)
   - Web service (from GitHub)

3. **Set Environment Variables:**
   - `DATABASE_URL` - From PostgreSQL service (auto-set)
   - `REDIS_URL` - From Redis service (auto-set)
   - `PORT` - Auto-set by Railway

4. **Deploy:**
   - Railway auto-deploys on push
   - Monitor build logs

## Phase 4: Run Migration

**Option A: Railway CLI**
```bash
railway run psql $DATABASE_URL -f schema/complete_schema.sql
```

**Option B: Railway Database Tab**
- Connect to database
- Run schema/complete_schema.sql

## Phase 5: Smoke Check (3 Tests Only)

```bash
BASE_URL=https://your-app.railway.app npm run smoke-test
```

**Expected:**
1. ✅ Landing page loads
2. ✅ Create idea works
3. ✅ Report endpoint returns Markdown

## Files Modified/Created

### Deployment Config
- `.gitignore` - Git ignore rules
- `railway.json` - Railway build config
- `railway.toml` - Railway deployment config
- `Procfile` - Process definitions

### Code Updates
- `src/worker-all.js` - Combined worker process
- `src/redis.js` - Enhanced Redis connection (supports Railway env vars)
- `src/db.js` - Database connection with env check
- `package.json` - Added smoke-test script

### Schema
- `schema/complete_schema.sql` - Complete schema for deployment

### Testing
- `smoke-test.js` - Smoke test script

## Status

✅ **Ready for deployment**
- All critical traps fixed
- All files created
- Smoke tests passing locally

