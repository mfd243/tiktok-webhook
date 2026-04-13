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
  const order = event?.data?.order || event?.data;

  const email = order?.customer?.email || order?.email;
  const phone = order?.customer?.phone || order?.phone;
  const amount = order?.paidAmount || order?.totalAmount;
  const orderId = order?.id || order?.orderId;

  const payload = {
    data: [
      {
        event: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        order_id: orderId,
        user: {
          email: hashData(email),
          phone_number: hashData(phone),
          ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
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

  try {
    const response = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/event/track/?pixel_code=${process.env.TIKTOK_PIXEL_ID}`,
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
console.log('Payload sent:', JSON.stringify(payload));
return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
