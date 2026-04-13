const crypto = require('crypto');

function hashData(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const event = req.body;
  const orderId = event?.data?.orderId;

  if (!orderId) {
    return res.status(400).json({ error: 'No orderId found' });
  }

  // Récupérer les détails complets de la commande via l'API Tagada
  let email, phone, amount;
  try {
    const orderResponse = await fetch(
      `https://app.tagadapay.com/api/v1/orders/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TAGADA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const orderData = await orderResponse.json();
    console.log('Tagada order data:', JSON.stringify(orderData));

    email = orderData?.customer?.email || orderData?.email;
    phone = orderData?.customer?.phone || orderData?.phone;
    amount = orderData?.paidAmount || orderData?.totalAmount || event?.data?.lineItems?.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0) / 100;
  } catch (err) {
    console.log('Error fetching order:', err.message);
  }

  const payload = {
    pixel_code: process.env.TIKTOK_PIXEL_ID,
    data: [
      {
        event: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        order_id: orderId,
        user: {
          email: hashData(email),
          phone_number: hashData(phone),
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          user_agent: req.headers['user-agent']
        },
        properties: {
          currency: 'USD',
          value: amount,
          content_type: 'product'
        }
      }
    ]
  };

  console.log('Payload sent to TikTok:', JSON.stringify(payload));

  try {
    const response = await fetch(
      'https://business-api.tiktok.com/open_api/v1.3/event/track/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': process.env.TIKTOK_ACCESS_TOKEN
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();
    console.log('TikTok response:', JSON.stringify(result));
    return res.status(200).json(result);
  } catch (error) {
    console.log('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
