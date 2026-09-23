"""Isolate every pytest invocation from local credentials and persisted data."""

import os
import tempfile
from pathlib import Path

import pytest

_test_data = tempfile.TemporaryDirectory(prefix="meysqosai-tests-")
os.environ["DATA_PATH"] = str(Path(_test_data.name) / "test.db")
os.environ["SIMULATOR_DATA_PATH"] = str(
    Path(__file__).resolve().parents[2] / "data" / "simulator.json"
)
os.environ["AI_PROVIDER"] = "mock"
os.environ["AI_API_KEY"] = ""
os.environ["AI_BASE_URL"] = ""


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    yield
    _test_data.cleanup()
