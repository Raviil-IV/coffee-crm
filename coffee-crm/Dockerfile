FROM node:20-slim

WORKDIR /app

# Prisma требует OpenSSL для детекции среды и загрузки движка
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Сначала копируем только манифесты зависимостей — это даёт кэширование слоя npm install
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Схема Prisma и генерация клиента
COPY prisma ./prisma
RUN npx prisma generate

COPY app ./app

EXPOSE 3000

# При старте: синхронизация схемы с БД (создание таблиц), загрузка тестовых данных,
# затем запуск сервера
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx prisma db seed && node app/index.js"]