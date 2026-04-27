// ─────────────────────────────────────────────────────────────
//  Netlify Function: analyze-cake (versión Google Gemini v1)
//  Ruta pública: /api/analyze-cake
// ─────────────────────────────────────────────────────────────

export default async (req, context) => {

  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response('Cuerpo de petición inválido', { status: 400 });
  }

  const { imageBase64, imageMime, systemPrompt, userPrompt } = body;

  if (!imageBase64 || !imageMime) {
    return new Response('Faltan datos: imageBase64 o imageMime', { status: 400 });
  }

  const apiKey = Netlify.env.get('GEMINI_API_KEY');

  if (!apiKey) {
    return new Response(
      'API key no configurada en Netlify → Environment variables → GEMINI_API_KEY',
      { status: 500 }
    );
  }

  const model = 'gemini-3-flash';
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

  try {
    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            // En API v1 el system prompt va como primer mensaje del modelo
            role: 'user',
            parts: [{ text: systemPrompt }]
          },
          {
            role: 'model',
            parts: [{ text: 'Entendido. Analizaré la imagen del pastel y responderé únicamente con el JSON solicitado.' }]
          },
          {
            role: 'user',
            parts: [
              {
                inline_data: {
                  mime_type: imageMime,
                  data: imageBase64
                }
              },
              {
                text: userPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return new Response(
        `Error de Gemini (${geminiResponse.status}): ${errorText}`,
        { status: geminiResponse.status }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!rawText) {
      return new Response('Gemini no devolvió texto. Intenta con otra imagen.', { status: 500 });
    }

    // Formato compatible con lo que espera el cotizador
    const formatted = {
      content: [{ type: 'text', text: rawText }]
    };

    return new Response(JSON.stringify(formatted), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(`Error interno: ${err.message}`, { status: 500 });
  }
};

export const config = { path: '/api/analyze-cake' };