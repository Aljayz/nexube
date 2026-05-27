#!/usr/bin/env python3
import os
import platform
import shutil
import sys

from PyInstaller.__main__ import run as run_pyinstaller

OS_NAME = sys.platform
MACHINE = platform.machine().lower()

RESOURCES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'desktop', 'resources', 'desk-vid-dl',
)


def main():
    opts = parse_options()

    onedir = '--onedir' in opts or '-D' in opts
    if not onedir and '-F' not in opts and '--onefile' not in opts:
        opts.append('--onedir')

    name = 'desk-vid-dl'
    print(f'Building {name} for {OS_NAME} {MACHINE}')

    plat_dir = {
        'win32': 'windows',
        'darwin': 'darwin',
    }.get(OS_NAME, OS_NAME)

    dest = os.path.join(RESOURCES_DIR, plat_dir, name)
    if os.path.exists(dest):
        shutil.rmtree(dest)

    pyinstaller_opts = [
        f'--name={name}',
        '--noconfirm',
        '--clean',
        *opts,
        os.path.join(os.path.dirname(os.path.abspath(__file__)), 'desk_vid_dl', '__main__.py'),
    ]

    print(f'Running PyInstaller with {pyinstaller_opts}')
    run_pyinstaller(pyinstaller_opts)

    dist_dir = os.path.join(os.getcwd(), 'dist', name)
    if os.path.exists(dist_dir):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copytree(dist_dir, dest, dirs_exist_ok=True)
        print(f'Copied binary to {dest}')
    else:
        print(f'Expected dist at {dist_dir} not found')
        return 1

    return 0


def parse_options():
    return sys.argv[1:]


if __name__ == '__main__':
    sys.exit(main())
