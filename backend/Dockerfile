FROM node:lts

WORKDIR /app

# Install dependencies first (cache friendly)
COPY package*.json ./
RUN npm install

# Copy backend code + dist
COPY . .

EXPOSE 8596

CMD ["node", "index.js"]