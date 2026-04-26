# DevConnect Backend (Advanced Database Final)

Backend scaffold for Topic 10: **DevConnect: Social Platform for Developers**.

## Stack

- Node.js + Express + TypeScript
- Supabase (PostgreSQL side for SQL requirements)
- MongoDB (document store for snippets)

## Folder Structure

```text
src/
	app.ts
	index.ts
	config/
		env.ts
		mongodb.ts
		supabase.ts
	db/
		impedance-mismatch.md
		sql/
			schema.sql
	middlewares/
		error.middleware.ts
	routes/
		index.ts
	modules/
		README.md
		health/
			health.routes.ts
		social-graph/
			social-graph.queries.ts
			social-graph.routes.ts
			social-graph.service.ts
		posts/
			posts.repository.ts
			posts.routes.ts
			posts.types.ts
		analytics/
			analytics.queries.ts
			analytics.routes.ts
```

## This aligns with the requirements

- Recursive CTE: `src/modules/social-graph/social-graph.queries.ts`
- NoSQL posts + text index on `snippet` and `tags`: `src/modules/posts/posts.repository.ts`
- Window function ranking (7-day influence): `src/modules/analytics/analytics.queries.ts`
- SQL schema baseline: `src/db/sql/schema.sql`
- Impedance mismatch explanation: `src/db/impedance-mismatch.md`

## Quick Start

1. Install dependencies:

	 ```bash
	 npm install
	 ```

2. Copy environment file and fill secrets:

	 ```bash
	 cp .env.example .env
	 ```

3. Start in development mode:

	 ```bash
	 npm run dev
	 ```

4. Build for production:

	 ```bash
	 npm run build
	 npm start
	 ```

## Current API Endpoints (Starter)

- `GET /` - service status
- `GET /api/v1/health`