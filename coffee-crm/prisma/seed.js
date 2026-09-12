const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const customers = [
  { name: 'Иван Петров', phone: '+79991234567' },
  { name: 'Мария Сидорова', phone: '+79997654321' },
  { name: 'Алексей Козлов', phone: '+79991112233' },
  { name: 'Ольга Смирнова', phone: '+79995554433' },
  { name: 'Дмитрий Волков', phone: '+79994443322' },
  { name: 'Анна Кузнецова', phone: '+79998887766' },
  { name: 'Сергей Морозов', phone: null },
];

const drinks = [
  { name: 'Эспрессо', price: 150, category: 'coffee' },
  { name: 'Американо', price: 160, category: 'coffee' },
  { name: 'Капучино', price: 200, category: 'coffee' },
  { name: 'Латте', price: 220, category: 'coffee' },
  { name: 'Раф', price: 250, category: 'coffee' },
  { name: 'Зеленый чай', price: 120, category: 'tea' },
  { name: 'Черный чай', price: 120, category: 'tea' },
  { name: 'Матча латте', price: 260, category: 'tea' },
  { name: 'Лимонад', price: 180, category: 'lemonade' },
];

// Формат: [индекс клиента, статус, [[индекс напитка, количество], ...]]
const orders = [
  [0, 'completed', [[0, 2], [2, 1]]],
  [0, 'completed', [[3, 1]]],
  [0, 'pending', [[4, 2]]],
  [1, 'completed', [[2, 1], [4, 1]]],
  [1, 'ready', [[8, 2]]],
  [1, 'completed', [[5, 2], [6, 2]]],
  [2, 'completed', [[0, 1], [1, 1], [2, 1]]],
  [2, 'pending', [[5, 1]]],
  [3, 'completed', [[3, 2], [7, 1]]],
  [3, 'completed', [[6, 1], [8, 1]]],
  [3, 'ready', [[2, 2], [0, 1]]],
  [4, 'ready', [[2, 1]]],
  [4, 'completed', [[4, 1], [0, 1]]],
  [5, 'completed', [[1, 2]]],
  [5, 'pending', [[7, 1], [3, 1]]],
  [6, 'completed', [[0, 1]]],
  [6, 'ready', [[8, 1], [6, 1]]],
];

async function main() {
  // Идемпотентность: сид выполняется только при первом запуске (пустая база)
  const existingOrders = await prisma.order.count();
  if (existingOrders > 0) {
    console.log('База данных уже содержит заказы — тестовые данные не загружаются.');
    return;
  }

  const createdCustomers = [];
  for (const c of customers) {
    createdCustomers.push(await prisma.customer.create({ data: c }));
  }

  const createdDrinks = [];
  for (const d of drinks) {
    createdDrinks.push(await prisma.drink.create({ data: d }));
  }

  for (const [customerIndex, status, items] of orders) {
    await prisma.order.create({
      data: {
        customerId: createdCustomers[customerIndex].id,
        status,
        items: {
          create: items.map(([drinkIndex, quantity]) => ({
            drinkId: createdDrinks[drinkIndex].id,
            quantity,
          })),
        },
      },
    });
  }

  console.log(
    `Тестовые данные загружены: ${createdCustomers.length} клиентов, ` +
      `${createdDrinks.length} напитков, ${orders.length} заказов.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());