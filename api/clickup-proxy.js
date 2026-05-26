/**
 * Vercel serverless function — proxy de LEITURA para a API do ClickUp.
 * Usado pelo Dashboard de Tráfego (rota /dashboard) para buscar listas e
 * tarefas de uma pasta de cliente (aba "Atividades").
 *
 * Renomeado de `clickup.js` para `clickup-proxy.js` porque a Área do Cliente
 * já tem um `api/clickup.js` (Edge Function POST que cria pasta/lista no
 * onboarding). São funções distintas — esta é GET e só lê.
 *
 * A API key fica apenas server-side. Reusa a env var CLICKUP_API_TOKEN já
 * configurada na AC (com fallback para CLICKUP_API_KEY, nome usado no projeto
 * dashboard-trafego original).
 */
const ALLOWED_PREFIXES = ['folder/', 'list/', 'space/'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.CLICKUP_API_TOKEN || process.env.CLICKUP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ClickUp API key not configured' });

  const { path, ...queryParams } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path parameter' });

  const isAllowed = ALLOWED_PREFIXES.some(p => path.startsWith(p));
  if (!isAllowed) return res.status(403).json({ error: 'Path not allowed' });

  const qs = new URLSearchParams(queryParams).toString();
  const url = `https://api.clickup.com/api/v2/${path}${qs ? '?' + qs : ''}`;

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'ClickUp API request failed', details: error.message });
  }
}
