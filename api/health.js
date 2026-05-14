module.exports = async function handler(req, res) {
  const { default: healthHandler } = await import('../webapp/api/health.js');
  return healthHandler(req, res);
};
