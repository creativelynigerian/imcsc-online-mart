// Serverless API endpoint: Send order notifications to Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9239200531:AAERuG8XILExJYVy5eKHrb0Y2ywwi3UGZb0';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6302097044';

function formatNaira(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  try {
    const { orderId, customer, items, subtotal, deliveryFee, total, paymentMethod, paymentStatus } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ status: false, message: 'Order ID is required' });
    }

    const itemsText = Array.isArray(items) && items.length > 0
      ? items.map((it, idx) => `  ${idx + 1}. *${it.name || it.sku}* x${it.qty} — ${formatNaira((it.price || 0) * (it.qty || 1))}`).join('\n')
      : '  No item details';

    const payBadge = paymentMethod === 'bank'
      ? '🏛️ *Direct Bank Transfer* (Awaiting confirmation)'
      : '💳 *Paystack Online* (Paid / Secured)';

    const message = 
`🛍️ *NEW ORDER RECEIVED! — Impact Makers CSC Mart*

🧾 *Order Ref:* \`${orderId}\`
💰 *Total:* *${formatNaira(total)}*
   _(Subtotal: ${formatNaira(subtotal)} | Delivery: ${formatNaira(deliveryFee)})_
💳 *Payment:* ${payBadge}

👤 *Customer Details:*
• *Name:* ${customer?.name || 'N/A'}
• *Phone:* ${customer?.phone || 'N/A'}
• *Email:* ${customer?.email || 'N/A'}
• *Delivery Region:* ${customer?.region || 'Ota'}
• *Address:* ${customer?.address || 'N/A'}
${customer?.notes ? `• *Notes:* ${customer.notes}\n` : ''}
📦 *Items Ordered:*
${itemsText}

⏰ _${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })}_
🌐 *shop.ccyiglobalentwebng.com.ng*`;

    const telegramRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const data = await telegramRes.json();
    return res.status(200).json({ status: true, telegram: data });
  } catch (error) {
    console.error('Telegram notification error:', error);
    return res.status(500).json({ status: false, error: error.message });
  }
}
