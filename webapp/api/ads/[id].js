import { deleteAd, updateAd } from '../../server/storage.js';
import { applyCors, handleOptions, readJsonBody, sendError, sendJson } from '../_lib/http.js';

function getId(req) {
  const value = req.query?.id;
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const id = getId(req);

  if (!id) {
    sendJson(res, 400, { error: 'Ad id is required.' });
    return;
  }

  try {
    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      sendJson(res, 200, await updateAd(id, body));
      return;
    }

    if (req.method === 'DELETE') {
      await deleteAd(id);
      applyCors(res);
      res.statusCode = 204;
      res.end();
      return;
    }

    res.setHeader('Allow', 'PATCH, DELETE');
    sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    sendError(res, error);
  }
}
