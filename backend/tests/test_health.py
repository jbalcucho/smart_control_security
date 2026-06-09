"""Tests del endpoint de health check (Sprint 1.1)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint_returns_200(client: AsyncClient) -> None:
    response = await client.get("/api/system/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_endpoint_returns_expected_fields(client: AsyncClient) -> None:
    response = await client.get("/api/system/health")
    body = response.json()

    assert body["status"] == "ok"
    assert "environment" in body
    assert "version" in body
    assert "timestamp" in body
    assert "uptime_seconds" in body
    assert body["checks"]["process"] == "ok"


@pytest.mark.asyncio
async def test_version_endpoint_returns_app_info(client: AsyncClient) -> None:
    response = await client.get("/api/system/version")
    assert response.status_code == 200

    body = response.json()
    assert body["app_name"] == "Smart Control Security"
    assert "version" in body
    assert body["api_prefix"] == "/api"


@pytest.mark.asyncio
async def test_root_endpoint_redirects_to_docs(client: AsyncClient) -> None:
    response = await client.get("/")
    assert response.status_code == 200

    body = response.json()
    assert body["app"] == "Smart Control Security"
    assert body["docs"] == "/api/docs"


@pytest.mark.asyncio
async def test_request_id_header_is_propagated(client: AsyncClient) -> None:
    custom_id = "test-request-id-12345"
    response = await client.get(
        "/api/system/health", headers={"X-Request-ID": custom_id}
    )
    assert response.headers["X-Request-ID"] == custom_id


@pytest.mark.asyncio
async def test_request_id_generated_when_not_provided(client: AsyncClient) -> None:
    response = await client.get("/api/system/health")
    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) > 0
