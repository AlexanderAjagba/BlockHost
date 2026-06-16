# BlockHost
Cloud backup platform for storing and managing Minecraft single-player worlds.

## Local Development with Docker

1. Create a root `.env.local` file and fill in the Firebase and backend values.
   The frontend requires `VITE_API_BASE_URL=http://localhost:4000`.
   Signed R2 upload URLs require these backend-only variables:
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
   `R2_BUCKET_NAME`.
2. Run `docker compose up --build` from the project root.
3. Frontend will be available on port `5173` and backend on port `4000`.

## Cloudflare R2 CORS

Direct browser uploads require the R2 bucket CORS policy to allow `PUT`
requests from `http://localhost:5173` with the `Content-Type` header. Add the
Firebase Hosting origin to the policy before deploying the frontend to
production.

## Service Layout

- `frontend/`: Vite + TypeScript app with Firebase Web SDK.
- `backend/`: Express + TypeScript API with Firebase Admin initialization.
