console.log('ENV CHECK:', {
  pixelId: process.env.TIKTOK_PIXEL_ID,
  hasToken: !!process.env.TIKTOK_ACCESS_TOKEN,
  hasTagada: !!process.env.TAGADA_API_KEY
});
const crypto = require('crypto');

function hashData(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
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

    email = orderData?.order?.customer?.email || orderData?.order?.billingAddress?.email;
    phone = orderData?.order?.billingAddress?.phone || orderData?.order?.customer?.billingAddress?.phone;
    amount = orderData?.order?.paidAmount ? orderData.order.paidAmount / 100 : null;

    console.log('Email found:', email);
    console.log('Phone found:', phone);
    console.log('Amount found:', amount);
  } catch (err) {
    console.log('Error fetching order:', err.message);
  }

  const pixelId = String(process.env.TIKTOK_PIXEL_ID).trim();
  const accessToken = String(process.env.TIKTOK_ACCESS_TOKEN).trim();

  const payload = {
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

  console.log('Pixel ID used:', pixelId);
  console.log('Payload sent:', JSON.stringify(payload));

  try {
    const response = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/pixel/track/?pixel_code=${pixelId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': accessToken
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
