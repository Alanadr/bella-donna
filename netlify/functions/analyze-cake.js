// ─────────────────────────────────────────────────────────────
//  Netlify Function: analyze-cake (versión Google Gemini)
//  Ruta pública: /api/analyze-cake
//
//  Recibe la imagen desde el navegador, llama a la API de
//  Google Gemini con visión, y devuelve el resultado.
//
//  La API key NUNCA toca el navegador — siempre está aquí,
//  como variable de entorno segura en Netlify.
// ─────────────────────────────────────────────────────────────

export default async (req, context) => {

  // Solo aceptamos peticiones POST
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  // Leemos el cuerpo de la petición (viene del cotizador)
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response('Cuerpo de petición inválido', { status: 400 });
  }

  const { imageBase64, imageMime, systemPrompt, userPrompt } = body;

  // Validamos que llegaron los datos necesarios
  if (!imageBase64 || !imageMime) {
    return new Response('Faltan datos: imageBase64 o imageMime', { status: 400 });
  }

  // Leemos la API key de Gemini desde las variables de entorno de Netlify
  const apiKey = Netlify.env.get('GEMINI_API_KEY');

  if (!apiKey) {
    return new Response(
      'API key no configurada. Ve a Netlify → Site configuration → Environment variables y agrega GEMINI_API_KEY',
      { status: 500 }
    );
  }

  // Modelo de Gemini con visión (analiza imágenes)
 const model = 'gemini-1.5-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Llamamos a la API de Gemini desde el servidor
  try {
    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // El "system prompt" en Gemini va en system_instruction
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                // La imagen en base64
                inline_data: {
                  mime_type: imageMime,
                  data: imageBase64
                }
              },
              {
                // El mensaje de texto
                text: userPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,       // Respuestas más precisas y consistentes
          maxOutputTokens: 1000
        }
      })
    });

    // Si Gemini devuelve error, lo pasamos al navegador
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return new Response(
        `Error de Gemini (${geminiResponse.status}): ${errorText}`,
        { status: geminiResponse.status }
      );
    }

    const geminiData = await geminiResponse.json();

    // Extraemos el texto de la respuesta de Gemini
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!rawText) {
      return new Response(
        'Gemini no devolvió texto. Intenta con otra imagen.',
        { status: 500 }
      );
    }

    // Convertimos al formato que espera el cotizador
    // (igual que la respuesta de Anthropic, con content[].text)
    const formatted = {
      content: [{ type: 'text', text: rawText }]
    };

    return new Response(JSON.stringify(formatted), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(
      `Error interno: ${err.message}`,
      { status: 500 }
    );
  }
};

// Esta línea le dice a Netlify que esta función responde en /api/analyze-cake
export const config = { path: '/api/analyze-cake' };
