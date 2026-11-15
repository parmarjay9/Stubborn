"""Scheduled every night: seal every log's latest fingerprint into locked storage."""
from common import seal


def handler(event, context=None):
    return seal.seal_devices(None)
