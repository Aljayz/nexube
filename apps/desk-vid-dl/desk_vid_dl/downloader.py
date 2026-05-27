import os
import time
import threading
from pathlib import Path

import yt_dlp
from yt_dlp.utils import DownloadCancelled

from . import protocol


class DeskDownloader:

    def __init__(self, url, output_path, format_spec=None, extra_params=None):
        self.url = url
        self.output_path = output_path
        self.format_spec = format_spec or 'bestvideo*+bestaudio/best'
        self.extra_params = extra_params or {}
        self._paused = threading.Event()
        self._stopped = threading.Event()
        self._thread = None
        self._result = None
        self._info = {}
        self._start_time = 0
        self._last_bytes = 0
        self._last_time = 0

    def _progress_hook(self, d):
        if self._stopped.is_set():
            raise DownloadCancelled('Download stopped by user')

        while self._paused.is_set():
            if self._stopped.is_set():
                raise DownloadCancelled('Download stopped while paused')
            time.sleep(0.2)

        status = d.get('status')
        if status == 'downloading':
            now = time.time()
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes', 0)
            speed = d.get('speed', 0)
            eta = d.get('eta', 0)
            pct = (downloaded / total * 100) if total > 0 else 0
            protocol.send_progress(pct, downloaded, total, speed, eta)

        elif status == 'finished':
            protocol.send_progress(
                100, d.get('total_bytes', 0), d.get('total_bytes', 0),
                d.get('speed', 0), d.get('eta', 0), status='finished',
            )

    def _download_thread(self):
        try:
            output_dir = os.path.dirname(self.output_path)
            os.makedirs(output_dir, exist_ok=True)

            outtmpl = self.output_path
            if not outtmpl.endswith('.%(ext)s'):
                outtmpl += '.%(ext)s'

            params = {
                'format': self.format_spec,
                'outtmpl': outtmpl,
                'continuedl': True,
                'overwrites': False,
                'noprogress': True,
                'quiet': True,
                'no_warnings': True,
                'progress_hooks': [self._progress_hook],
                'concurrent_fragment_downloads': 3,
                'fragment_retries': 10,
                'retries': 10,
                'ignoreerrors': False,
                **self.extra_params,
            }

            with yt_dlp.YoutubeDL(params) as ydl:
                self._start_time = time.time()
                info = ydl.extract_info(self.url, download=True)
                self._info = info

                ext = info.get('ext', 'mp4')
                final_path = Path(self.output_path + f'.{ext}')
                if not final_path.exists():
                    alt = Path(self.output_path)
                    if alt.exists():
                        final_path = alt
                    else:
                        for p in Path(output_dir).iterdir():
                            if p.is_file() and p.name.startswith(os.path.basename(self.output_path).rstrip('.%(ext)s')):
                                final_path = p
                                break

                elapsed = time.time() - self._start_time
                protocol.send_done(
                    str(final_path),
                    final_path.stat().st_size if final_path.exists() else 0,
                    elapsed,
                )
                self._result = {'ok': True, 'filepath': str(final_path)}

        except DownloadCancelled:
            elapsed = time.time() - self._start_time
            protocol.send_state(paused=False)
            protocol.send({'type': 'stopped', 'elapsed': round(elapsed, 1)})
            self._result = {'ok': False, 'reason': 'stopped'}

        except Exception as e:
            protocol.send_error(str(e))
            self._result = {'ok': False, 'reason': str(e)}

    def start(self):
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._download_thread, daemon=True)
        self._thread.start()

    def pause(self):
        self._paused.set()
        protocol.send_state(paused=True)

    def resume(self):
        self._paused.clear()
        protocol.send_state(paused=False)

    def stop(self):
        self._stopped.set()
        self._paused.clear()

    def wait(self, timeout=None):
        if self._thread:
            self._thread.join(timeout=timeout)
        return self._result

    @property
    def is_paused(self):
        return self._paused.is_set()

    @property
    def is_stopped(self):
        return self._stopped.is_set()

    @property
    def is_alive(self):
        return self._thread is not None and self._thread.is_alive()
