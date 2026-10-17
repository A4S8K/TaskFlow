def test_task_permissions_and_cross_project(client, workspace, account):
    _, headers, project = workspace
    member, mh = account("member")
    outsider, oh = account("outsider")
    base = f"/api/v1/projects/{project['id']}"
    client.post(base + "/members", headers=headers, json={"email": member["email"]})
    task = client.post(
        base + "/tasks", headers=headers, json={"title": "Work", "assigned_to_id": member["id"]}
    ).json()["data"]
    url = base + f"/tasks/{task['id']}"
    assert client.patch(url, headers=mh, json={"status": "IN_PROGRESS"}).status_code == 200
    assert client.patch(url, headers=mh, json={"status": "DONE", "title": "hacked"}).status_code == 403
    assert client.delete(url, headers=mh).status_code == 403
    assert client.get(url, headers=oh).status_code == 404
    assert (
        client.post(
            base + "/tasks", headers=headers, json={"title": "Bad", "assigned_to_id": outsider["id"]}
        ).status_code
        == 400
    )
    own = client.post(base + "/tasks", headers=mh, json={"title": "Own"}).json()["data"]
    assert client.patch(base + f"/tasks/{own['id']}", headers=mh, json={"title": "Edited"}).status_code == 200
    assert client.delete(base + f"/tasks/{own['id']}", headers=mh).status_code == 200
    other = client.post("/api/v1/projects", headers=headers, json={"name": "Other"}).json()["data"]
    assert (
        client.get(f"/api/v1/projects/{other['id']}/tasks/{task['id']}", headers=headers).status_code == 404
    )
    assert (
        client.patch(
            f"/api/v1/projects/{other['id']}/tasks/{task['id']}", headers=headers, json={"title": "Wrong"}
        ).status_code
        == 404
    )
    assert client.delete(url, headers=headers).status_code == 200


def test_task_filters_pagination_dashboard(client, workspace, account):
    owner, headers, project = workspace
    base = f"/api/v1/projects/{project['id']}/tasks"
    for i in range(5):
        assert (
            client.post(
                base,
                headers=headers,
                json={
                    "title": f"Task {i}",
                    "status": "DONE" if i < 2 else "TODO",
                    "priority": "HIGH",
                    "assigned_to_id": owner["id"],
                    "due_date": "2030-01-01T09:00:00Z",
                },
            ).status_code
            == 201
        )
    result = client.get(
        base + "?status=DONE&priority=HIGH&page_size=1&page=2&search=Task&sort=title&direction=asc",
        headers=headers,
    ).json()
    assert result["total"] == 2 and result["items"][0]["title"] == "Task 1"
    assert client.get(base + "?due_before=2029-01-01T00:00:00Z", headers=headers).json()["total"] == 0
    assert client.get(base + "?due_after=2029-01-01T00:00:00Z", headers=headers).json()["total"] == 5
    assert client.get(f"{base}?assigned_to_id={owner['id']}", headers=headers).json()["total"] == 5
    assert client.get("/api/v1/users/me/tasks", headers=headers).json()["total"] == 5
    summary = client.get("/api/v1/dashboard/summary", headers=headers).json()
    assert summary["completed_tasks"] == 2 and summary["pending_tasks"] == 3
    _, outsider = account("outsider")
    assert client.get("/api/v1/dashboard/summary", headers=outsider).json()["total_tasks"] == 0
    assert client.get("/api/v1/users/me/tasks", headers=outsider).json()["total"] == 0
    assert client.get(base + "?page_size=1000", headers=headers).status_code == 422
    assert client.get(base + "?due_before=2030-01-01T00:00:00", headers=headers).status_code == 422


def test_task_validation(client, workspace):
    _, headers, project = workspace
    base = f"/api/v1/projects/{project['id']}/tasks"
    for body in (
        {"title": ""},
        {"title": "Valid", "status": "INVALID"},
        {"title": "Valid", "due_date": "2030-01-01T00:00:00"},
    ):
        assert client.post(base, headers=headers, json=body).status_code == 422
    task = client.post(base, headers=headers, json={"title": "Good"}).json()["data"]
    assert client.patch(base + f"/{task['id']}", headers=headers, json={"status": None}).status_code == 422


def test_admin_can_edit_and_delete_tasks(client, workspace, account):
    _, headers, project = workspace
    admin, admin_headers = account("admin")
    base = f"/api/v1/projects/{project['id']}"
    assert (
        client.post(
            base + "/members", headers=headers, json={"email": admin["email"], "role": "ADMIN"}
        ).status_code
        == 201
    )
    task = client.post(base + "/tasks", headers=headers, json={"title": "Review"}).json()["data"]
    url = base + f"/tasks/{task['id']}"
    assert (
        client.patch(url, headers=admin_headers, json={"title": "Ready", "priority": "URGENT"}).status_code
        == 200
    )
    assert client.delete(url, headers=admin_headers).status_code == 200
