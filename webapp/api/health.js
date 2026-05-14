import { handleOptions, sendJson } from './_lib/http.js';
import { useBlobStorage } from '../server/storage.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  sendJson(res, 200, {
    ok: true,
    storage: useBlobStorage ? 'vercel-blob' : 'local-disk'
  });
}
