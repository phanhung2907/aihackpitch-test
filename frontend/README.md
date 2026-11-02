# Frontend

Feature-agnostic UI base prepared on 2026-11-03 for the AI HackPitch session on 2026-11-04. The intent is to have a running shell on the night before, then reshape its routes and content once the competition brief is known.

## Origin and license

Based on [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) at upstream commit `e16c87f`, MIT licensed. The upstream `LICENSE` is kept in this folder and its original readme is preserved as [README.upstream.md](README.upstream.md). Keep both if this code is published.

## Stack as installed

React 19.2, Vite 8.3, TypeScript 6.0, Tailwind CSS 4.2, shadcn/ui, TanStack Router, TanStack Query 5, React Hook Form with Zod, Zustand, Lucide icons, Vitest. Node.js 24 and npm; dependencies were installed with `npm install`, so this folder carries `package-lock.json` and not the upstream pnpm lockfile.

Two deliberate differences from section 12 of [the banking plan](../plans/banking-webapp-plan.md): routing is TanStack Router rather than React Router, because rewriting the route tree buys nothing for a one-day event, and MSW is not installed, because the template's local mock data is enough until a real API exists. Playwright is also not installed; `npm test` runs Vitest in browser mode and needs `npm run test:browser:install` first, which has not been run.

## What was removed from the template

Clerk authentication (routes, assets, sidebar entry, the `@clerk/react` dependency and `.env.example`, so no hosted auth key is needed), plus the Tasks, Apps, Chats and Help Center sample features. The Users feature is kept on purpose as a working CRUD reference: table, filters, dialogs and form validation.

The sidebar identity was changed from the upstream author's name and email to a neutral demo user so no real person's details appear in a presentation.

## What remains

Dashboard shell with sidebar, top bar, command palette, theme and font switchers; the Users CRUD screens; auth screens (sign-in, sign-in 2-column, sign-up, forgot password, OTP) backed by a local Zustand store; error pages (401, 403, 404, 500, 503); settings screens.

## Commands

```
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint
```

## Verification done

`npm install` (461 packages), `npm run build` and `npm run lint` all pass, and the dev server renders the dashboard with the trimmed navigation. The unit tests were not run because the browser-mode runner needs a Playwright Chromium download. The build prints a chunk-size warning above 500 kB, which is the upstream default and was not tuned.
