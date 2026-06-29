def test_app_imports_cleanly() -> None:
    from app.main import app

    assert app.title == "CampusConnect API"
