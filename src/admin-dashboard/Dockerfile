FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 5173
ENV HOST=0.0.0.0
ENV PORT=5173
ENV PUBLIC_POSTGREST_URL=http://localhost:3000
CMD ["node", "build/index.js"]
