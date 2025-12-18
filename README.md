# Conductor MVP

AI-powered project orchestration platform.

## Quick Start

1. Start Docker containers:
   ```bash
   docker-compose up -d
   ```

2. Run database migration:
   ```bash
   docker exec -i conductor-postgres psql -U conductor -d conductor_db -f /tmp/schema.sql
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start server:
   ```bash
   npm start
   ```

5. Start workers (separate terminal):
   ```bash
   npm run worker
   ```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - Server port (default: 3000)

## API Endpoints

- `GET /` - Landing page
- `POST /api/ideas` - Create idea
- `POST /api/projects/:projectId/feasibility` - Trigger feasibility
- `POST /api/projects/:projectId/planning` - Trigger planning
- `POST /api/projects/:projectId/execution/start` - Start execution
- `GET /api/projects/:projectId` - Get project
- `GET /api/projects/:projectId/artifacts` - List artifacts
- `GET /api/projects/:projectId/report` - Get report

## Deployment

See Railway deployment configuration in `railway.json` and `railway.toml`.

