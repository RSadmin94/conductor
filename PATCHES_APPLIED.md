# Patches Applied - MVP Implementation

## ✅ All Patches Applied

### 1. Postgres Container Name
- ✅ Using `conductor-postgres` (hyphen) throughout
- ✅ All docker commands use `docker exec -i conductor-postgres`

### 2. NO ON DELETE CASCADE for History
- ✅ `decisions`: `ON DELETE RESTRICT` (preserves history)
- ✅ `artifacts`: `ON DELETE RESTRICT` (preserves history)
- ✅ `runs`: `ON DELETE RESTRICT` (preserves history)
- ✅ `messages`: `ON DELETE RESTRICT` (preserves history)
- ✅ Only `ideas` uses `ON DELETE CASCADE` (non-history table)

### 3. DB-level Idempotency Backstop
- ✅ `decisions`: `UNIQUE(project_id, stage)` constraint added
- ✅ `artifacts`: `UNIQUE(project_id, stage, type)` constraint added
- ✅ Job uses `ON CONFLICT DO NOTHING` to prevent duplicates

### 4. Schema Updates
- ✅ `decisions` table has `stage` column
- ✅ `artifacts` table has `stage` and `type` columns
- ✅ Schema file location: `schema/schema.sql`

### 5. Redis Library
- ✅ Changed from `redis` to `ioredis` package
- ✅ Updated `src/redis.js` to use IORedis connection

### 6. Code Updates
- ✅ `src/jobs/feasibilityJob.js`: Uses `stage='feasibility'` and `ON CONFLICT DO NOTHING`
- ✅ `src/handlers/artifacts.js`: Returns array format, includes `type` field
- ✅ `src/handlers/projects.js`: Returns `projectId` (not `id`), simplified response
- ✅ All handlers updated to match new schema

## Files Modified

1. `schema/schema.sql` - New location, updated constraints
2. `package.json` - Changed `redis` to `ioredis`
3. `src/redis.js` - Uses IORedis
4. `src/jobs/feasibilityJob.js` - Added stage/type, idempotency
5. `src/handlers/artifacts.js` - Updated for new schema
6. `src/handlers/projects.js` - Response format matches spec
7. `src/workers/feasibilityWorker.js` - Updated connection handling

## Database Schema Applied

✅ All 6 tables created with:
- UUID primary keys
- Foreign keys with RESTRICT (history tables)
- Indexes on all project_id columns
- UNIQUE constraints for idempotency:
  - `decisions(project_id, stage)`
  - `artifacts(project_id, stage, type)`

## Ready for Testing

The implementation now matches all patch requirements:
- History preserved (no CASCADE deletes)
- DB-level idempotency enforced
- Correct container name used
- ioredis instead of redis
- Schema in correct location

