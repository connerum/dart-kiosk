module.exports = async function handler(req, res) {
  const { default: adsHandler } = await import('../webapp/api/ads.js');
  return adsHandler(req, res);
};
