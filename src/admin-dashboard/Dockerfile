FROM node:20-alpine
ARG POSTGREST_URL
ENV PUBLIC_POSTGREST_URL=$POSTGREST_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000
CMD ["node", "build/index.js"]