# 🐳 Dockerfile for Next.js app to deploy on Google Cloud Run
FROM node:18-alpine

WORKDIR /app

# Install dependencies first (leverages Docker cache)
COPY package*.json ./
RUN npm install

# Copy all local files into the container
COPY . .

# Build your Next.js project
RUN npm run build

# Next.js defaults to port 3000, Cloud Run assigns custom PORT env
ENV PORT=3000
EXPOSE 3000

# Start Next.js server bound to Cloud Run's dynamic $PORT
CMD npx next start -p $PORT
