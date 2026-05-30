import argparse
import os
import sys
import signal
import atexit
import tempfile

from . import protocol
from .downloader import DeskDownloader


_running_downloader = None
_temp_files = []
atexit.register(lambda: _cleanup_temp_files())


def _signal_handler(signum, frame):
    global _running_downloader
    if _running_downloader is not None:
        _running_downloader.stop()


def _setup_signal_handling():
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)


def _cleanup_temp_files():
    for f in _temp_files:
        try:
            f.close()
            if os.path.exists(f.name):
                os.unlink(f.name)
        except:
            pass


def _write_cookie_file(cookie_string):
    f = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
    f.write("# Netscape HTTP Cookie File\n")
    for pair in cookie_string.split(';'):
        pair = pair.strip()
        if '=' in pair:
            name, value = pair.split('=', 1)
            f.write(f".domain\tTRUE\t/\tFALSE\t0\t{name}\t{value}\n")
    f.flush()
    _temp_files.append(f)
    return f.name


def main():
    _setup_signal_handling()

    parser = argparse.ArgumentParser(description='desk-vid-dl - HLS video downloader')
    parser.add_argument('url', help='m3u8 URL to download')
    parser.add_argument('-o', '--output', required=True, help='Output file path (without extension)')
    parser.add_argument('-f', '--format', default='bestvideo*+bestaudio/best',
                        help='yt-dlp format selector (default: bestvideo*+bestaudio/best)')
    parser.add_argument('--cookies', help='Cookies file (Netscape format)')
    parser.add_argument('--referer', help='HTTP Referer header')
    parser.add_argument('--cookie-string', help='Raw cookie string (name=value; ...)')

    args = parser.parse_args()

    extra_params = {}
    if args.referer:
        extra_params['http_headers'] = {'Referer': args.referer}
    if args.cookies:
        extra_params['cookiefile'] = args.cookies
    if args.cookie_string:
        extra_params['cookiefile'] = _write_cookie_file(args.cookie_string)

    global _running_downloader
    _running_downloader = DeskDownloader(
        url=args.url,
        output_path=args.output,
        format_spec=args.format,
        extra_params=extra_params,
    )

    _running_downloader.start()

    while _running_downloader.is_alive and not _running_downloader.is_stopped:
        try:
            cmd = protocol.read_command()
            if cmd is None:
                break
            action = cmd.get('cmd')
            if action == 'pause':
                _running_downloader.pause()
            elif action == 'resume':
                _running_downloader.resume()
            elif action == 'stop':
                _running_downloader.stop()
                break
        except Exception as e:
            protocol.send_error(f'Invalid command: {e}')
            break

    result = _running_downloader.wait(timeout=10)
    _running_downloader = None

    _cleanup_temp_files()

    if result and result.get('ok'):
        return 0
    return 1


if __name__ == '__main__':
    sys.exit(main())
