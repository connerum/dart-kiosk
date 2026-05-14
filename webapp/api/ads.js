import { createAd } from '../server/storage.js';
import { handleOptions, readJsonBody, sendError, sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    sendJson(res, 201, await createAd(body));
  } catch (error) {
    sendError(res, error);
  }
}
