# MARSAD · written with the help of an SI (Super Intelligence) coding assistant; reviewed and tested by team ORYX GEO.
"""Open a NISAR GCOV HDF5 file over HTTPS and read only the window we need.

Authentication: set the environment variable EARTHDATA_TOKEN to a NASA Earthdata
Login token. The token is never written to disk by this code.
"""
import os

import fsspec
import h5py
import requests


def _headers():
    token = os.environ.get("EARTHDATA_TOKEN")
    return {"Authorization": f"Bearer {token}"} if token else {}


def signed_url(url):
    """ASF answers with a redirect to a short-lived signed URL."""
    r = requests.get(url, headers=_headers(), allow_redirects=False, timeout=60)
    if r.status_code not in (302, 303, 307):
        raise RuntimeError(f"Earthdata refused the request (HTTP {r.status_code})")
    return r.headers["Location"]


def open_h5(url, block_size=4 * 1024 * 1024):
    fs = fsspec.filesystem("http", client_kwargs={"trust_env": True})
    f = fs.open(signed_url(url), block_size=block_size, cache_type="blockcache")
    return h5py.File(f, "r")
