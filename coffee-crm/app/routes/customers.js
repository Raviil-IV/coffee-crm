const { Router } = require('express');
const { prisma } = require('../database');
const { validateCustomerInput } = require('../schemas');
const { asyncHandler, parseId } = require('../util');

const router = Router();

function serializeCustomer(customer) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone ?? null,
    registered_at: customer.registeredAt,
  };
}

/**
 * @swagger
 * /customers:
 *   get:
 *     tags: [Customers]
 *     summary: Список всех клиентов
 *     responses:
 *       '200':
 *         description: Массив клиентов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Customer'
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const customers = await prisma.customer.findMany({ orderBy: { id: 'asc' } });
    res.json(customers.map(serializeCustomer));
  })
);

/**
 * @swagger
 * /customers/{id}:
 *   get:
 *     tags: [Customers]
 *     summary: Получить клиента по ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Клиент
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       '400':
 *         description: Некорректный id
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
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ error: 'customer not found' });

    res.json(serializeCustomer(customer));
  })
);

/**
 * @swagger
 * /customers:
 *   post:
 *     tags: [Customers]
 *     summary: Создать нового клиента
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Иван Петров'
 *               phone:
 *                 type: string
 *                 example: '+79991234567'
 *     responses:
 *       '201':
 *         description: Созданный клиент
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Customer'
 *       '400':
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { value, error } = validateCustomerInput(req.body || {});
    if (error) return res.status(400).json({ error });

    const customer = await prisma.customer.create({ data: value });
    res.status(201).json(serializeCustomer(customer));
  })
);

/**
 * @swagger
 * /customers/{id}:
 *   delete:
 *     tags: [Customers]
 *     summary: Удалить клиента (вместе с его заказами)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '204':
 *         description: Клиент удалён
 *       '400':
 *         description: Некорректный id
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
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'customer not found' });

    await prisma.customer.delete({ where: { id } });
    res.status(204).end();
  })
);

module.exports = router;