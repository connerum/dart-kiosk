module.exports = async function handler(req, res) {
  const { default: adHandler } = await import('../../webapp/api/ads/[id].js');
  return adHandler(req, res);
};
