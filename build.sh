#!/usr/bin/env bash
# Install setuptools first (provides pkg_resources for APScheduler on Python 3.12+)
# then install the rest. Use this as Render Build Command: bash build.sh
set -e
pip install "setuptools>=65.0.0"
if [ -f server/requirements.txt ]; then
  pip install -r server/requirements.txt
else
  pip install -r requirements.txt
fi
