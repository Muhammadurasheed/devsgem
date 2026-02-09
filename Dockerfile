# [FAANG] Production Frontend Dockerfile
# Stage 1: Build Phase
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production Serving Phase (Nginx)
FROM nginx:alpine

# Copy build artifacts to Nginx public directory
COPY --from=builder /app/dist /usr/share/nginx/html

# [GOOGLE STANDARDS] Dynamic Port Binding
# Cloud Run injects $PORT. Nginx usually listens on 80.
# We surgically swap the port in the config at runtime.
CMD ["sh", "-c", "sed -i 's/listen  80;/listen '\"${PORT}\"';/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
