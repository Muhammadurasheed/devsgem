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

# [GOOGLE STANDARDS] Custom Nginx config for SPA routing
RUN echo 'server { \
    listen 8080; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Copy build artifacts to Nginx public directory
COPY --from=builder /app/dist /usr/share/nginx/html

# [GOOGLE STANDARDS] Dynamic Port Binding
# We surgically swap the port in the config at runtime (Cloud Run uses 8080 by default, but we should be flexible)
CMD ["sh", "-c", "sed -i 's/listen 8080;/listen '\"${PORT}\"';/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
