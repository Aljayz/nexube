import json
import sys


def send(obj):
    line = json.dumps(obj, ensure_ascii=False, default=str)
    sys.stdout.write(line + '\n')
    sys.stdout.flush()


def send_progress(pct, downloaded_bytes, total_bytes, speed, eta, status='downloading'):
    send({
        'type': 'progress',
        'pct': round(pct, 1),
        'downloaded_bytes': downloaded_bytes,
        'total_bytes': total_bytes,
        'speed': speed,
        'eta': eta,
        'status': status,
    })


def send_state(paused):
    send({'type': 'state', 'paused': paused})


def send_error(message):
    send({'type': 'error', 'message': message})


def send_done(filepath, total_bytes, elapsed):
    send({
        'type': 'done',
        'filepath': filepath,
        'total_bytes': total_bytes,
        'elapsed': round(elapsed, 1),
    })


def send_metadata(title, format_name, duration):
    send({
        'type': 'metadata',
        'title': title,
        'format': format_name,
        'duration': duration,
    })


def read_command(timeout=None):
    line = sys.stdin.readline()
    if not line:
        return None
    return json.loads(line.strip())
