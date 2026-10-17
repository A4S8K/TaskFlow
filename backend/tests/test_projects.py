def test_project_lifecycle(client, workspace, account):
    _owner, headers, project = workspace
    base = f"/api/v1/projects/{project['id']}"
    assert project["role"] == "OWNER" and project["member_count"] == 1
    assert client.patch(base, headers=headers, json={"name": "Renamed"}).json()["data"]["name"] == "Renamed"
    assert client.get("/api/v1/projects?search=Renamed", headers=headers).json()["total"] == 1
    _, outsider = account("outsider")
    assert client.get("/api/v1/projects", headers=outsider).json()["total"] == 0
    for method in (client.get, client.patch, client.delete):
        args = {"json": {"name": "stolen"}} if method == client.patch else {}
        assert method(base, headers=outsider, **args).status_code == 404
    assert client.delete(base, headers=headers).status_code == 200
    assert client.get(base, headers=headers).status_code == 404


def test_membership_roles_and_unassignment(client, workspace, account):
    owner, headers, project = workspace
    member, mh = account("member")
    admin, ah = account("admin")
    base = f"/api/v1/projects/{project['id']}"
    for who, role in ((member, "MEMBER"), (admin, "ADMIN")):
        assert (
            client.post(
                base + "/members", headers=headers, json={"email": who["email"], "role": role}
            ).status_code
            == 201
        )
    assert client.post(base + "/members", headers=headers, json={"email": member["email"]}).status_code == 409
    assert client.patch(base, headers=mh, json={"name": "no"}).status_code == 403
    assert client.patch(base, headers=ah, json={"name": "yes"}).status_code == 200
    assert client.delete(base, headers=ah).status_code == 403
    assert (
        client.patch(base + f"/members/{member['id']}", headers=ah, json={"role": "ADMIN"}).status_code == 403
    )
    assert (
        client.patch(base + f"/members/{member['id']}", headers=mh, json={"role": "ADMIN"}).status_code == 403
    )
    assert client.delete(base + f"/members/{owner['id']}", headers=headers).status_code == 403
    assert client.delete(base + f"/members/{owner['id']}", headers=ah).status_code == 403
    assert (
        client.patch(base + f"/members/{member['id']}", headers=headers, json={"role": "ADMIN"}).status_code
        == 200
    )
    assert client.delete(base + f"/members/{member['id']}", headers=ah).status_code == 403
    assert (
        client.patch(base + f"/members/{member['id']}", headers=headers, json={"role": "MEMBER"}).status_code
        == 200
    )
    task = client.post(
        base + "/tasks", headers=headers, json={"title": "Assigned", "assigned_to_id": member["id"]}
    ).json()["data"]
    assert client.delete(base + f"/members/{member['id']}", headers=ah).status_code == 200
    assert client.get(base + f"/tasks/{task['id']}", headers=headers).json()["assigned_to_id"] is None
    assert client.get(base, headers=mh).status_code == 404


def test_delete_cascades(client, workspace):
    _, headers, project = workspace
    base = f"/api/v1/projects/{project['id']}"
    assert client.post(base + "/tasks", headers=headers, json={"title": "Task"}).status_code == 201
    assert client.delete(base, headers=headers).status_code == 200
    summary = client.get("/api/v1/dashboard/summary", headers=headers).json()
    assert summary["total_projects"] == 0 and summary["total_tasks"] == 0


def test_project_pagination_and_nulls(client, workspace):
    _, headers, project = workspace
    assert (
        client.patch(f"/api/v1/projects/{project['id']}", headers=headers, json={"name": None}).status_code
        == 422
    )
    for name in ("Beta", "Gamma"):
        client.post("/api/v1/projects", headers=headers, json={"name": name})
    result = client.get("/api/v1/projects?page=2&page_size=1&sort=name&direction=asc", headers=headers).json()
    assert result["total"] == 3 and len(result["items"]) == 1
