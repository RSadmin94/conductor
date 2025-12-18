# Deployment Ready - Railway

## Critical Traps Fixed ✅

### Trap A: Worker Environment Variables ✅
- ✅ `src/worker-all.js` checks for DATABASE_URL and REDIS_URL
- ✅ Workers exit with error if env vars missing
- ✅ All workers use modules that read from env

### Trap B: PORT from Environment ✅
- ✅ `src/index.js` uses `process.env.PORT || 3000`
- ✅ No hardcoded ports

### Trap C: Schema Complete ✅
- ✅ All fields workers write are in schema:
  - `projects.stage` (used by all workers)
  - `decisions.stage` (used by feasibility, planning)
  - `artifacts.stage` and `artifacts.type` (used by all workers)
  - `runs` table (used by execution worker)

### Trap D: GitHub Push Ready ✅
- ✅ `.gitignore` created
- ✅ All files ready for commit

## Files Created

### Deployment Config
- `railway.json` - Railway build config
- `railway.toml` - Railway deployment config
- `Procfile` - Process definitions
- `.gitignore` - Git ignore rules

### Worker Process
- `src/worker-all.js` - Combined worker for Railway (runs all workers)

### Testing
- `smoke-test.js` - Smoke test script (3 checks only)

### Documentation
- `README.md` - Quick start guide

## Environment Variables Required

**Railway Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - Automatically set by Railway

## Deployment Steps

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Deploy to Railway"
   git push origin main
   ```

2. **Deploy to Railway:**
   - Connect GitHub repo
   - Add environment variables (DATABASE_URL, REDIS_URL)
   - Deploy

3. **Run Migration:**
   - Use Railway CLI or connect to database
   - Run schema migration

4. **Smoke Test:**
   ```bash
   BASE_URL=https://your-app.railway.app npm run smoke-test
   ```

## Smoke Test (3 Checks Only)

1. ✅ Landing page loads
2. ✅ Create idea works
3. ✅ Report endpoint returns Markdown

## Status

✅ **Ready for deployment**
- All critical traps fixed
- Railway config created
- Worker process ready
- Smoke test script ready
- No hardcoded values
- All env vars checked

