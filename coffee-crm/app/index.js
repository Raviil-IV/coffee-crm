const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const { prisma } = require('./database');

const customersRouter = require('./routes/customers');
const drinksRouter = require('./routes/drinks');
const ordersRouter = require('./routes/orders');
const analyticsRouter = require('./routes/analytics');

const app = express();
app.use(express.json());

// Веб-интерфейс: главная страница на / (index.html + статика)
app.use(express.static(path.join(__dirname, 'public')));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Coffee CRM API',
      version: '1.0.0',
      description:
        'REST API для учёта заказов в кофейне: клиенты, напитки, заказы и аналитика.',
    },
    servers: [{ url: '/', description: 'Локальный сервер' }],
    tags: [
      { name: 'Customers', description: 'Клиенты кофейни' },
      { name: 'Drinks', description: 'Меню напитков' },
      { name: 'Orders', description: 'Заказы' },
    ],
    components: {
      schemas: {
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Иван Петров' },
            phone: { type: 'string', nullable: true, example: '+79991234567' },
            registered_at: { type: 'string', format: 'date-time' },
          },
        },
        Drink: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Капучино' },
            price: { type: 'number', format: 'float', example: 200 },
            category: { type: 'string', example: 'coffee' },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            drink_id: { type: 'integer' },
            name: { type: 'string' },
            category: { type: 'string' },
            price: { type: 'number' },
            quantity: { type: 'integer' },
            total: { type: 'number' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            customer_id: { type: 'integer' },
            customer_name: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'ready', 'completed'] },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
            total: { type: 'number' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  },
  // analytics.js намеренно исключён: эндпоинты аналитики не показываем в Swagger,
  // но оставляем доступными в API
  apis: ['./app/routes/customers.js', './app/routes/drinks.js', './app/routes/orders.js'],
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/customers', customersRouter);
app.use('/drinks', drinksRouter);
app.use('/orders', ordersRouter);
app.use('/analytics', analyticsRouter);

// 404 для неизвестных маршрутов
app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Централизованная обработка ошибок
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Coffee CRM listening on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));