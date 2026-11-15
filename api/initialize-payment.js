// Serverless Function: Initialize Paystack Standard Transaction Redirect
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  const { email, amount, orderId, metadata } = req.body || {};

  if (!email || !amount) {
    return res.status(400).json({ status: false, message: 'Email and amount are required.' });
  }

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      status: false,
      message: 'PAYSTACK_SECRET_KEY is not configured in Vercel environment variables.'
    });
  }

  // Paystack expects amount in Kobo (e.g. 1400 NGN = 140000 kobo)
  const amountInKobo = Math.round(Number(amount));

  const origin = req.headers.origin || 'https://shop.ccyiglobalentwebng.com.ng';
  const callback_url = `${origin}/payment/callback.html`;

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email.trim(),
        amount: amountInKobo,
        reference: orderId || `IMCSC-${Date.now()}`,
        callback_url: callback_url,
        metadata: metadata || {}
      })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Paystack initialization error:', error);
    return res.status(500).json({ status: false, message: error.message });
  }
}
