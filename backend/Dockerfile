# Use the official Node.js image
FROM node:20-alpine

# Create the folder where the code will live inside the container
WORKDIR /app

# Copy the package files first (to make building faster)
COPY package*.json ./

# Install the libraries we need
RUN npm install

# Copy all your backend code (server.js, etc.)
COPY . .

# Tell Docker that the app runs on port 3000
EXPOSE 3000

# The command to start your engine
CMD ["node", "server.js"]
