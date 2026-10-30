import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{_tmp}/test.db",
        "SECRET_KEY": "test-secret-key-test-secret-key-0123456789",
        "ADMIN_USERNAME": "admin",
        "ADMIN_PASSWORD": "adminpass123",
        "SEED_DEMO_DATA": "false",
    }
)

import io  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def admin(client):
    r = client.post("/api/auth/login", data={"username": "admin", "password": "adminpass123"})
    assert r.status_code == 200
    return _auth(r.json()["access_token"])


@pytest.fixture(scope="module")
def worker(client, admin):
    r = client.post(
        "/api/users",
        json={"username": "Worker1", "password": "workerpass1", "role": "worker", "full_name": "W"},
        headers=admin,
    )
    assert r.status_code == 201
    assert r.json()["username"] == "worker1"  # normalised to lowercase
    r = client.post("/api/auth/login", data={"username": "worker1", "password": "workerpass1"})
    assert r.status_code == 200
    return _auth(r.json()["access_token"])


@pytest.fixture(scope="module")
def catalog(client, worker):
    def make(body):
        r = client.post("/api/parts", json=body, headers=worker)
        assert r.status_code == 201, r.text
        return r.json()

    a = make({"part_number": "demo-a1", "name": "Alternator", "category": "Electrical", "quantity": 0, "price": 100})
    b = make({"part_number": "DEMO-B1", "name": "Alternator alt", "category": "Electrical", "quantity": 3})
    c = make({"part_number": "DEMO-C1", "name": "Radiator", "category": "Cooling", "quantity": 1})

    r = client.post(
        f"/api/parts/{a['id']}/fitments",
        json={"make": "Maruti Suzuki", "model": "Swift", "year_from": 2011, "year_to": 2017},
        headers=worker,
    )
    assert r.status_code == 201
    r = client.post(
        f"/api/parts/{c['id']}/fitments",
        json={"make": "Hyundai", "model": "i20", "year_from": 2015, "year_to": 2020, "variant": "1.2"},
        headers=worker,
    )
    assert r.status_code == 201
    r = client.post(f"/api/parts/{a['id']}/interchanges", json={"part_number": "demob1"}, headers=worker)
    assert r.status_code == 201
    return {"a": a, "b": b, "c": c}


# ------------------------------------------------------------------ auth


def test_login_and_me(client, admin):
    assert client.post("/api/auth/login", data={"username": "admin", "password": "wrong"}).status_code == 401
    r = client.get("/api/auth/me", headers=admin)
    assert r.status_code == 200 and r.json()["role"] == "admin"


def test_refresh_token(client):
    tokens = client.post("/api/auth/login", data={"username": "admin", "password": "adminpass123"}).json()
    r = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    # an access token must not work as a refresh token, nor the reverse
    assert client.post("/api/auth/refresh", json={"refresh_token": tokens["access_token"]}).status_code == 401
    assert client.get("/api/auth/me", headers=_auth(tokens["refresh_token"])).status_code == 401


def test_roles(client, admin, worker, catalog):
    assert client.get("/api/parts").status_code == 401
    assert client.get("/api/users", headers=worker).status_code == 403
    assert client.get("/api/users", headers=admin).status_code == 200
    assert client.delete(f"/api/parts/{catalog['c']['id']}", headers=worker).status_code == 403
    assert client.post("/api/parts/import", files={"file": ("x.csv", b"part_number\nA")}, headers=worker).status_code == 403


def test_admin_cannot_demote_self(client, admin):
    me = client.get("/api/auth/me", headers=admin).json()
    assert client.patch(f"/api/users/{me['id']}", json={"role": "worker"}, headers=admin).status_code == 400
    assert client.patch(f"/api/users/{me['id']}", json={"is_active": False}, headers=admin).status_code == 400


def test_deactivated_user_is_locked_out(client, admin):
    r = client.post("/api/users", json={"username": "temp", "password": "temppass12"}, headers=admin)
    uid = r.json()["id"]
    token = client.post("/api/auth/login", data={"username": "temp", "password": "temppass12"}).json()["access_token"]
    assert client.get("/api/auth/me", headers=_auth(token)).status_code == 200
    client.patch(f"/api/users/{uid}", json={"is_active": False}, headers=admin)
    assert client.get("/api/auth/me", headers=_auth(token)).status_code == 401


# ------------------------------------------------------------------ parts


def test_duplicate_part_number_ignores_formatting(client, worker, catalog):
    r = client.post("/api/parts", json={"part_number": "DEMO A1", "name": "dup"}, headers=worker)
    assert r.status_code == 409


def test_part_search_and_update(client, worker, catalog):
    r = client.get("/api/parts", params={"q": "demob"}, headers=worker)
    assert r.json()["total"] == 1
    pid = catalog["b"]["id"]
    r = client.patch(f"/api/parts/{pid}", json={"quantity": 5, "price": None}, headers=worker)
    assert r.status_code == 200 and r.json()["quantity"] == 5 and r.json()["price"] is None
    assert r.json()["interchanges"][0]["part_number"] == "DEMO-A1"  # link is visible from both sides


def test_admin_can_delete_part(client, admin, worker):
    r = client.post("/api/parts", json={"part_number": "TEMP-1", "name": "Temp"}, headers=worker)
    pid = r.json()["id"]
    assert client.delete(f"/api/parts/{pid}", headers=admin).status_code == 204
    assert client.get(f"/api/parts/{pid}", headers=admin).status_code == 404


# ------------------------------------------------------------------ compatibility


def _check(client, headers, **params):
    r = client.get("/api/compat/check", params=params, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_check_direct_fit_and_stock_alternatives(client, worker, catalog):
    res = _check(client, worker, part_number="DEMO-A1", make="maruti suzuki", model="SWIFT", year=2015)
    assert res["compatible"] is True and res["matched_via"] == "direct"
    # A is out of stock, but its interchange B is in stock and fits too
    assert [(o["part"]["part_number"], o["via"]) for o in res["in_stock_options"]] == [("DEMO-B1", "interchange")]


def test_check_outside_year_range(client, worker, catalog):
    res = _check(client, worker, part_number="DEMO-A1", make="Maruti Suzuki", model="Swift", year=2020)
    assert res["part_found"] is True and res["compatible"] is False and res["in_stock_options"] == []


def test_check_via_interchange_and_formatting(client, worker, catalog):
    res = _check(client, worker, part_number="demo b1", make="Maruti Suzuki", model="Swift", year=2012)
    assert res["compatible"] is True and res["matched_via"] == "interchange"


def test_check_unknown_part(client, worker, catalog):
    res = _check(client, worker, part_number="NOPE-1", make="Maruti Suzuki", model="Swift", year=2012)
    assert res["part_found"] is False and res["compatible"] is None


def test_check_variant_handling(client, worker, catalog):
    kw = dict(part_number="DEMO-C1", make="Hyundai", model="i20", year=2016)
    assert _check(client, worker, **kw)["compatible"] is True  # no variant given
    assert _check(client, worker, variant="1.2", **kw)["compatible"] is True
    assert _check(client, worker, variant="1.4", **kw)["compatible"] is False


def test_search_by_vehicle(client, worker, catalog):
    r = client.get("/api/compat/search", params={"make": "Maruti Suzuki", "model": "Swift", "year": 2015}, headers=worker)
    assert [(m["part"]["part_number"], m["via"]) for m in r.json()] == [("DEMO-B1", "interchange")]
    r = client.get(
        "/api/compat/search",
        params={"make": "Maruti Suzuki", "model": "Swift", "year": 2015, "in_stock_only": False},
        headers=worker,
    )
    assert [(m["part"]["part_number"], m["via"]) for m in r.json()] == [("DEMO-A1", "direct"), ("DEMO-B1", "interchange")]


def test_vehicle_lookups(client, worker, catalog):
    assert "Hyundai" in client.get("/api/vehicles/makes", headers=worker).json()
    assert client.get("/api/vehicles/models", params={"make": "hyundai"}, headers=worker).json() == ["i20"]
    assert client.get("/api/vehicles/variants", params={"make": "Hyundai", "model": "i20"}, headers=worker).json() == ["1.2"]


# ------------------------------------------------------------------ CSV import + dashboard


def test_csv_import(client, admin, catalog):
    csv_body = (
        "part_number,name,category,condition,quantity,price,make,model,year_from,year_to,variant\n"
        "CSV-1,Wiper motor,Electrical,good,4,900,Tata,Nexon,2017,2022,\n"
        "csv-1,,,,,,Tata,Nexon,2023,2024,\n"  # same part, second fitment
        "CSV-2,Mirror,Body,shiny,1,,,,,,\n"  # bad condition
        "CSV-3,Bumper,Body,fair,1,,Tata,,2017,2022,\n"  # incomplete fitment
        "DEMO-C1,,,,7,,,,,,\n"  # update existing quantity
    )
    r = client.post("/api/parts/import", files={"file": ("p.csv", io.BytesIO(csv_body.encode()))}, headers=admin)
    assert r.status_code == 200, r.text
    res = r.json()
    assert (res["parts_created"], res["parts_updated"], res["fitments_added"]) == (1, 1, 2)
    assert sorted(e["row"] for e in res["errors"]) == [4, 5]
    assert client.get("/api/parts", params={"q": "csv-1"}, headers=admin).json()["total"] == 1


def test_csv_missing_column(client, admin):
    r = client.post("/api/parts/import", files={"file": ("p.csv", b"name\nfoo")}, headers=admin)
    assert r.status_code == 400


def test_dashboard(client, worker, catalog):
    d = client.get("/api/dashboard", headers=worker).json()
    assert d["total_parts"] >= 3 and d["vehicles_covered"] >= 2
    assert d["out_of_stock"] >= 1  # DEMO-A1
    assert d["parts_without_fitment"] >= 1  # DEMO-B1 has only an interchange link
    assert d["by_category"] and d["top_makes"] and d["recent_parts"]
