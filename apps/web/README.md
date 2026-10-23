# Aven web app

Next.js App Router frontend for the fictional Aven demo. It calls the Express API; it never accesses PostgreSQL or the AI service directly.

From the repository root, run `npm run dev:api` and `npm run dev:web` in separate PowerShell windows. Visit <http://localhost:3000>. The API URL defaults to `http://localhost:4000` and can be changed with `NEXT_PUBLIC_API_URL` in a local `apps/web/.env.local` file. If port 3000 is busy, start the web app on another port and set the API's `CORS_ORIGIN` to that exact browser origin.

The current pages provide demo login and guarded hospital/reviewer landing screens. Claim dashboards, forms, and uploads come next. The short-lived demo token is kept in browser `sessionStorage`, and protected pages recheck it with `/auth/me`. Express still enforces every role and hospital data scope.
