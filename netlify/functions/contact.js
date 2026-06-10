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
    const { name, email, phone, message } = await request.json();

    if (!name || !email || !message) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Save to Firestore
    const projectId = 'website-reviews-16f40';
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/contact_submissions`;
    
    const doc = {
      fields: {
        name: { stringValue: name },
        email: { stringValue: email },
        phone: { stringValue: phone || '' },
        message: { stringValue: message },
        createdAt: { timestampValue: new Date().toISOString() },
        read: { booleanValue: false },
      },
    };

    const firestorePromise = fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    }).catch(err => console.error('Firestore error:', err));

    // 2. Send Telegram notification (credentials live in Netlify env vars)
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const tgText = `📩 *New Contact Form Submission*\n\n👤 *Name:* ${name}\n📧 *Email:* ${email}\n📱 *Phone:* ${phone || 'Not provided'}\n\n💬 *Message:*\n${message}`;

    const tgPromise = (tgToken && chatId)
      ? fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: tgText,
            parse_mode: 'Markdown',
          }),
        }).catch(err => console.error('Telegram error:', err))
      : Promise.resolve(console.error('Telegram env vars not set — skipping notification'));

    // Run both in parallel
    await Promise.all([firestorePromise, tgPromise]);

    return Response.json({ success: true }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    console.error('Contact form error:', err);
    return Response.json({ error: 'Server error' }, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
};
