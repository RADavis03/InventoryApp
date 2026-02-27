# Stage 1: Build the React client
FROM node:20-alpine AS builder
WORKDIR /app/client
COPY client/package.json .
RUN npm install
COPY client/ .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app/server
COPY server/package.json .
RUN npm install --omit=dev
COPY server/ .
COPY --from=builder /app/client/dist /app/client/dist
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "index.js"]
