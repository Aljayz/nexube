const { BrowserWindow, session } = require('electron');
const path = require('path');

const BLOCKED_HOSTS = [
  '*://www.google-analytics.com/*',
  '*://analytics.google.com/*',
  '*://googletagmanager.com/*',
  '*://www.googletagmanager.com/*',
  '*://googletagservices.com/*',
  '*://doubleclick.net/*',
  '*://*.doubleclick.net/*',
  '*://adservice.google.com/*',
  '*://adservice.google.de/*',
  '*://pagead2.googlesyndication.com/*',
  '*://stats.g.doubleclick.net/*',
  '*://cdn.adx1.com/*',
  '*://intelligenceadx.com/*',
  '*://adsco.re/*',
  '*://mc.yandex.com/*',
  '*://mc.yandex.ru/*',
  '*://bvtpk.com/*',
  '*://my.rtmark.net/*',
  '*://b7510.com/*',
  '*://gt.unbrownunflat.com/*',
  '*://im.malocacomals.com/*',
  '*://users.videasy.net/*',
  '*://nf.sixmossin.com/*',
  '*://realizationnewestfangs.com/*',
  '*://acscdn.com/*',
  '*://lt.taloseempest.com/*',
  '*://pl26708123.profitableratecpm.com/*',
  '*://preferencenail.com/*',
  '*://protrafficinspector.com/*',
  '*://s10.histats.com/*',
  '*://weirdopt.com/*',
  '*://static.cloudflareinsights.com/*',
  '*://kettledroopingcontinuation.com/*',
  '*://wayfarerorthodox.com/*',
  '*://woxaglasuy.net/*',
  '*://adeptspiritual.com/*',
  '*://www.calculating-laugh.com/*',
  '*://amavhxdlofklxjg.xyz/*',
  '*://7jtjubf8p5kq7x3z2.u3qleufcm6vure326ktfpbj.cfd/*',
  '*://5mq.get64t9vqg8pnbex1y463o.rest/*',
  '*://usrpubtrk.com/*',
  '*://adexchangeclear.com/*',
  '*://rzjzjnavztycv.online/*',
  '*://tmstr4.cloudnestra.com/*',
  '*://tmstr4.neonhorizonworkshops.com/*',
];

const MEDIA_URLS = ['*://*/*.m3u8*', '*://*/*.m3u8', '*://*/*.vtt*', '*://*/*.vtt'];

function createCaptureSession() {
  const captureSession = session.fromPartition('persist:download-capture');

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  captureSession.setUserAgent(UA);

  const stripHeaders = (details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['content-security-policy'];
    delete headers['x-frame-options'];
    callback({ responseHeaders: headers });
  };

  captureSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, stripHeaders);
  captureSession.webRequest.onBeforeRequest({ urls: BLOCKED_HOSTS }, (_, cb) => cb({ cancel: true }));

  return captureSession;
}

let captureSession = null;

function getCaptureSession() {
  if (!captureSession) {
    captureSession = createCaptureSession();
  }
  return captureSession;
}

function captureM3u8Url(playerUrl, timeoutMs = 35000) {
  return new Promise((resolve, reject) => {
    const captureSession = getCaptureSession();
    let resolved = false;
    let capturedUrl = null;
    let capturedReferer = null;

    const cleanup = () => {
      if (win && !win.isDestroyed()) {
        win.close();
      }
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (requestHandler) {
        captureSession.webRequest.onBeforeRequest(null);
      }
    };

    const timeoutTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('M3U8 capture timed out'));
      }
    }, timeoutMs);

    const requestHandler = captureSession.webRequest.onBeforeRequest(
      { urls: [...BLOCKED_HOSTS, ...MEDIA_URLS] },
      (details, callback) => {
        const { url } = details;
        const isMedia = url.includes('.m3u8') || url.includes('.vtt');
        if (!isMedia) {
          callback({ cancel: true });
          return;
        }
        try {
          const host = new URL(url).hostname;
          const blocked = BLOCKED_HOSTS.some((pat) => {
            const hostPat = pat.replace(/^\*:\/\//, '').split('/')[0];
            return hostPat.startsWith('*.')
              ? host.endsWith(hostPat.slice(1))
              : host === hostPat || host === hostPat.replace(/^\*\./, '');
          });
          if (blocked) {
            callback({ cancel: true });
            return;
          }
        } catch {}

        if (url.includes('.m3u8') && !resolved) {
          capturedUrl = url;
          capturedReferer = details.referrer || playerUrl;
          resolved = true;
          callback({ cancel: false });

          setTimeout(async () => {
            try {
              const cookies = await captureSession.cookies.get({ url: capturedUrl });
              cleanup();
              resolve({
                m3u8Url: capturedUrl,
                referer: capturedReferer,
                cookies: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
              });
            } catch (err) {
              cleanup();
              resolve({
                m3u8Url: capturedUrl,
                referer: capturedReferer,
                cookies: '',
              });
            }
          }, 500);
        } else {
          callback({});
        }
      }
    );

    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        partition: 'persist:download-capture',
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: false,
      },
    });

    win.webContents.setAudioMuted(true);

    win.webContents.on('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 2000));

      if (resolved) return;

      try {
        await win.webContents.executeJavaScript(`
          (async () => {
            const clickTargets = [
              '.vjs-big-play-button',
              '.play-button',
              '.overlay',
              '.player-overlay',
              '.start-button',
              '.play-icon',
              '.play',
              'video',
            ];
            for (const sel of clickTargets) {
              const el = document.querySelector(sel);
              if (el && el.offsetParent !== null) {
                el.click();
                return true;
              }
            }
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            const el = document.elementFromPoint(cx, cy);
            if (el) el.click();
            return false;
          })()
        `);
      } catch {}
    });

    win.loadURL(playerUrl).catch((err) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(err);
      }
    });
  });
}

module.exports = { captureM3u8Url, getCaptureSession };
