FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run full-stack dev server (Express backend + Vite frontend)
CMD ["npm", "run", "dev:fullstack"]