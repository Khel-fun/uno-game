# Use an official Node runtime as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Set Node to production mode for better performance
ENV NODE_ENV=production

ENV PORT=4000

# Set memory limits for Node.js
ENV NODE_OPTIONS="--max-old-space-size=512 --max-http-header-size=16384"

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Add healthcheck to help Cloud Run monitor the container
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://localhost:4000/health || exit 1

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 4000

# Use dumb-init as a proper init system to handle signals
RUN apk add --no-cache dumb-init

# Command to run the application with dumb-init to properly handle signals
CMD ["dumb-init", "node", "index.js"]
