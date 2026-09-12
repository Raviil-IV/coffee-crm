const { Router } = require('express');
const { prisma } = require('../database');
const { validateDrinkInput, validateDrinkUpdate } = require('../schemas');
const { asyncHandler, parseId } = require('../util');

const router = Router();

function serializeDrink(drink) {
  return {
    id: drink.id,
    name: drink.name,
    price: Number(drink.price),
    category: drink.category,
  };
}

/**
 * @swagger
 * /drinks:
 *   get:
 *     tags: [Drinks]
 *     summary: Меню всех напитков
 *     responses:
 *       '200':
 *         description: Массив напитков
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Drink'
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const drinks = await prisma.drink.findMany({ orderBy: { id: 'asc' } });
    res.json(drinks.map(serializeDrink));
  })
);

/**
 * @swagger
 * /drinks/{id}:
 *   get:
 *     tags: [Drinks]
 *     summary: Получить напиток по ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Напиток
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Drink'
 *       '400':
 *         description: Некорректный id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Напиток не найден
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

    const drink = await prisma.drink.findUnique({ where: { id } });
    if (!drink) return res.status(404).json({ error: 'drink not found' });

    res.json(serializeDrink(drink));
  })
);

/**
 * @swagger
 * /drinks:
 *   post:
 *     tags: [Drinks]
 *     summary: Добавить новый напиток в меню
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price, category]
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Капучино'
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 200
 *               category:
 *                 type: string
 *                 example: 'coffee'
 *     responses:
 *       '201':
 *         description: Созданный напиток
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Drink'
 *       '400':
 *         description: Ошибка валидации (например, price <= 0)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { value, error } = validateDrinkInput(req.body || {});
    if (error) return res.status(400).json({ error });

    const drink = await prisma.drink.create({ data: value });
    res.status(201).json(serializeDrink(drink));
  })
);

/**
 * @swagger
 * /drinks/{id}:
 *   put:
 *     tags: [Drinks]
 *     summary: Обновить информацию о напитке (частичное обновление)
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
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               category:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Обновлённый напиток
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Drink'
 *       '400':
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Напиток не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const existing = await prisma.drink.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'drink not found' });

    const { value, error } = validateDrinkUpdate(req.body || {});
    if (error) return res.status(400).json({ error });

    const drink = await prisma.drink.update({ where: { id }, data: value });
    res.json(serializeDrink(drink));
  })
);

/**
 * @swagger
 * /drinks/{id}:
 *   delete:
 *     tags: [Drinks]
 *     summary: Удалить напиток из меню
 *     description: Напиток, использованный в заказах, удалить нельзя (старые заказы сохраняются) — вернётся 409.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '204':
 *         description: Напиток удалён
 *       '400':
 *         description: Некорректный id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Напиток не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '409':
 *         description: Напиток используется в заказах
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

    const existing = await prisma.drink.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'drink not found' });

    try {
      await prisma.drink.delete({ where: { id } });
    } catch (err) {
      // P2003 — нарушение внешнего ключа: напиток используется в заказах
      if (err.code === 'P2003') {
        return res
          .status(409)
          .json({ error: 'drink is referenced by orders and cannot be deleted' });
      }
      throw err;
    }

    res.status(204).end();
  })
);

module.exports = router;