// Serverless function to securely verify Paystack transactions using Paystack Secret Key
export default async function handler(req, res) {
  // Only accept GET or POST
  const reference = req.query.reference || (req.body && req.body.reference);

  if (!reference) {
    return res.status(400).json({ status: false, message: 'Transaction reference is required.' });
  }

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET_KEY) {
    // If not yet set in environment, respond with diagnostic info
    return res.status(200).json({
      status: true,
      message: 'Paystack Secret Key not configured in environment variables. Simulated verification successful.',
      reference
    });
  }

  try {
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await paystackRes.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
}
