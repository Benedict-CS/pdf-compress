#!/bin/bash

# start.sh - PDF Compressor Startup Script

# 1. Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# 2. Check for Docker Compose V2 (recommended) or V1
DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    # Test if docker-compose works (to catch the distutils error)
    if docker-compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        echo "Detected broken docker-compose (V1). Attempting to use Docker Compose V2 plugin..."
        # Many modern Linux distros use 'docker compose' instead of 'docker-compose'
        echo "Tip: If you are on Ubuntu/Debian, try: sudo apt-get update && sudo apt-get install docker-compose-plugin"
    fi
fi

if [ -z "$DOCKER_COMPOSE_CMD" ]; then
    echo "Error: Neither 'docker compose' nor a working 'docker-compose' was found."
    echo "Please install the Docker Compose plugin."
    exit 1
fi

echo "Using command: $DOCKER_COMPOSE_CMD"

# 3. Create uploads directory if it doesn't exist (to avoid permission issues)
mkdir -p backend/uploads

# 4. Build and start the containers
echo "Starting PDF Compressor..."
sudo $DOCKER_COMPOSE_CMD up --build -d

echo "--------------------------------------------------"
echo "Application is starting up!"
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:3001"
echo "--------------------------------------------------"
echo "To view logs, run: sudo $DOCKER_COMPOSE_CMD logs -f"
echo "To stop, run: sudo $DOCKER_COMPOSE_CMD down"
