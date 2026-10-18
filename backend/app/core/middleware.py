import ipaddress
import logging
import math
import time
from collections import OrderedDict
from threading import Lock

from fastapi import Request
from starlette.datastructures import MutableHeaders
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import Settings
from app.i18n.translator import response

logger = logging.getLogger("taskflow")


class RenderFreeIngressMiddleware:
    """Adapt Render Free public ingress without trusting caller-supplied XFF.

    Render documents edge HTTPS termination, no private inbound traffic on Free,
    and Cloudflare overwriting CF-Connecting-IP on public web-service requests:
    https://render.com/docs/web-services
    https://render.com/docs/free
    https://render.com/articles/host-pocketbase-on-render
    This contract must be re-reviewed before changing the service's compute plan.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = scope.get("headers", [])
        client_values = [value for name, value in headers if name.lower() == b"cf-connecting-ip"]
        proto_values = [value for name, value in headers if name.lower() == b"x-forwarded-proto"]
        probe = scope["method"] == "GET" and scope.get("path") in {"/health", "/ready", "/api/v1/health"}
        # Internal GET probes may bypass Cloudflare. They remain HTTP, execute the
        # real health/database check and still pass TrustedHostMiddleware. Never
        # permit this exception for authentication, API data or documentation.
        if probe and not client_values and (not proto_values or proto_values in ([b"http"], [b"https"])):
            await self.app(scope, receive, send)
            return
        try:
            if len(client_values) != 1 or proto_values != [b"https"]:
                raise ValueError()
            value = client_values[0].decode("ascii")
            if len(value) > 45 or value != value.strip() or "%" in value:
                raise ValueError()
            address = ipaddress.ip_address(value)
            if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
                address = address.ipv4_mapped
            if not address.is_global or address.is_multicast or address.is_reserved:
                raise ValueError()
        except (ValueError, UnicodeError):
            result = JSONResponse(
                response(Request(scope), "INVALID_INGRESS"),
                status_code=400,
                headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
            )
            await result(scope, receive, send)
            return
        # XFP is a consistency check, not the source of HTTPS trust: Render's
        # public edge redirects HTTP before forwarding. Discard ambiguous generic
        # forwarding headers so only this adapter can establish scheme/client.
        adapted = {
            **scope,
            "scheme": "https",
            "client": (str(address), 0),
            "headers": [
                (name, value)
                for name, value in headers
                if name.lower() not in {b"forwarded", b"cf-connecting-ip", b"x-real-ip"}
                and not name.lower().startswith(b"x-forwarded-")
            ],
        }
        await self.app(adapted, receive, send)


class HealthAwareHTTPSRedirectMiddleware(HTTPSRedirectMiddleware):
    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        # Render's internal HTTP probes accept redirects as success. Always run
        # the actual probe; platform edge TLS still protects public requests.
        if (
            scope["type"] == "http"
            and scope["method"] == "GET"
            and scope.get("path") in {"/health", "/ready", "/api/v1/health"}
        ):
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)


class AuthRateLimiter:
    """Bounded fixed-window limiter. One process/instance only; never trust raw forwarding headers."""

    def __init__(self, settings: Settings, clock=time.monotonic):
        self.window = settings.auth_rate_window_seconds
        self.max_keys = settings.auth_rate_max_keys
        self.max_concurrent = settings.auth_max_concurrent
        self.active = 0
        self.limits = {
            "/api/v1/auth/login": settings.auth_login_limit,
            "/api/v1/auth/register": settings.auth_register_limit,
        }
        self.clock = clock
        self.entries: OrderedDict[tuple[str, str], tuple[float, int]] = OrderedDict()
        self.lock = Lock()

    def reset(self):
        """Clear state for isolated test clients; never call during request handling."""
        with self.lock:
            self.entries.clear()

    def enter(self) -> bool:
        with self.lock:
            if self.active >= self.max_concurrent:
                return False
            self.active += 1
            return True

    def leave(self):
        with self.lock:
            self.active -= 1

    def retry_after(self, client: str, path: str) -> int | None:
        with self.lock:
            now = self.clock()
            while self.entries and next(iter(self.entries.values()))[0] <= now:
                self.entries.popitem(last=False)
            key = (client, path)
            entry = self.entries.get(key)
            if entry is None:
                # Do not evict active identities: cycling IP addresses cannot reset a full table.
                if len(self.entries) >= self.max_keys:
                    return max(1, math.ceil(next(iter(self.entries.values()))[0] - now))
                self.entries[key] = (now + self.window, 1)
                return None
            expires, count = entry
            if count >= self.limits[path]:
                return max(1, math.ceil(expires - now))
            self.entries[key] = (expires, count + 1)
            return None


class AuthRateLimitMiddleware:
    def __init__(self, app: ASGIApp, limiter: AuthRateLimiter):
        self.app = app
        self.limiter = limiter

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        path = scope.get("path", "").rstrip("/")
        if scope["type"] == "http" and scope["method"] == "POST" and path in self.limiter.limits:
            client = scope.get("client")
            retry = self.limiter.retry_after(client[0] if client else "unknown", path)
            admitted = retry is None and self.limiter.enter()
            if retry is None and not admitted:
                retry = 1
            if retry is not None:
                result = JSONResponse(
                    response(Request(scope), "RATE_LIMITED"),
                    status_code=429,
                    headers={"Retry-After": str(retry), "Cache-Control": "no-store"},
                )
                await result(scope, receive, send)
                return
            try:
                await self.app(scope, receive, send)
            finally:
                self.limiter.leave()
            return
        await self.app(scope, receive, send)


class SafeErrorBoundary:
    """Suppress Starlette's post-response re-raise before Uvicorn can log exception contents."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def safe_send(message: Message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, safe_send)
        except Exception:  # noqa: BLE001 - final ASGI boundary must redact every unexpected failure.
            # Do not log exception text, tracebacks, SQL parameters, URLs, tokens or request bodies.
            logger.error("api_request_failed")
            if not started:
                result = JSONResponse(response(Request(scope), "INTERNAL_ERROR"), status_code=500)
                await result(scope, receive, send)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, production: bool):
        self.app = app
        self.production = production

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def secure_send(message: Message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["Referrer-Policy"] = "no-referrer"
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
                if scope.get("path", "").startswith("/api/") or scope.get("path") in {"/health", "/ready"}:
                    headers["Cache-Control"] = "no-store"
                if self.production and scope.get("scheme") == "https":
                    headers["Strict-Transport-Security"] = "max-age=31536000"
            await send(message)

        await self.app(scope, receive, secure_send)
