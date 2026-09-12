/* Coffee CRM — клиентская логика (vanilla JS, без зависимостей) */

const $ = (sel) => document.querySelector(sel);

/* ---------- Утилиты ---------- */

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}

let toastTimer = null;
function toast(message, ok = true) {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast show ${ok ? 'ok' : 'err'}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3000);
}

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', minimumFractionDigits: 2,
});
const fmtMoney = (value) => moneyFormatter.format(value);

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

/* ---------- Состояние ---------- */

let customers = [];
let drinks = [];
let orders = [];
let editingDrinkId = null;

const drinksById = () => new Map(drinks.map((d) => [d.id, d]));

/* ---------- Вкладки ---------- */

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach((p) =>
      p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`)
    );
  });
});

/* ---------- Клиенты ---------- */

function populateCustomerSelects() {
  const options = customers
    .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join('') || '<option value="">Клиентов нет</option>';
  $('#order-customer').innerHTML = options;
}

async function refreshCustomers() {
  customers = await api('/customers');
  $('#customers-tbody').innerHTML = customers.map((c) => `
    <tr>
      <td>${c.id}</td>
      <td>${esc(c.name)}</td>
      <td>${esc(c.phone ?? '—')}</td>
      <td>${fmtDate(c.registered_at)}</td>
      <td class="actions">
        <button class="btn btn-danger btn-sm" data-del-customer="${c.id}">Удалить</button>
      </td>
    </tr>`).join('');
  $('#customers-empty').classList.toggle('hidden', customers.length > 0);
  populateCustomerSelects();
}

$('#customer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim() || null,
  };
  try {
    await api('/customers', { method: 'POST', body: JSON.stringify(payload) });
    toast('Клиент добавлен');
    form.reset();
    await refreshCustomers();
  } catch (err) {
    toast(err.message, false);
  }
});

$('#customers-tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del-customer]');
  if (!btn) return;
  if (!confirm('Удалить клиента? Все его заказы будут удалены.')) return;
  try {
    await api(`/customers/${btn.dataset.delCustomer}`, { method: 'DELETE' });
    toast('Клиент удалён');
    await refreshCustomers();
  } catch (err) {
    toast(err.message, false);
  }
});

/* ---------- Напитки ---------- */

function resetDrinkForm() {
  editingDrinkId = null;
  const form = $('#drink-form');
  form.reset();
  $('#drink-submit').textContent = 'Добавить напиток';
  $('#drink-cancel').classList.add('hidden');
}

function populateDrinkSelects() {
  const options = drinks
    .map((d) => `<option value="${d.id}">${esc(d.name)} — ${fmtMoney(d.price)}</option>`)
    .join('');
  document.querySelectorAll('.item-drink').forEach((sel) => {
    if (sel.options.length === 0) sel.innerHTML = options;
  });
}

async function renderDrinks() {
  drinks = await api('/drinks');
  $('#drinks-tbody').innerHTML = drinks.map((d) => `
    <tr>
      <td>${d.id}</td>
      <td>${esc(d.name)}</td>
      <td class="num">${fmtMoney(d.price)}</td>
      <td>${esc(d.category)}</td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" data-edit-drink="${d.id}">Изменить</button>
        <button class="btn btn-danger btn-sm" data-del-drink="${d.id}">Удалить</button>
      </td>
    </tr>`).join('');
  $('#drinks-empty').classList.toggle('hidden', drinks.length > 0);
  populateDrinkSelects();
}

function startEditDrink(id) {
  const drink = drinks.find((d) => d.id === id);
  if (!drink) return;
  editingDrinkId = drink.id;
  const form = $('#drink-form');
  form.name.value = drink.name;
  form.price.value = drink.price;
  form.category.value = drink.category;
  $('#drink-submit').textContent = 'Сохранить изменения';
  $('#drink-cancel').classList.remove('hidden');
  form.name.focus();
}

$('#drink-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    if (editingDrinkId) {
      await api(`/drinks/${editingDrinkId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name.value.trim(),
          price: Number(form.price.value),
          category: form.category.value,
        }),
      });
      toast('Напиток обновлён');
    } else {
      await api('/drinks', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.value.trim(),
          price: Number(form.price.value),
          category: form.category.value,
        }),
      });
      toast('Напиток добавлен');
    }
    resetDrinkForm();
    await renderDrinks();
  } catch (err) {
    toast(err.message, false);
  }
});

$('#drink-cancel').addEventListener('click', resetDrinkForm);

$('#drinks-tbody').addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-edit-drink]');
  if (editBtn) return startEditDrink(Number(editBtn.dataset.editDrink));

  const delBtn = e.target.closest('[data-del-drink]');
  if (!delBtn) return;
  if (!confirm('Удалить напиток из меню?')) return;
  try {
    await api(`/drinks/${delBtn.dataset.delDrink}`, { method: 'DELETE' });
    toast('Напиток удалён');
    await renderDrinks();
  } catch (err) {
    toast(err.message, false);
  }
});

/* ---------- Заказы: создание ---------- */

function itemRowHtml() {
  const options = drinks
    .map((d) => `<option value="${d.id}">${esc(d.name)} — ${fmtMoney(d.price)}</option>`)
    .join('') || '<option value="">Меню пусто</option>';
  return `
    <div class="item-row">
      <select class="item-drink">${options}</select>
      <input class="item-qty" type="number" min="1" value="1">
      <button class="btn btn-ghost btn-sm item-remove" type="button" title="Убрать">✕</button>
    </div>`;
}

function addItemRow() {
  $('#order-items').insertAdjacentHTML('beforeend', itemRowHtml());
  recalcOrderTotal();
}

function recalcOrderTotal() {
  const map = drinksById();
  let total = 0;
  document.querySelectorAll('#order-items .item-row').forEach((row) => {
    const drink = map.get(Number(row.querySelector('.item-drink').value));
    const qty = Number(row.querySelector('.item-qty').value) || 0;
    if (drink) total += Number(drink.price) * qty;
  });
  $('#order-total').textContent = fmtMoney(total);
}

$('#order-add-item').addEventListener('click', addItemRow);

$('#order-items').addEventListener('input', recalcOrderTotal);
$('#order-items').addEventListener('change', recalcOrderTotal);

$('#order-items').addEventListener('click', (e) => {
  const btn = e.target.closest('.item-remove');
  if (!btn) return;
  const rows = document.querySelectorAll('#order-items .item-row');
  if (rows.length === 1) {
    toast('Должна остаться хотя бы одна позиция', false);
    return;
  }
  btn.closest('.item-row').remove();
  recalcOrderTotal();
});

$('#order-submit').addEventListener('click', async () => {
  const customerId = Number($('#order-customer').value);
  if (!customerId) return toast('Выберите клиента', false);

  const items = [...document.querySelectorAll('#order-items .item-row')]
    .map((row) => ({
      drink_id: Number(row.querySelector('.item-drink').value),
      quantity: Number(row.querySelector('.item-qty').value),
    }))
    .filter((i) => Number.isInteger(i.drink_id) && i.drink_id > 0 && Number.isInteger(i.quantity) && i.quantity > 0);

  if (!items.length) return toast('Добавьте хотя бы одну позицию', false);

  try {
    await api('/orders', { method: 'POST', body: JSON.stringify({ customer_id: customerId, items }) });
    toast('Заказ создан');
    $('#order-items').innerHTML = '';
    addItemRow();
    await refreshOrders();
  } catch (err) {
    toast(err.message, false);
  }
});

/* ---------- Заказы: список ---------- */

function orderCardHtml(order) {
  const itemsRows = order.items.map((it) => `
    <tr>
      <td>${esc(it.name)}</td>
      <td class="num">× ${it.quantity}</td>
      <td class="num">${fmtMoney(it.price)}</td>
      <td class="num">${fmtMoney(it.total)}</td>
    </tr>`).join('');

  return `
    <div class="order-card">
      <div class="order-head">
        <div>
          <strong>Заказ №${order.id}</strong>
          <span class="muted">· ${esc(order.customer_name)} · ${fmtDate(order.created_at)}</span>
        </div>
        <div class="order-actions">
          <select class="status-select ${order.status}" data-order-status="${order.id}">
            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>pending</option>
            <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>ready</option>
            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>completed</option>
          </select>
          <button class="btn btn-danger btn-sm" data-del-order="${order.id}">Удалить</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="mini">
          <thead><tr><th>Напиток</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
          <tbody>${itemsRows}</tbody>
        </table>
      </div>
      <div class="order-foot">Итого: <strong>${fmtMoney(order.total)}</strong></div>
    </div>`;
}

async function refreshOrders() {
  orders = await api('/orders');
  $('#orders-list').innerHTML =
    orders.map(orderCardHtml).join('') ||
    '<p class="empty">Заказов пока нет</p>';
}

$('#orders-list').addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-order-status]');
  if (!sel) return;
  try {
    await api(`/orders/${sel.dataset.orderStatus}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: sel.value }),
    });
    toast(`Статус заказа №${sel.dataset.orderStatus}: ${sel.value}`);
    await refreshOrders();
  } catch (err) {
    toast(err.message, false);
  }
});

$('#orders-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del-order]');
  if (!btn) return;
  if (!confirm(`Удалить заказ №${btn.dataset.delOrder}?`)) return;
  try {
    await api(`/orders/${btn.dataset.delOrder}`, { method: 'DELETE' });
    toast('Заказ удалён');
    await refreshOrders();
  } catch (err) {
    toast(err.message, false);
  }
});

/* ---------- Инициализация ---------- */

(async function init() {
  try {
    await Promise.all([
      refreshCustomers(),
      renderDrinks(),
      refreshOrders(),
    ]);
    addItemRow();
  } catch (err) {
    toast('Не удалось загрузить данные: ' + err.message, false);
  }
})();