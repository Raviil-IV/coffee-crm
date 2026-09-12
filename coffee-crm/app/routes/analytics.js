const { Router } = require('express');
const { prisma } = require('../database');
const { toMoney, asyncHandler, parseId } = require('../util');

const router = Router();

/**
 * @swagger
 * /analytics/top-drinks:
 *   get:
 *     tags: [Analytics]
 *     summary: Топ-5 самых заказываемых напитков
 *     responses:
 *       '200':
 *         description: Рейтинг напитков по суммарному количеству во всех заказах
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 top_drinks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank:
 *                         type: integer
 *                       drink_id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       category:
 *                         type: string
 *                       total_quantity:
 *                         type: integer
 */
router.get(
  '/top-drinks',
  asyncHandler(async (req, res) => {
    const rows = await prisma.orderItem.groupBy({
      by: ['drinkId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const drinkIds = rows.map((row) => row.drinkId);
    const drinks = await prisma.drink.findMany({ where: { id: { in: drinkIds } } });
    const drinkMap = new Map(drinks.map((drink) => [drink.id, drink]));

    res.json({
      top_drinks: rows.map((row, index) => {
        const drink = drinkMap.get(row.drinkId);
        return {
          rank: index + 1,
          drink_id: row.drinkId,
          name: drink ? drink.name : null,
          category: drink ? drink.category : null,
          total_quantity: row._sum.quantity,
        };
      }),
    });
  })
);

/**
 * @swagger
 * /analytics/customer-stats/{customer_id}:
 *   get:
 *     tags: [Analytics]
 *     summary: Статистика клиента
 *     description: Количество заказов и общая сумма потраченных средств.
 *     parameters:
 *       - in: path
 *         name: customer_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Статистика клиента
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customer_id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 total_orders:
 *                   type: integer
 *                 total_spent:
 *                   type: number
 *       '400':
 *         description: Некорректный customer_id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Клиент не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/customer-stats/:customer_id',
  asyncHandler(async (req, res) => {
    const customerId = parseId(req.params.customer_id);
    if (!customerId) {
      return res.status(400).json({ error: 'customer_id must be a positive integer' });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'customer not found' });

    const orders = await prisma.order.findMany({
      where: { customerId },
      include: { items: { include: { drink: true } } },
    });

    let spent = 0;
    for (const order of orders) {
      for (const item of order.items) {
        spent += Number(item.drink.price) * item.quantity;
      }
    }

    res.json({
      customer_id: customer.id,
      name: customer.name,
      total_orders: orders.length,
      total_spent: toMoney(spent),
    });
  })
);

/**
 * @swagger
 * /analytics/revenue:
 *   get:
 *     tags: [Analytics]
 *     summary: Общая выручка за всё время
 *     description: Сумма price * quantity по всем позициям. Опционально можно фильтровать по статусу (?status=completed).
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, ready, completed]
 *     responses:
 *       '200':
 *         description: Выручка и количество учтённых заказов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 revenue:
 *                   type: number
 *                 orders_count:
 *                   type: integer
 *                 status_filter:
 *                   type: string
 *                   nullable: true
 */
router.get(
  '/revenue',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const where = status ? { status } : {};

    const orders = await prisma.order.findMany({
      where,
      include: { items: { include: { drink: true } } },
    });

    let revenue = 0;
    for (const order of orders) {
      for (const item of order.items) {
        revenue += Number(item.drink.price) * item.quantity;
      }
    }

    res.json({
      revenue: toMoney(revenue),
      orders_count: orders.length,
      status_filter: status,
    });
  })
);

module.exports = router;