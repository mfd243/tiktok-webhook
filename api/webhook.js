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
  console.log('Tagada payload received:', JSON.stringify(event));

  const order = event?.data || event;
  const customer = order?.customer || order?.billingAddress || {};
  
  const email = customer?.email || order?.email;
  const phone = customer?.phone || customer?.phoneNumber || order?.phone;
  const amount = order?.paidAmount || order?.totalAmount || order?.amount;
  const orderId = order?.id || order?.orderId;

  const pixelId = process.env.TIKTOK_PIXEL_ID;

  const payload = {
    pixel_code: pixelId,
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

  console.log('Payload sent:', JSON.stringify(payload));

  try {
    const response = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/event/track/`,
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
