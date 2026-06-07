# CLAUDE.md — PDF Compressor Project Context

This file provides context and guidelines for AI assistants working on this repository.

## Project Overview
A full-stack web application that compresses PDF files by rasterizing pages into JPEGs and re-assembling them into a new PDF. This effectively flattens the PDF and reduces size, especially for scanned or heavy vector documents.

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Lucide React.
- **Backend**: Node.js (Express), `multer` (uploads), `canvas` (rendering), `pdfjs-dist` (parsing), `pdfkit` (generation).
- **Runtime**: Node.js 20+, Docker Compose.

## Core Commands
### Development
- **Backend**: `cd backend && npm install && npm start` (Port 3001)
- **Frontend**: `cd frontend && npm install && npm run dev` (Port 5173)
- **Full Stack (Docker)**: `./start.sh` or `docker compose up --build`

### Build
- **Frontend**: `cd frontend && npm run build` (Outputs to `dist/`)

## Key File Locations
- **Backend Entry**: `backend/server.js`
- **Compression Logic**: `compressPDF` function in `backend/server.js`
- **Frontend Entry**: `frontend/src/main.tsx`
- **Main UI**: `frontend/src/App.tsx`
- **Docker Config**: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`

## Code Style & Conventions
- **ES Modules**: Use `import/export` syntax (Node.js uses `"type": "module"`).
- **Styling**: Tailwind utility classes in React components.
- **Error Handling**: Always use `try/catch` in async API routes and clean up uploaded files in the `finally` or `res.download` callback.
- **Types**: Frontend uses TypeScript (.tsx).

## Architectural Notes
- The backend uses `node-canvas` which requires system-level libraries (Cairo, Pango) provided in the Dockerfile.
- The compression works by rendering each PDF page at a specific `scale` (resolution) and `quality` (JPEG compression).
- Default scale is `1.2x`, default quality is `0.7`.
