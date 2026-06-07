# 📄 PDF Compressor Online

A powerful, full-stack web application designed to shrink PDF files through intelligent rasterization. Perfect for flattening complex PDFs or reducing the size of scanned documents.

---

## ✨ Features

- **Drag & Drop Upload**: Simple and intuitive interface.
- **Customizable Compression**: Choose between different quality and resolution (scale) settings.
- **Visual Feedback**: Real-time processing status.
- **Flattening**: Automatically flattens annotations and complex vector layers into a single image layer.
- **Dockerized**: Deploy anywhere with a single command.

## 🛠 Tech Stack

- **Frontend**: ![React](https://img.shields.io/badge/react-%2320232d.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB) ![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
- **Backend**: ![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white) ![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
- **PDF Engine**: `pdfjs-dist` (Parsing), `node-canvas` (Rendering), `pdfkit` (Assembly).
- **Infrastructure**: ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)

---

## 🚀 Getting Started

### 1. Using Docker (Recommended)

The easiest way to run the app is using the provided `start.sh` script:

```bash
chmod +x start.sh
./start.sh
```

Or manually with Docker Compose:

```bash
docker compose up --build
```

Access the UI at: `http://localhost`

### 2. Manual Installation (Development)

#### Backend
```bash
cd backend
npm install
npm start # Server runs on http://localhost:3001
```
*Note: Requires system libraries for `node-canvas` (Cairo, Pango).*

#### Frontend
```bash
cd frontend
npm install
npm run dev # Access at http://localhost:5173
```

---

## 🤖 AI Assistance

This project includes a `CLAUDE.md` file which contains specific technical context and guidelines for AI coding assistants (like Claude, ChatGPT, or Gemini). If you are using an AI to help develop this project, point it to that file.

## 📄 License

ISC License. Free to use and modify.
