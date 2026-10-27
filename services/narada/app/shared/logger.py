"""Logging bootstrap shared across the narada service."""

import logging
import os
import sys

_LOG_NAME = "narada"
_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

_root = logging.getLogger(_LOG_NAME)
if not _root.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter(_FORMAT))
    _root.addHandler(_handler)
    _root.setLevel(_LEVEL)
    _root.propagate = False


def get_logger(name: str | None = None) -> logging.Logger:
    return _root if not name else _root.getChild(name)
