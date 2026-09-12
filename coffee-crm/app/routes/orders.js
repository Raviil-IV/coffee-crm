const { Router } = require('express');
const { prisma } = require('../database');
const { validateOrderInput, validateStatusInput } = require('../schemas');
const { toMoney, asyncHandler, parseId } = require('../util');

const router = Router();

const orderInclude = {
  customer: true,
  items: { include: { drink: true } },
};

function serializeOrder(order) {
  const items = order.items.map((item) => ({
    id: item.id,
    drink_id: item.drinkId,
    name: item.drink.name,
    category: item.drink.category,
    price: Number(item.drink.price),
    quantity: item.quantity,
    total: toMoney(Number(item.drink.price) * item.quantity),
  }));

  const total = toMoney(items.reduce((sum, item) => sum + item.total, 0));

  return {
    id: order.id,
    customer_id: order.customerId,
    customer_name: order.customer.name,
    created_at: order.createdAt,
    status: order.status,
    items,
    total,
  };
}

/**
 * @swagger
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: Список всех заказов
 *     responses:
 *       '200':
 *         description: Массив заказов с клиентом, позициями и общей суммой
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders.map(serializeOrder));
  })
);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Получить заказ по ID с полной информацией
 *     description: Включает клиента, напитки, количество и вычисленную общую сумму.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Заказ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       '400':
 *         description: Некорректный id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Заказ не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) return res.status(404).json({ error: 'order not found' });

    res.json(serializeOrder(order));
  })
);

/**
 * @swagger
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Создать новый заказ
 *     description: Принимает customer_id и список позиций drink_id с количеством. Позиции и заказ создаются в одной транзакции.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_id, items]
 *             properties:
 *               customer_id:
 *                 type: integer
 *                 example: 1
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [drink_id, quantity]
 *                   properties:
 *                     drink_id:
 *                       type: integer
 *                       example: 1
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                       example: 2
 *     responses:
 *       '201':
 *         description: Созданный заказ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       '400':
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Клиент или напиток не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { value, error } = validateOrderInput(req.body || {});
    if (error) return res.status(400).json({ error });

    const { customerId, items } = value;

    // Проверяем существование клиента и всех напитков до создания заказа
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'customer not found' });

    const drinkIds = [...new Set(items.map((item) => item.drinkId))];
    const drinks = await prisma.drink.findMany({ where: { id: { in: drinkIds } } });
    if (drinks.length !== drinkIds.length) {
      return res.status(404).json({ error: 'one or more drinks not found' });
    }

    // Создание заказа и его позиций в одной транзакции
    const order = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          customerId,
          items: { create: items },
        },
        include: orderInclude,
      });
    });

    res.status(201).json(serializeOrder(order));
  })
);

/**
 * @swagger
 * /orders/{id}/status:
 *   put:
 *     tags: [Orders]
 *     summary: Изменить статус заказа
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, ready, completed]
 *     responses:
 *       '200':
 *         description: Заказ с обновлённым статусом
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       '400':
 *         description: Ошибка валидации статуса
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Заказ не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const { value: status, error } = validateStatusInput(req.body || {});
    if (error) return res.status(400).json({ error });

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'order not found' });

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: orderInclude,
    });

    res.json(serializeOrder(order));
  })
);

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     tags: [Orders]
 *     summary: Удалить заказ
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '204':
 *         description: Заказ удалён
 *       '400':
 *         description: Некорректный id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Заказ не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'order not found' });

    await prisma.order.delete({ where: { id } });
    res.status(204).end();
  })
);

module.exports = router;