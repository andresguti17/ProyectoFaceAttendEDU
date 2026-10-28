"""Minimal stand-in for setuptools' `pkg_resources`.

`face_recognition_models` only calls `resource_filename` to locate its model
files. setuptools stopped shipping `pkg_resources` in v81, and every older
release carries known vulnerabilities, so instead of pinning one this module
answers that single call with importlib.resources.
"""
from importlib.resources import files


def resource_filename(package: str, resource: str) -> str:
    return str(files(package).joinpath(resource))
