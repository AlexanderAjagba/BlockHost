# BlockHost
Cloud backup platform for storing and managing Minecraft single-player worlds.

## Local Development with Docker

1. Copy `.env.example` to `.env` and fill in Firebase values.
2. Run `docker compose up --build` from the project root.
3. Frontend will be available on port `5173` and backend on port `4000`.

## Service Layout

- `frontend/`: Vite + TypeScript app with Firebase Web SDK.
- `backend/`: Express + TypeScript API with Firebase Admin initialization.
