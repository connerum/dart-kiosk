import { handleOptions, sendError, sendJson } from './_lib/http.js';
import { getPublicPlaylist } from '../server/storage.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    sendJson(res, 200, await getPublicPlaylist());
  } catch (error) {
    sendError(res, error);
  }
}
