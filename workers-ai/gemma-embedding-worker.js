/**
 * Gemma Embedding Worker for Cloudflare Workers AI
 *
 * Features:
 * - Uses Google's EmbeddingGemma 300M model
 * - Multilingual support (100+ languages)
 * - Matryoshka embeddings (configurable dimensions)
 * - Binary quantization for storage efficiency
 * - Protected by API key authentication
 */

// Configuration
const CONFIG = {
  // Default Matryoshka dimensions (can be 64, 128, 256, 512, 768, 1024, 1536, 2048)
  defaultDimensions: 768,
  maxDimensions: 2048,
  // Model ID
  modelId: '@cf/google/embeddinggemma-300m',
  // Enable binary quantization for storage
  enableBinaryQuantization: true
};

/**
 * Verify API key from request
 * Returns null if valid, error message otherwise
 */
function verifyApiKey(request, env) {
  // Get API key from header or query param
  const authHeader = request.headers.get('Authorization');
  const url = new URL(request.url);
  const apiKeyFromQuery = url.searchParams.get('api_key');

  let providedKey = null;

  // Check Authorization header (Bearer token)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7);
  } else if (apiKeyFromQuery) {
    providedKey = apiKeyFromQuery;
  }

  // If no API key is configured, require one to be set
  if (!env.API_KEY) {
    return 'API_KEY not configured on server';
  }

  // Validate the provided key
  if (!providedKey) {
    return 'API key required. Provide via Authorization: Bearer <key> header or ?api_key=<key> query parameter';
  }

  // Use timing-safe comparison if possible, otherwise simple comparison
  if (providedKey !== env.API_KEY) {
    return 'Invalid API key';
  }

  return null; // Valid
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Parse JSON body
    let body = {};
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid JSON body'
        }), { status: 400, headers: corsHeaders });
      }
    }

    // AI binding
    const ai = env.AI;
    if (!ai) {
      return new Response(JSON.stringify({
        success: false,
        message: 'AI binding not configured. Add [ai] binding to wrangler.toml'
      }), { status: 500, headers: corsHeaders });
    }

    // GET / - Info (public, no auth required)
    if (path === '/' && request.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        name: 'Gemma Embedding Worker',
        model: CONFIG.modelId,
        features: {
          multilingual: true,
          matryoshka: true,
          maxDimensions: CONFIG.maxDimensions,
          defaultDimensions: CONFIG.defaultDimensions,
          quantization: 'binary'
        },
        endpoints: {
          'POST /embed': 'Generate embeddings for text(s)',
          'POST /embed/matryoshka': 'Generate Matryoshka embeddings with custom dimensions',
          'POST /embed/multilingual': 'Generate embeddings for multiple languages',
          'POST /quantize/binary': 'Convert float embeddings to binary',
          'GET /health': 'Health check'
        }
      }), { headers: corsHeaders });
    }

    // GET /health - Health check
    if (path === '/health' && request.method === 'GET') {
      try {
        // Quick test embedding
        await ai.run(CONFIG.modelId, { text: 'test' });
        return new Response(JSON.stringify({
          success: true,
          status: 'healthy',
          model: CONFIG.modelId
        }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          status: 'unhealthy',
          error: e.message
        }), { status: 503, headers: corsHeaders });
      }
    }

    // POST /embed - Generate embeddings (requires API key)
    if (path === '/embed' && request.method === 'POST') {
      // Verify API key
      const authError = verifyApiKey(request, env);
      if (authError) {
        return new Response(JSON.stringify({
          success: false,
          message: authError
        }), { status: 401, headers: corsHeaders });
      }

      try {
        const { text, texts, normalize = true } = body;

        if (!text && (!texts || !Array.isArray(texts))) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Provide "text" (string) or "texts" (array)'
          }), { status: 400, headers: corsHeaders });
        }

        // Single text or batch
        const inputTexts = texts || [text];

        // Generate embeddings
        const embeddings = [];
        for (const t of inputTexts) {
          const result = await ai.run(CONFIG.modelId, {
            text: t
          });
          embeddings.push({
            text: t.length > 50 ? t.substring(0, 50) + '...' : t,
            embedding: result.data[0],
            dimensions: result.data[0].length
          });
        }

        // Binary quantization if enabled
        if (CONFIG.enableBinaryQuantization && body.binary !== false) {
          for (const emb of embeddings) {
            emb.binary = floatToBinary(emb.embedding);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          model: CONFIG.modelId,
          count: embeddings.length,
          dimensions: embeddings[0]?.dimensions || 0,
          embeddings
        }), { headers: corsHeaders });

      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          message: e.message
        }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /embed/matryoshka - Generate Matryoshka embeddings (requires API key)
    if (path === '/embed/matryoshka' && request.method === 'POST') {
      // Verify API key
      const authError = verifyApiKey(request, env);
      if (authError) {
        return new Response(JSON.stringify({
          success: false,
          message: authError
        }), { status: 401, headers: corsHeaders });
      }

      try {
        const { text, texts, dimensions = CONFIG.defaultDimensions } = body;

        if (!text && (!texts || !Array.isArray(texts))) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Provide "text" (string) or "texts" (array)'
          }), { status: 400, headers: corsHeaders });
        }

        // Validate dimensions
        const validDimensions = [64, 128, 256, 512, 768, 1024, 1536, 2048];
        if (!validDimensions.includes(dimensions)) {
          return new Response(JSON.stringify({
            success: false,
            message: `Invalid dimensions. Must be one of: ${validDimensions.join(', ')}`
          }), { status: 400, headers: corsHeaders });
        }

        const inputTexts = texts || [text];
        const embeddings = [];

        for (const t of inputTexts) {
          // Generate full embedding
          const fullResult = await ai.run(CONFIG.modelId, {
            text: t
          });
          const fullEmbedding = fullResult.data[0];

          // Truncate to requested dimensions (Matryoshka)
          const matryoshkaEmbedding = fullEmbedding.slice(0, dimensions);

          embeddings.push({
            text: t.length > 50 ? t.substring(0, 50) + '...' : t,
            embedding: matryoshkaEmbedding,
            dimensions: dimensions,
            originalDimensions: fullEmbedding.length
          });
        }

        return new Response(JSON.stringify({
          success: true,
          model: CONFIG.modelId,
          count: embeddings.length,
          matryoshkaDimensions: dimensions,
          embeddings
        }), { headers: corsHeaders });

      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          message: e.message
        }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /embed/multilingual - Generate embeddings for multiple languages (requires API key)
    if (path === '/embed/multilingual' && request.method === 'POST') {
      // Verify API key
      const authError = verifyApiKey(request, env);
      if (authError) {
        return new Response(JSON.stringify({
          success: false,
          message: authError
        }), { status: 401, headers: corsHeaders });
      }

      try {
        const { texts } = body;

        if (!texts || !Array.isArray(texts)) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Provide "texts" array with {text, language} objects'
          }), { status: 400, headers: corsHeaders });
        }

        const embeddings = [];

        for (const item of texts) {
          const { text, language = 'auto' } = item;

          // Generate embedding - Gemma handles multilingual automatically
          const result = await ai.run(CONFIG.modelId, { text });
          const embedding = result.data[0];

          embeddings.push({
            text: text.length > 50 ? text.substring(0, 50) + '...' : text,
            language,
            embedding,
            dimensions: embedding.length
          });
        }

        return new Response(JSON.stringify({
          success: true,
          model: CONFIG.modelId,
          count: embeddings.length,
          note: 'Gemma embeddings are multilingual and language-agnostic',
          embeddings
        }), { headers: corsHeaders });

      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          message: e.message
        }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /quantize/binary - Convert float embeddings to binary (requires API key)
    if (path === '/quantize/binary' && request.method === 'POST') {
      // Verify API key
      const authError = verifyApiKey(request, env);
      if (authError) {
        return new Response(JSON.stringify({
          success: false,
          message: authError
        }), { status: 401, headers: corsHeaders });
      }

      try {
        const { embedding } = body;

        if (!embedding || !Array.isArray(embedding)) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Provide "embedding" array'
          }), { status: 400, headers: corsHeaders });
        }

        const binary = floatToBinary(embedding);

        return new Response(JSON.stringify({
          success: true,
          originalDimensions: embedding.length,
          binarySize: binary.length,
          compressionRatio: (embedding.length * 4 / binary.length).toFixed(2) + 'x',
          binary
        }), { headers: corsHeaders });

      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          message: e.message
        }), { status: 500, headers: corsHeaders });
      }
    }

    // 404
    return new Response(JSON.stringify({
      success: false,
      message: 'Not found',
      available: ['/', '/health', '/embed', '/embed/matryoshka', '/embed/multilingual', '/quantize/binary']
    }), { status: 404, headers: corsHeaders });
  }
};

/**
 * Convert float32 embedding to binary (1-bit per dimension)
 * Positive values -> 1, Negative values -> 0
 * Returns base64 string (Cloudflare Workers compatible)
 */
function floatToBinary(embedding) {
  const bits = embedding.map(v => v >= 0 ? 1 : 0);
  const bytes = [];

  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < bits.length; j++) {
      byte = (byte << 1) | bits[i + j];
    }
    bytes.push(byte);
  }

  // Convert bytes to base64 (Cloudflare Workers compatible)
  const binaryString = bytes.map(b => String.fromCharCode(b)).join('');
  return btoa(binaryString);
}
