module.exports = async function handler(req, res) {
  const { default: playlistHandler } = await import('../webapp/api/playlist.js');
  return playlistHandler(req, res);
};
