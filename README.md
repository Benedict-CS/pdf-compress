# PDF Compressor Online

A full-stack application to compress PDF files using rasterization.

## Features
- Upload PDF files.
- Adjust compression quality and scale.
- Fast processing using `pdfjs-dist` and `pdfkit`.
- Dockerized for easy deployment.

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Lucide React.
- **Backend**: Node.js, Express, Multer, Node-Canvas, PDFKit.
- **DevOps**: Docker, Docker Compose.

## Getting Started

### Using Docker (Recommended)
1. Clone the repository.
2. Run `docker-compose up --build`.
3. Open `http://localhost` in your browser.

### Local Development
#### Backend
1. `cd backend`
2. `npm install`
3. `npm start` (Runs on port 3001)

#### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev` (Runs on port 5173, make sure to update API URL in App.tsx if needed)
