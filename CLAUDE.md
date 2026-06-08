# CLAUDE.md — PDF Master Project Context

This file provides context and strict guidelines for AI assistants working on this repository.

## Project Overview (SaaS v5.0)
A full-stack web application that serves as a complete PDF Workstation. It allows users to upload multiple PDFs, manage pages (reorder, rotate, delete) via a drag-and-drop UI, and then either compress them (rasterization via `pdfjs-dist` + `canvas`) or directly merge/edit them losslessly (via `pdf-lib`). 

## Architecture & Engines
- **Frontend**: React (Vite), Tailwind CSS, Lucide React, `@dnd-kit/core` (for sortable thumbnails).
- **Backend**: Node.js (Express). Heavy processing is offloaded to a separate `Worker Thread` (`compress-worker.js`).
- **Concurrency**: `p-queue` is used to limit heavy PDF processing tasks (max 2 concurrently) to prevent memory exhaustion (OOM).
- **Security & Maintenance**: Uses `express-rate-limit` for DDoS protection and a built-in `setInterval` cron job to delete uploaded/generated files older than 1 hour.
- **PWA**: The frontend uses `vite-plugin-pwa` to support native app installation on mobile and desktop.

## Critical Rendering Logic (DO NOT BREAK)
- **Engine Choice**: The project uses `pdfjs-dist` version `4.4.168`. **DO NOT upgrade to v5+** as it has critical instability issues with `node-canvas` in Node.js environments regarding `requestAnimationFrame` and Image objects.
- **Canvas Polyfills**: `server.js` contains a highly specific block of global polyfills (mocking `window`, `document`, `HTMLImageElement`, etc.). These are strictly necessary for `pdfjs-dist` to render correctly in Node.js.
- **Sharp Text**: When rendering PDF to canvas, the background MUST be explicitly filled with white (`ctx.fillStyle = 'white'`), and `intent: 'print'` must be passed to `page.render()`. Failure to do this causes anti-aliasing artifacts on text edges during JPEG conversion.

## Core Commands
- **Backend Test**: `npm test` (Uses Jest and Supertest, requires `--experimental-vm-modules` for ESM).
- **Backend Dev**: `cd backend && npm install && npm start` (Port 3001)
- **Frontend Dev**: `cd frontend && npm install && npm run dev` (Port 5173)
- **Docker Compose**: `./start.sh` or `docker compose up --build -d`

## Code Style & Conventions
- **ES Modules**: Backend uses `"type": "module"`. 
- **TypeScript**: Frontend logic is written in TypeScript (`.tsx`). Stick to strict typing where possible.
- **SSE (Server-Sent Events)**: Backend uses SSE at `/api/progress/:jobId` to stream progress to the frontend during worker execution. Maintain this pattern for long-running tasks.
- **Metadata Scrubbing**: When generating output PDFs (both in direct and compress modes), always ensure sensitive metadata (Author, Subject) is stripped, and Producer/Creator are set to the brand name `PDF Master v5.0`.