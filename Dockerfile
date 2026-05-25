FROM node:20-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps


COPY . .

RUN npm run build

COPY scripts/entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 3000

CMD ./entrypoint.sh
