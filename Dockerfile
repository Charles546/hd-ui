# Stage 1: build
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve
FROM nginx:1.27-alpine

# Remove the default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our template — envsubst fills in HD_API_URL at container start
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy our entrypoint — generates /config.js from VITE_GITHUB_CLIENT_ID at start
COPY hd-entrypoint.sh /hd-entrypoint.sh
RUN chmod +x /hd-entrypoint.sh

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx:alpine's official entrypoint already runs envsubst on /etc/nginx/templates/*.template
# and writes the result to /etc/nginx/conf.d/ before starting nginx.
# HD_API_URL and VITE_GITHUB_CLIENT_ID must be set at runtime.

EXPOSE 8080
ENTRYPOINT ["/hd-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
