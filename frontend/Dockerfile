# Use the official Node.js image
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install React dependencies
RUN npm install

# Copy your React source code
COPY . .

# Expose the Vite port
EXPOSE 5173

# Start the Vite development server
# --host is required so you can access it from your actual computer
CMD ["npm", "run", "dev", "--", "--host"]
