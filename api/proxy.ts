import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Gitea-Url, X-Gitea-Token');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Gitea URL and token from axios headers
  const giteaUrl = req.headers['x-gitea-url'] as string;
  const giteaToken = req.headers['x-gitea-token'] as string;
  
  if (!giteaUrl || !giteaToken) {
    res.status(400).json({ error: 'Missing authentication headers' });
    return;
  }

  const baseUrl = giteaUrl.endsWith('/') ? giteaUrl.slice(0, -1) : giteaUrl;

  // Vercel rewrites /api/proxy/repos/... to /api/proxy?path=repos/...
  // The full encoded path comes as a single string
  const encodedPath = (req.query.path as string) || '';
  const decodedPath = decodeURIComponent(encodedPath);
  const targetUrl = `${baseUrl}/api/v1/${decodedPath}`;

  // Remove undefined params
  const queryParams = Object.fromEntries(
    Object.entries(req.query).filter(([, v]) => v !== undefined)
  );
  const queryString = new URLSearchParams(queryParams as Record<string, string>).toString();
  const finalUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

  try {
    const response = await fetch(finalUrl, {
      method: req.method,
      headers: {
        'Authorization': `token ${giteaToken}`,
        'Content-Type': 'application/json',
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method || '') ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Failed to proxy request to Gitea' });
  }
}
