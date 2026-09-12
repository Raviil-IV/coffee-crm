const { toMoney } = require('./util');

const STATUSES = ['pending', 'ready', 'completed'];

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Валидация тела запроса на создание клиента.
 * Возвращает { value } при успехе или { error } при ошибке.
 */
function validateCustomerInput(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return { error: 'name is required' };
  if (name.length > 100) return { error: 'name must be at most 100 characters' };

  const value = { name };

  if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
    const phone = String(body.phone).trim();
    if (phone.length > 20) return { error: 'phone must be at most 20 characters' };
    value.phone = phone;
  }

  return { value };
}

/**
 * Валидация тела запроса на создание напитка.
 */
function validateDrinkInput(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const { price } = body;

  if (!name) return { error: 'name is required' };
  if (name.length > 100) return { error: 'name must be at most 100 characters' };
  if (!category) return { error: 'category is required' };
  if (category.length > 50) return { error: 'category must be at most 50 characters' };
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return { error: 'price must be a positive number' };
  }

  return { value: { name, category, price: toMoney(price) } };
}

/**
 * Валидация тела запроса на обновление напитка (PUT, частичное обновление).
 */
function validateDrinkUpdate(body = {}) {
  const value = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return { error: 'name must not be empty' };
    if (name.length > 100) return { error: 'name must be at most 100 characters' };
    value.name = name;
  }

  if (body.category !== undefined) {
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!category) return { error: 'category must not be empty' };
    if (category.length > 50) return { error: 'category must be at most 50 characters' };
    value.category = category;
  }

  if (body.price !== undefined) {
    const { price } = body;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      return { error: 'price must be a positive number' };
    }
    value.price = toMoney(price);
  }

  return { value };
}

/**
 * Валидация тела запроса на создание заказа.
 * Ожидаемый формат: { customer_id: number, items: [{ drink_id, quantity }] }
 */
function validateOrderInput(body = {}) {
  if (!isPositiveInt(body.customer_id)) {
    return { error: 'customer_id must be a positive integer' };
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'items must be a non-empty array of { drink_id, quantity }' };
  }

  const normalized = [];
  for (const item of items) {
    if (!item || !isPositiveInt(item.drink_id)) {
      return { error: 'each item must have a positive integer drink_id' };
    }
    if (!isPositiveInt(item.quantity)) {
      return { error: 'each item must have a positive integer quantity' };
    }
    normalized.push({ drinkId: item.drink_id, quantity: item.quantity });
  }

  return { value: { customerId: body.customer_id, items: normalized } };
}

/**
 * Валидация нового статуса заказа.
 */
function validateStatusInput(body = {}) {
  const status = typeof body.status === 'string' ? body.status : '';
  if (!STATUSES.includes(status)) {
    return { error: `status must be one of: ${STATUSES.join(', ')}` };
  }
  return { value: status };
}

module.exports = {
  STATUSES,
  validateCustomerInput,
  validateDrinkInput,
  validateDrinkUpdate,
  validateOrderInput,
  validateStatusInput,
};