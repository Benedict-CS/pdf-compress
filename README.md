# 📄 PDF Master (SaaS Edition)

A professional, full-stack web application designed to compress, merge, and edit PDF files with extreme precision. Built for high performance, it handles heavy rasterization or lightning-fast lossless editing right in your browser.

---

## ✨ Elite Features

- **Dual-Engine Processing**:
  - 🖼️ **Compress (Rasterize)**: Flattens complex vector layers, adjusts DPI (Resolution), and modifies JPEG Quality to drastically reduce file size.
  - ⚡ **Direct Edit (Lossless)**: Powered by `pdf-lib` for instant page deletion, rotation, and reordering without losing zero vector quality.
- **Smart Workstation**: Visual drag-and-drop page manager. Upload multiple PDFs and merge them seamlessly.
- **Instant Preview**: Real-time rendering of the first page to preview quality adjustments before processing.
- **SaaS Capabilities**:
  - 🔗 Generate temporary Shareable Links (auto-expire).
  - 📱 Progressive Web App (PWA) support for desktop/mobile native installation.
  - 🎉 Confetti celebration on success!
- **Enterprise-Grade Backend**:
  - 🧵 **Worker Threads**: Heavy PDF processing is offloaded so the main server never blocks.
  - 🚦 **Concurrency Control**: `p-queue` limits heavy tasks to protect server memory.
  - 🛡️ **Rate Limiting & Auto-Cleanup**: Built-in DDoS protection and automated cron jobs to wipe temporary files every hour for 100% privacy.

## 🛠 Tech Stack

- **Frontend**: ![React](https://img.shields.io/badge/react-%2320232d.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB) ![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white) (with `dnd-kit` for drag-and-drop).
- **Backend**: ![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white) ![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
- **PDF Engines**: `pdfjs-dist` (v4 for Node.js stability), `pdf-lib` (Lossless manipulation), `node-canvas`, `pdfkit`.
- **Infrastructure**: ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white) + GitHub Actions CI + Jest.

---

## 🚀 Getting Started

### 1. Using Docker (Recommended for Production)

The easiest way to run the app is using the provided `start.sh` script, which automatically handles Nginx reverse proxy routing:

```bash
chmod +x start.sh
./start.sh
```

Or manually with Docker Compose:

```bash
docker compose up --build -d
```

Access the UI at: `http://localhost` (or your domain).

### 2. Manual Installation (Development)

#### Backend
```bash
cd backend
npm install
npm start # Server runs on http://localhost:3001
```
*Note: Requires system libraries for `node-canvas` (Cairo, Pango, libjpeg, etc).*

#### Frontend
```bash
cd frontend
npm install
npm run dev # Access at http://localhost:5173
```

---

## 🧪 Testing & CI/CD

The backend includes automated API tests using `Jest` and `Supertest`. 
```bash
cd backend
npm test
```
A GitHub Actions workflow is included to automatically test and build the application on every push to the `main` branch.

---

## 🤖 AI Assistance

This project includes a `CLAUDE.md` file which contains specific technical context, architecture rules, and guidelines for AI coding assistants (like Claude, ChatGPT, or Gemini). If you are using an AI to help develop this project, point it to that file.

## 📄 License

ISC License. Free to use and modify.
