import pytest


@pytest.mark.parametrize(
    "language,phrase", [("en", "Project created"), ("ru", "Проект успешно"), ("kk", "Жоба сәтті")]
)
def test_localized_creation(client, account, language, phrase):
    _, headers = account()
    result = client.post(
        "/api/v1/projects",
        headers={**headers, "Accept-Language": language},
        json={"name": "Original content"},
    )
    assert phrase in result.json()["message"]
    assert result.json()["data"]["name"] == "Original content"


def test_language_resolution(client, account):
    _, headers = account(lang="kk")
    for suffix, extra, expected in [
        ("", {}, "Жоба"),
        ("", {"Accept-Language": "en;q=0.1,ru-RU;q=0.9,kk;q=0"}, "Проект"),
        ("?lang=en", {"Accept-Language": "ru"}, "Project"),
        ("?lang=fr", {}, "Project"),
    ]:
        result = client.post("/api/v1/projects" + suffix, headers={**headers, **extra}, json={"name": "Test"})
        assert result.json()["message"].startswith(expected)
    assert (
        client.patch(
            "/api/v1/users/me/preferences", headers=headers, json={"preferred_language": "ru"}
        ).status_code
        == 200
    )
    assert client.get("/api/v1/users/me", headers=headers).json()["preferred_language"] == "ru"


@pytest.mark.parametrize("language", ["en", "ru", "kk"])
def test_openapi_and_errors(client, language):
    assert client.get(f"/docs/{language}").status_code == 200
    schema = client.get(f"/openapi/{language}.json").json()
    assert schema["paths"]["/api/v1/projects"]["get"]["description"]
    response = client.get(f"/api/v1/users/me?lang={language}")
    assert response.status_code == 401 and response.json()["code"] == "UNAUTHORIZED"
