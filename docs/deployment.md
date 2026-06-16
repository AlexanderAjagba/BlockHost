# Manual MVP Deployment

This guide prepares BlockHost for manual production deployment. Jenkins remains
CI-only for now and should not deploy automatically.

Production targets:

- Backend API: Render
- Frontend: Firebase Hosting
- Database: Neon Postgres
- ZIP storage: Cloudflare R2
- Authentication: Firebase Authentication with Google and Microsoft providers

## Backend: Render

Create a Render Web Service from the repository and point it at the `backend`
directory.

Recommended settings:

- Runtime: Node
- Node version: 20
- Build command: `npm ci && npm run prisma:generate && npm run build`
- Start command: `npm start`
- Health check path: `/health`

The backend is ready for Render because:

- It reads the port from `process.env.PORT`.
- `npm start` runs `node dist/index.js`.
- TypeScript builds to `backend/dist`.
- Firebase Admin initialization is guarded with `getApps()[0]`.
- `FIREBASE_PRIVATE_KEY` preserves newline replacement with
  `process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")`.
- Prisma Client can be generated during the Render build.
- The service is stateless; uploads go directly to R2 and metadata lives in Neon.
- Client responses do not expose R2 credentials, bucket names, or object keys.

### Render Environment Variables

Set these in Render. Do not commit real values.

```env
NODE_ENV=production
DATABASE_URL=...

FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

FRONTEND_ORIGIN=https://YOUR_FIREBASE_HOSTING_DOMAIN
```

`FIREBASE_PRIVATE_KEY` should be stored in Render with escaped newlines, or in a
format Render preserves correctly. The app replaces literal `\n` sequences at
runtime.

## Database: Neon And Prisma

Create a Neon Postgres project and use its production connection string as
`DATABASE_URL` on Render.

Before starting the production backend for the first time, deploy migrations
manually from the backend directory against the production database:

```sh
npx prisma migrate deploy
```

Do not use `prisma migrate dev` against production. `migrate deploy` applies
checked-in migrations only and does not create new migration files.

The current schema includes:

- `User`
- `World`
- `WorldVersion`
- `PendingWorldUpload`

## Storage: Cloudflare R2

Create a private R2 bucket for ZIP backups. Generate an R2 API token with the
minimum bucket permissions needed for signed PUT, HEAD, and GET operations.

Backend-only values:

```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
```

Never expose these to the frontend.

### R2 CORS

The browser uploads ZIP files directly to signed R2 PUT URLs, so the bucket CORS
policy must allow the Firebase Hosting production origin.

Example policy:

```json
[
  {
    "AllowedOrigins": ["https://YOUR_FIREBASE_HOSTING_DOMAIN"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

The backend currently returns `requiredHeaders` containing `Content-Type`, so R2
CORS must allow that header. Signed upload and download URLs are short-lived:
currently `900` seconds.

## Authentication: Firebase

In Firebase Authentication:

- Enable Google sign-in.
- Enable Microsoft sign-in.
- Add the Firebase Hosting production domain to authorized domains.
- Add `localhost` only for local development.

Backend Firebase Admin uses service account environment variables on Render.
Frontend Firebase Web SDK uses only public Vite variables.

## Frontend: Firebase Hosting

The frontend is a Vite app. Configure production build-time environment values
before building.

Required frontend variables:

```env
VITE_API_BASE_URL=https://YOUR_RENDER_BACKEND_DOMAIN
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

The frontend is ready because:

- API base URL comes from `import.meta.env.VITE_API_BASE_URL`.
- Firebase Web SDK config comes from `import.meta.env.VITE_*`.
- No backend secrets, R2 credentials, Firebase Admin credentials, or Neon URLs
  are referenced by frontend code.
- Firebase Hosting should deploy the Vite build output from `frontend/dist`.

Manual build:

```sh
cd frontend
npm ci
npm run build
```

Then deploy `dist` with Firebase Hosting using the Firebase CLI. If Firebase
Hosting has not been initialized yet, configure it to use `frontend/dist` as the
public directory.

## Backend CORS

Set Render `FRONTEND_ORIGIN` to the exact Firebase Hosting origin, for example:

```env
FRONTEND_ORIGIN=https://YOUR_FIREBASE_HOSTING_DOMAIN
```

The backend allows:

- Origin: `FRONTEND_ORIGIN`
- Headers: `Authorization, Content-Type`
- Methods: `GET, POST, OPTIONS`

Do not leave production CORS pointed at `localhost`.

## Health Endpoint

`GET /health` is public and returns:

```json
{ "status": "ok" }
```

It does not expose database status, secrets, bucket names, environment details,
or internal service information.

## Production Smoke Test

After deployment:

- Open the deployed Firebase Hosting frontend.
- Sign in with Google.
- Verify the authenticated `/api/me` call succeeds.
- Create a world.
- Upload a small valid `.zip` backup.
- Confirm upload progress reaches `100%`.
- Confirm the backup appears in version history.
- Download the ZIP backup.
- Confirm the downloaded ZIP opens locally.
- Try an invalid file type and confirm the friendly frontend error appears.
- Try creating a duplicate world name and confirm the friendly frontend error
  appears.
- Confirm backend logs do not leak secrets, R2 object keys, bucket names, or
  stack traces.

## Deployment Boundaries

Do not add production secrets to Jenkins yet. Jenkins validates the monorepo but
does not deploy. Render and Firebase deployments should remain manual until CD
is intentionally designed.
