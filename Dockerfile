# Stage 1: Build the React Application
FROM node:24-alpine AS builder
WORKDIR /app

# Copy package files and install ALL dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Create the Secure Node.js Server
FROM node:24-alpine
WORKDIR /app

# Copy package.json again to install ONLY production dependencies (Express)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the built React files from Stage 1
COPY --from=builder /app/dist ./dist

# --- CRITICAL STEP: Copy the server script ---
COPY server.js ./

# Set the port (Azure looks for 8080 by default in containers)
ENV PORT=8080
EXPOSE 8080

# Start the secure server automatically
CMD ["node", "server.js"]
