const { BrowserWindow, session } = require('electron');
const adblocker = require('./adblocker');

let captureSession = null;

function getCaptureSession() {
  if (!captureSession) captureSession = session.fromPartition('persist:player');
  return captureSession;
}

// Used only for debugger logging; the shared adblocker service performs the
// actual blocking before requests reach the capture observer.
function isBlockedHost(url) {
  return adblocker.isFallbackBlocked(url);
}

function isM3u8Url(url) {
  return /\.m3u8([?#]|$)/i.test(url);
}

function isMpdUrl(url) {
  return /\.mpd([?#]|$)/i.test(url);
}

function isStreamManifestUrl(url) {
  return isM3u8Url(url) || isMpdUrl(url);
}

async function isCloudflareChallenge(win) {
  try {
    const url = win.webContents.getURL();
    if (url.includes('/cdn-cgi/')) return true;
    const hasChallenge = await win.webContents.executeJavaScript(`
      (() => {
        try {
          const text = document.body?.innerText || '';
          return text.includes('Just a moment') ||
            text.includes('Checking your browser') ||
            text.includes('DDoS protection') ||
            !!document.querySelector('#cf-challenge') ||
            !!document.querySelector('#cf-please-wait') ||
            !!document.querySelector('[id*="challenge"]');
        } catch { return false; }
      })()
    `);
    return !!hasChallenge;
  } catch { return false; }
}

async function waitForCloudflareBypass(win, hostname, maxWaitMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const isChallenge = await isCloudflareChallenge(win);
    if (!isChallenge) {
      console.log(`[hls-capture] Cloudflare bypassed for ${hostname} after ${Date.now() - start}ms`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`[hls-capture] Cloudflare bypass TIMED OUT after ${maxWaitMs}ms for ${hostname}`);
  return false;
}

function captureM3u8Url(playerUrl, timeoutMs = 120000, options = {}) {
  const { visible = false, autoPlay = true } = options;
  return new Promise((resolve, reject) => {
    const capSession = getCaptureSession();
    const hostname = (() => { try { return new URL(playerUrl).hostname; } catch { return 'unknown'; } })();
    let resolved = false;
    let debuggerAttached = false;
    let pollTimer = null;
    let polling = false;
    let iframeDepth = 0;
    const MAX_IFRAME_DEPTH = 3;
    let removeRequestObserver = null;
    let requestCount = 0;
    let vidsrcReloaded = false;

    console.log(`[hls-capture] Starting capture for ${hostname} | URL: ${playerUrl} | timeout: ${timeoutMs}ms`);

    const finalize = (url, referer) => {
      if (resolved) return;
      console.log(`[hls-capture] >>> FOUND stream URL via ${hostname}: ${url} referer: ${referer}`);
      resolved = true;
      cleanup();
      capSession.cookies.get({ url }).then((cookies) => {
        resolve({
          m3u8Url: url,
          referer: referer || playerUrl,
          cookies: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
        });
      }).catch(() => {
        resolve({ m3u8Url: url, referer: referer || playerUrl, cookies: '' });
      });
    };

    const cleanup = () => {
      console.log(`[hls-capture] Cleanup for ${hostname} (resolved=${resolved})`);
      if (debuggerAttached) {
        try { win.webContents.debugger.detach(); } catch (e) { console.log(`[hls-capture] detach error: ${e.message}`); }
      }
      if (win && !win.isDestroyed()) win.close();
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (removeRequestObserver) removeRequestObserver();
    };

    const timeoutTimer = setTimeout(() => {
      if (!resolved) {
        console.log(`[hls-capture] >>> TIMED OUT for ${hostname} after ${timeoutMs}ms (requests seen: ${requestCount})`);
        resolved = true;
        cleanup();
        reject(new Error('Stream capture timed out'));
      }
    }, timeoutMs);

    const win = new BrowserWindow({
      width: 1280,
      height: 720,
      show: visible,
      ...(visible ? {} : { skipTaskbar: true }),
      webPreferences: {
        partition: 'persist:player',
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: false,
      },
    });

    win.webContents.setAudioMuted(true);

    /* Strategy A: Debugger — lightweight, catches fetch/XHR from all frames + inspects responses for m3u8 */
    (async () => {
      try {
        await win.webContents.debugger.attach('1.3');
        debuggerAttached = true;
        console.log(`[hls-capture] Debugger ATTACHED for ${hostname}`);
        win.webContents.debugger.on('message', async (event, method, params) => {
          if (resolved) return;
          if (method === 'Network.requestWillBeSent') {
            requestCount++;
            const reqUrl = params.request?.url || '';
            if (reqUrl && !isBlockedHost(reqUrl)) {
              console.log(`[hls-capture] [debugger] request #${requestCount}: ${reqUrl.slice(0, 200)}`);
            }
            if (isStreamManifestUrl(reqUrl)) {
              console.log(`[hls-capture] [debugger] FOUND stream manifest in request: ${reqUrl}`);
              finalize(reqUrl, params.documentURL);
            }
          }
          if (method === 'Network.responseReceived') {
            const respUrl = params.response?.url || '';
            if (!respUrl || isBlockedHost(respUrl)) return;
            const mime = params.response?.mimeType || '';
            const isApiLike = /json|text|javascript/i.test(mime) && (
              respUrl.includes('api.') || respUrl.includes('/api/') ||
              respUrl.includes('graphql') || respUrl.includes('/source') ||
              respUrl.includes('/embed') || respUrl.includes('/getVideo') ||
              respUrl.includes('allanime')
            );
            if (isApiLike && respUrl && !respUrl.endsWith('.js') && !respUrl.endsWith('.css')) {
              console.log(`[hls-capture] [debugger] responseReceived (may contain a stream manifest): ${respUrl.slice(0, 250)} mime=${mime}`);
              try {
                const bodyResp = await win.webContents.debugger.sendCommand('Network.getResponseBody', { requestId: params.requestId });
                const body = bodyResp?.body || '';
                const manifestRegex = /https?:\/\/[^\s"']+\.(?:m3u8|mpd)[^\s"']*/i;
                if (bodyResp?.base64Encoded) {
                  const buf = Buffer.from(body, 'base64');
                  const decoded = buf.toString('utf-8');
                  const manifestMatch = decoded.match(manifestRegex);
                  if (manifestMatch) {
                    console.log(`[hls-capture] [debugger] FOUND stream manifest in API response body: ${manifestMatch[0]}`);
                    finalize(manifestMatch[0], respUrl);
                  }
                } else {
                  const manifestMatch = body.match(manifestRegex);
                  if (manifestMatch) {
                    console.log(`[hls-capture] [debugger] FOUND stream manifest in API response body: ${manifestMatch[0]}`);
                    finalize(manifestMatch[0], respUrl);
                  }
                }
              } catch (bodyErr) {
                console.log(`[hls-capture] [debugger] getResponseBody failed for ${respUrl.slice(0, 200)}: ${bodyErr.message}`);
              }
            }
          }
        });
        await win.webContents.debugger.sendCommand('Network.enable');
        console.log(`[hls-capture] Debugger Network.enable OK for ${hostname}`);
      } catch (err) {
        console.error(`[hls-capture] Debugger attach FAILED for ${hostname}:`, err.message, err.stack);
      }
    })();

    /* Strategy B: observe the shared adblock webRequest listener */
    removeRequestObserver = adblocker.addRequestObserver(capSession, (details) => {
      if (resolved) return null;
      requestCount++;
      const { url } = details;
      if (requestCount <= 20 || isStreamManifestUrl(url)) {
        console.log(`[hls-capture] [webRequest] #${requestCount}: ${url.slice(0, 250)} (type: ${details.resourceType || '?'})`);
      }
      if (isStreamManifestUrl(url)) {
        console.log(`[hls-capture] [webRequest] FOUND stream manifest: ${url}`);
        finalize(url, details.referrer || playerUrl);
      }
      return null;
    });

    /* Strategy C: inject anti-headless overrides + fetch/XHR monkeypatch */
    const injectMonkeypatch = async () => {
      console.log(`[hls-capture] Injecting anti-headless + fetch/XHR monkeypatch for ${hostname}`);
      try {
        await win.webContents.executeJavaScript(`
          (() => {
            if (window.__m3u8Patched) return;
            window.__m3u8Patched = true;
            window.__streamUrl = null;

            /* Override headless/bot detection APIs */
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: false });
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: false });
            if (navigator.webdriver !== undefined) {
              Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: false });
            }
            /* Plugins array for fingerprinting */
            if (navigator.plugins && navigator.plugins.length === 0) {
              var dummyPlugin = { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', length: 1 };
              Object.defineProperty(navigator, 'plugins', { get: function() { return [dummyPlugin]; }, configurable: false });
            }

            console.log('[hls-capture] Anti-headless + monkeypatch installed');

            const manifestRegex = /https?:\\/\\/[^\\s"']+\\.(?:m3u8|mpd)[^\\s"']*/i;

            const _fetch = window.fetch.bind(window);
            window.fetch = async (...args) => {
              const r = await _fetch(...args);
              const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
              if (manifestRegex.test(reqUrl)) { window.__streamUrl = reqUrl; console.log('[hls-capture] Monkeypatch caught fetch URL:', reqUrl); }
              if (r.ok) {
                var ct = r.headers && r.headers.get ? r.headers.get('content-type') || '' : '';
                if (ct.includes('json') || ct.includes('text') || ct.includes('javascript')) {
                  r.clone().text().then(function(txt) {
                    var match = txt.match(manifestRegex);
                    if (match) { window.__streamUrl = match[0]; console.log('[hls-capture] Monkeypatch caught fetch BODY:', match[0]); }
                  }).catch(function(){});
                }
              }
              return r;
            };

            const _open = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              this.__url = (typeof url === 'string' ? url : '') + '';
              return _open.apply(this, arguments);
            };
            const _send = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function(body) {
              const self = this;
              const _onload = self.onload;
              self.addEventListener('load', function() {
                if (self.__url) {
                  if (manifestRegex.test(self.__url)) {
                    window.__streamUrl = self.__url;
                    console.log('[hls-capture] Monkeypatch caught XHR URL:', self.__url);
                  }
                  try {
                    var respText = self.responseText || '';
                    var match = respText.match(manifestRegex);
                    if (match) { window.__streamUrl = match[0]; console.log('[hls-capture] Monkeypatch caught XHR BODY:', match[0]); }
                  } catch(e) {}
                }
                if (_onload) _onload.apply(self, arguments);
              });
              return _send.apply(this, arguments);
            };
          })()
        `);
        console.log(`[hls-capture] Monkeypatch injected OK for ${hostname}`);
      } catch (err) {
        console.log(`[hls-capture] Monkeypatch injection FAILED for ${hostname}:`, err.message);
      }
    };

    /* Strategy D: DOM polling — play buttons, video elements, iframes, plus API response log scanning */
    const pollDom = async () => {
      if (polling || resolved) return;
      polling = true;
      const currentUrl = win.isDestroyed() ? 'N/A' : (win.webContents.getURL() || 'N/A');
      console.log(`[hls-capture] [poll] DOM poll started (iframeDepth=${iframeDepth}, url=${currentUrl}) for ${hostname}`);
      try {
        try {
          const result = await win.webContents.executeJavaScript(`
            (() => {
              try {
                if (window.__streamUrl) { console.log('[hls-capture] [poll] Found __streamUrl:', window.__streamUrl); return { type: 'manifest', url: window.__streamUrl }; }

                const manifestRegex = new RegExp('[.](?:m3u8|mpd)([?#]|$)', 'i');

                const seen = new Set();
                for (const sel of ['video[src]', 'video source[src]', 'source[type*="mpegurl"]', 'source[type*="x-mpeg"]', 'source[type*="dash"]', '[data-src*=".m3u8"]', '[data-src*=".mpd"]', '[data-url*=".m3u8"]', '[data-url*=".mpd"]', '[href*=".m3u8"]', '[href*=".mpd"]']) {
                  const els = document.querySelectorAll(sel);
                  for (const el of els) {
                    const s = el.src || el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-url') || el.getAttribute('href') || '';
                    if (s && !s.startsWith('blob:') && !s.startsWith('data:') && !seen.has(s)) {
                      seen.add(s);
                      if (manifestRegex.test(s)) return { type: 'manifest', url: s };
                    }
                  }
                }

                const vids = document.querySelectorAll('video');
                for (const v of vids) {
                  if (v.src && !v.src.startsWith('blob:') && !v.src.startsWith('data:')) {
                    console.log('[hls-capture] [poll] Found video src:', String(v.src).slice(0, 200));
                    if (manifestRegex.test(v.src)) return { type: 'manifest', url: v.src };
                    return { type: 'direct', url: v.src };
                  }
                }

                return null;
              } catch (e) { console.error('[hls-capture] [poll] DOM scan threw:', e.message, e.stack); return { type: 'error', msg: e.message }; }
            })()
          `);
          if (result && !resolved) {
            console.log(`[hls-capture] [poll] Result type=${result.type} url=${result.url ? result.url.slice(0, 200) : 'N/A'} for ${hostname}`);
            // Some players (VidLink) expose a DASH manifest or a direct
            // progressive video file. The downloader accepts all of these.
            if (result.type === 'm3u8' || result.type === 'manifest' || result.type === 'direct') {
              finalize(result.url, playerUrl);
              return;
            }
          }
        } catch (err) {
          console.log(`[hls-capture] [poll] JS error during DOM scan for ${hostname}:`, err.message);
        }

        if (resolved) return;

        /* Click known play-button selectors (only if autoPlay is enabled) */
        if (autoPlay) {
          try {
            const clicked = await win.webContents.executeJavaScript(`
              (() => {
                try {
                  const clickSelectors = [
                    '.vjs-big-play-button', '.play-button', '.overlay', '.player-overlay',
                    '.start-button', '.play-icon', '.play', 'video', '.mejs-play button',
                    '.plyr__play', '[aria-label="Play"]', '.jw-icon-playback',
                    '.jw-display-icon-container', '.ytp-large-play-button',
                    '.ytp-play-button', '.html5-main-video',
                  ];
                  for (const s of clickSelectors) {
                    const el = document.querySelector(s);
                    if (el && el.offsetParent !== null) { el.click(); return s; }
                  }
                  return null;
                } catch (e) { return 'error:' + e.message; }
              })()
            `);
            if (clicked) {
              console.log(`[hls-capture] [poll] Clicked: ${clicked} for ${hostname}`);
            } else {
              console.log(`[hls-capture] [poll] No play button found for ${hostname}, trying center fallback`);
              const centerClicked = await win.webContents.executeJavaScript(`
                (() => {
                  try {
                    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
                    if (!el) return null;
                    let node = el;
                    while (node) {
                      if (node.tagName === 'A') return 'skip:' + (node.tagName);
                      node = node.parentElement;
                    }
                    const href = el.getAttribute && el.getAttribute('href');
                    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) return 'skip:href';
                    el.click();
                    return 'center-click';
                  } catch (e) { return 'error:' + e.message; }
                })()
              `);
              if (centerClicked) console.log(`[hls-capture] [poll] Center-click result: ${centerClicked} for ${hostname}`);
            }
          } catch (err) {
            console.log(`[hls-capture] [poll] Click error for ${hostname}:`, err.message);
          }
        }

        if (!resolved && iframeDepth < MAX_IFRAME_DEPTH) {
          try {
            const info = await win.webContents.executeJavaScript(`
              (() => {
                try {
                  for (const f of document.querySelectorAll('iframe')) {
                    const s = f.src || f.getAttribute('data-src') || '';
                    if (s && !s.startsWith('about:') && !s.startsWith('javascript:') && s.includes('http')) return s;
                  }
                  return null;
                } catch (e) { return null; }
              })()
            `);
            if (info) {
              console.log(`[hls-capture] [poll] Following iframe depth=${iframeDepth + 1} => ${info} for ${hostname}`);
              iframeDepth++;
              await win.loadURL(info);
            } else {
              console.log(`[hls-capture] [poll] No iframe found for ${hostname} (current URL: ${currentUrl})`);
            }
          } catch (err) {
            console.log(`[hls-capture] [poll] iframe follow error for ${hostname}:`, err.message);
          }
        }
      } finally {
        polling = false;
      }
    };

    win.webContents.on('did-finish-load', async () => {
      const loadedUrl = win.webContents.getURL();
      console.log(`[hls-capture] Page loaded: ${loadedUrl} for ${hostname}`);
      await new Promise((r) => setTimeout(r, 300));
      if (resolved) return;
      await injectMonkeypatch();
      const isCf = await isCloudflareChallenge(win);
      if (isCf) {
        console.log(`[hls-capture] Cloudflare challenge detected for ${hostname}, waiting for bypass...`);
        await waitForCloudflareBypass(win, hostname);
      }
      if (hostname.includes('vidsrc.to') && !vidsrcReloaded) {
        console.log(`[hls-capture] VidSrc first load, waiting 10s then reloading for ${hostname}`);
        vidsrcReloaded = true;
        await new Promise((r) => setTimeout(r, 10000));
        if (resolved) return;
        win.loadURL(playerUrl).catch((err) => console.log(`[hls-capture] VidSrc reload error: ${err.message}`));
        return;
      }
      if (visible && hostname.includes('vidsrc.to')) {
        console.log(`[hls-capture] Injecting user instruction banner for ${hostname}`);
        try {
          await win.webContents.executeJavaScript(`
            (() => {
              const existing = document.getElementById('__nxb_capture_banner');
              if (existing) return;
              const banner = document.createElement('div');
              banner.id = '__nxb_capture_banner';
              banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#1a1a2e;color:#fff;padding:14px 20px;text-align:center;font-family:sans-serif;font-size:15px;border-bottom:3px solid #e94560;box-shadow:0 2px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;gap:10px;';
              banner.innerHTML = '<span style="font-size:20px;">&#9654;</span> Click the play button above to start your download automatically';
              document.body.prepend(banner);
            })()
          `);
        } catch (e) {
          console.log(`[hls-capture] Banner injection failed for ${hostname}:`, e.message);
        }
      }
      if (!pollTimer) {
        pollTimer = setInterval(pollDom, 3000);
        const initialDelay = hostname.includes('vidsrc.to') ? 2000 : 8000;
        setTimeout(() => pollDom(), initialDelay);
      }
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.log(`[hls-capture] Page FAILED to load: ${validatedURL} error: ${errorDescription} for ${hostname}`);
    });

    win.webContents.on('did-navigate', (event, url, httpResponseCode, httpStatusText) => {
      console.log(`[hls-capture] NAVIGATED to: ${url} (code=${httpResponseCode}) for ${hostname}`);
      if (resolved) return;
      if (!url.includes(hostname) || (url !== playerUrl && !url.includes('/video') && !url.includes('/embed') && !url.includes('/tv/') && !url.includes('/movie/'))) {
        console.log(`[hls-capture] NAVIGATED away from video page! Might be a redirect. Current: ${url}`);
      }
    });

    win.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
      if (isMainFrame) {
        console.log(`[hls-capture] In-page navigation: ${url} for ${hostname}`);
      }
    });

    console.log(`[hls-capture] Loading URL: ${playerUrl} for ${hostname}`);
    win.loadURL(playerUrl).catch((err) => {
      console.log(`[hls-capture] loadURL error for ${hostname}:`, err.message);
      if (!resolved) { resolved = true; cleanup(); reject(err); }
    });
  });
}

module.exports = { captureM3u8Url, getCaptureSession };
