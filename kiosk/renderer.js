const image = document.getElementById('ad-image');
const statusPanel = document.getElementById('status');
const apiBase = (window.kioskConfig?.apiUrl || 'https://media.safety-linq.com').replace(/\/+$/, '');

let playlist = [];
let currentIndex = 0;
let timer = null;
let playlistSignature = '';
let imageLoadToken = 0;

function assetUrl(path) {
  return new URL(path, apiBase).toString();
}

function setStatus(title, message) {
  statusPanel.hidden = false;
  statusPanel.querySelector('h1').textContent = title;
  statusPanel.querySelector('p').textContent = message;
  image.classList.remove('visible');
}

function hideStatus() {
  statusPanel.hidden = true;
}

async function fetchPlaylist() {
  if (window.kioskApi?.fetchPlaylist) {
    return window.kioskApi.fetchPlaylist();
  }

  const response = await fetch(`${apiBase}/api/playlist`, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Playlist request failed: ${response.status}`);
  }

  return response.json();
}

function scheduleNext(durationSeconds) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    currentIndex = (currentIndex + 1) % playlist.length;
    showCurrentAd();
  }, durationSeconds * 1000);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Browser could not display the downloaded image.'));
    image.src = source;
  });
}

async function resolveImageSource(url) {
  if (window.kioskApi?.resolveAsset) {
    return window.kioskApi.resolveAsset(url);
  }

  return url;
}

async function showCurrentAd() {
  if (!playlist.length) {
    setStatus('Dart Kiosk', 'Waiting for ads...');
    return;
  }

  const ad = playlist[currentIndex % playlist.length];
  const nextImage = assetUrl(ad.imageUrl);
  const token = ++imageLoadToken;

  try {
    setStatus('Loading ad', ad.title || 'Loading image...');
    const imageSource = await resolveImageSource(nextImage);

    if (token !== imageLoadToken) return;

    await loadImage(imageSource);

    if (token !== imageLoadToken) return;

    hideStatus();
    image.classList.add('visible');
    scheduleNext(ad.durationSeconds || 10);
  } catch (error) {
    console.error(error);
    setStatus('Ad image issue', `${ad.title || nextImage} - ${error.message || 'Unknown image error'}`);
    scheduleNext(ad.durationSeconds || 10);
  }
}

async function refreshPlaylist() {
  try {
    const data = await fetchPlaylist();
    const ads = Array.isArray(data.ads) ? data.ads : [];
    const nextSignature = JSON.stringify(
      ads.map((ad) => [ad.id, ad.imageUrl, ad.durationSeconds, ad.title])
    );

    if (nextSignature !== playlistSignature) {
      playlistSignature = nextSignature;
      playlist = ads;
      currentIndex = 0;
      showCurrentAd();
    }
  } catch (error) {
    console.error(error);
    if (!playlist.length) {
      setStatus('Connection issue', `${apiBase} - ${error.message || 'Unknown network error'}`);
    }
  }
}

refreshPlaylist();
setInterval(refreshPlaylist, 15000);
