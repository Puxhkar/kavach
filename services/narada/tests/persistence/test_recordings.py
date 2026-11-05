import pytest

from app.persistence.recordings import LocalRecordingStore


def test_save_then_find(tmp_path):
    store = LocalRecordingStore(tmp_path)
    assert store.path("54b61663994926b449ebec6a", "abc123") is None
    store.save("54b61663994926b449ebec6a", "abc123", b"RIFF....")
    path = store.path("54b61663994926b449ebec6a", "abc123")
    assert path is not None and path.read_bytes() == b"RIFF...."
    assert not list(tmp_path.rglob("*.tmp"))


@pytest.mark.parametrize("run_id", ["../etc", "ABC", "", "a/b"])
def test_ids_that_could_escape_the_folder_are_refused(tmp_path, run_id):
    store = LocalRecordingStore(tmp_path)
    with pytest.raises(ValueError):
        store.path(run_id, "abc123")
    with pytest.raises(ValueError):
        store.save("54b61663994926b449ebec6a", run_id, b"x")
