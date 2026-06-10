// Telegram notification when a visitor submits a review.
// The review itself is saved to Firestore directly from the browser —
// this function only sends the heads-up ping.
export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const { name, practice, location, review, stars } = await request.json();

    if (!name || !review) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!tgToken || !chatId) {
      console.error('Telegram env vars not set — skipping review notification');
      return Response.json({ success: false }, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const clamp = (v, max) => String(v ?? '').slice(0, max);
    const starCount = Math.min(5, Math.max(1, parseInt(stars, 10) || 5));
    const tgText = `⭐ New Review Submitted\n\n${'★'.repeat(starCount)}${'☆'.repeat(5 - starCount)}\n👤 Name: ${clamp(name, 60)}\n🏢 Business: ${clamp(practice, 80) || 'Not provided'}\n📍 Location: ${clamp(location, 120) || 'Not provided'}\n\n💬 Review:\n${clamp(review, 500)}`;

    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: tgText }),
    });

    return Response.json({ success: true }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('Review notify error:', err);
    return Response.json({ error: 'Server error' }, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
};
