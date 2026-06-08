FROM node:20-alpine
ARG POSTGREST_URL
ENV PUBLIC_POSTGREST_URL=$POSTGREST_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 5173
ENV HOST=0.0.0.0
ENV PORT=5173
CMD ["node", "build/index.js"]