import secrets

import start
from app.core.config import Settings


def test_launcher_uses_explicit_proxy_and_single_worker(monkeypatch):
    settings = Settings(_env_file=None, jwt_secret_key=secrets.token_urlsafe(48))
    observed = {}
    monkeypatch.setattr(start, "get_settings", lambda: settings)
    monkeypatch.setenv("PORT", "18001")
    monkeypatch.setattr(start.uvicorn, "run", lambda *args, **kwargs: observed.update(kwargs))
    assert start.main() == 0
    assert observed["port"] == 18001
    assert observed["workers"] == 1
    assert observed["forwarded_allow_ips"] == settings.trusted_proxy_ips
    assert observed["access_log"] is False


def test_launcher_configuration_error_is_clear_and_redacted(monkeypatch, capsys):
    for name, field in Settings.model_fields.items():
        monkeypatch.delenv(name.upper(), raising=False)
        for alias in getattr(field.validation_alias, "choices", []):
            monkeypatch.delenv(alias, raising=False)
    secret = secrets.token_urlsafe(48)

    def invalid_settings():
        return Settings(_env_file=None, jwt_secret_key=secret, app_env="production")

    monkeypatch.setattr(start, "get_settings", invalid_settings)
    assert start.main() == 1
    error = capsys.readouterr().err
    assert "Production requires explicit settings" in error
    assert "database_url" in error
    assert secret not in error


def test_launcher_port_error_does_not_echo_input(monkeypatch, capsys):
    settings = Settings(_env_file=None, jwt_secret_key=secrets.token_urlsafe(48))
    monkeypatch.setattr(start, "get_settings", lambda: settings)
    monkeypatch.setenv("PORT", "do-not-echo-input")
    assert start.main() == 1
    error = capsys.readouterr().err
    assert "PORT" in error
    assert "do-not-echo-input" not in error
