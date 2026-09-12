// Округление денежных значений до копеек
const toMoney = (value) => Math.round(Number(value) * 100) / 100;

// Обёртка для async-обработчиков Express: ошибки уходят в error-middleware
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Разбор положительного целого id из строки (url-параметр); null — если некорректен
const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

module.exports = { toMoney, asyncHandler, parseId };