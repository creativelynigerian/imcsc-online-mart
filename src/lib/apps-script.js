// Client-side bridge to the Google Apps Script backend
export const APPS_SCRIPT_URL = 'REPLACE_WITH_YOUR_WEB_APP_URL';

export async function placeOrder(cart, customer) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const payload = {
    customer: {
      name: customer.name,
      phone: customer.phone,
      address: customer.address
    },
    items: cart.map(i => ({ sku: i.sku, name: i.name, qty: i.qty, price: i.price })),
    total
  };

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors', // required for Apps Script web apps
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  // NOTE: with no-cors you cannot read the response.
  return { ok: true, total };
}