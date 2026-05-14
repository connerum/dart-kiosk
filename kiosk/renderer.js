const image = document.getElementById('ad-image');
const nextImageElement = document.getElementById('next-ad-image');
const statusPanel = document.getElementById('status');
const debugPanel = document.getElementById('debug');
const apiBase = (window.kioskConfig?.apiUrl || 'https://media.safety-linq.com').replace(/\/+$/, '');

let playlist = [];
let currentIndex = 0;
let timer = null;
let playlistSignature = '';
let imageLoadToken = 0;
let lastPlaylistUpdatedAt = '';
let lastFetchAt = '';
let hasVisibleAd = false;

debugPanel.hidden = true;

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'd') {
    debugPanel.hidden = !debugPanel.hidden;
  }
});

function setDebug(lines) {
  debugPanel.textContent = [
    `API: ${apiBase}`,
    `Updated: ${lastPlaylistUpdatedAt || 'unknown'}`,
    `Fetched: ${lastFetchAt || 'not yet'}`,
    `Ads: ${playlist.length}`,
    ...lines
  ].join('\n');
}

function logDebug(message, details = '') {
  const line = details ? `${message}: ${details}` : message;
  console.log(`[kiosk] ${line}`);
  setDebug([line]);
}

function assetUrl(path) {
  return new URL(path, apiBase).toString();
}

function setStatus(title, message) {
  statusPanel.hidden = false;
  statusPanel.querySelector('h1').textContent = title;
  statusPanel.querySelector('p').textContent = message;
  image.classList.remove('visible');
  hasVisibleAd = false;
}

function hideStatus() {
  statusPanel.hidden = true;
}

async function fetchPlaylist() {
  logDebug('Fetching playlist', `${apiBase}/api/playlist`);

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

function preloadImage(source) {
  return new Promise((resolve, reject) => {
    nextImageElement.onload = () => resolve();
    nextImageElement.onerror = () => reject(new Error('Browser could not display the downloaded image.'));
    nextImageElement.src = source;
  });
}

async function resolveImageSource(url) {
  if (window.kioskApi?.resolveAsset) {
    logDebug('Resolving image in main process', url);
    return window.kioskApi.resolveAsset(url);
  }

  logDebug('Resolving image in renderer', url);
  return url;
}

async function showCurrentAd() {
  if (!playlist.length) {
    setStatus(
      'Waiting for ads',
      `Fetched 0 ads from ${apiBase}/api/playlist${lastFetchAt ? ` at ${lastFetchAt}` : ''}`
    );
    setDebug(['No ads in playlist response.']);
    return;
  }

  const ad = playlist[currentIndex % playlist.length];
  const nextImage = assetUrl(ad.imageUrl);
  const token = ++imageLoadToken;

  try {
    setDebug([`Showing index ${currentIndex}`, `Title: ${ad.title || 'Untitled'}`, `Image: ${nextImage}`]);
    if (!hasVisibleAd) {
      setStatus('Loading first ad', ad.title || 'Loading image...');
    }

    const imageSource = await resolveImageSource(nextImage);

    if (token !== imageLoadToken) return;

    await preloadImage(imageSource);

    if (token !== imageLoadToken) return;

    image.src = imageSource;
    hideStatus();
    image.classList.add('visible');
    hasVisibleAd = true;
    setDebug([`Showing index ${currentIndex}`, `Title: ${ad.title || 'Untitled'}`, `Image loaded`]);
    scheduleNext(ad.durationSeconds || 10);
  } catch (error) {
    console.error(error);
    if (!hasVisibleAd) {
      setStatus('Ad image issue', `${ad.title || nextImage} - ${error.message || 'Unknown image error'}`);
    }

    setDebug([`Image failed: ${error.message || 'Unknown image error'}`, `Image: ${nextImage}`]);
    scheduleNext(ad.durationSeconds || 10);
  }
}

async function refreshPlaylist() {
  try {
    const data = await fetchPlaylist();
    const ads = Array.isArray(data.ads) ? data.ads : [];
    lastFetchAt = new Date().toLocaleTimeString();
    lastPlaylistUpdatedAt = data.updatedAt || '';
    playlist = ads;
    setDebug([
      `Playlist response ads: ${ads.length}`,
      ads[0] ? `First title: ${ads[0].title || 'Untitled'}` : 'First title: none',
      ads[0] ? `First image: ${ads[0].imageUrl}` : 'First image: none'
    ]);
    const nextSignature = JSON.stringify(
      ads.map((ad) => [ad.id, ad.imageUrl, ad.durationSeconds, ad.title])
    );

    if (nextSignature !== playlistSignature) {
      playlistSignature = nextSignature;
      currentIndex = 0;
      showCurrentAd();
    } else if (!ads.length) {
      setStatus(
        'Waiting for ads',
        `Fetched 0 ads from ${apiBase}/api/playlist at ${lastFetchAt}`
      );
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
