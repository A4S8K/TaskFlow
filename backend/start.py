"""Validated web-process entry point. Schema changes are an explicit release step."""

import os
import sys

import uvicorn
from pydantic import ValidationError

from app.core.config import get_settings


def main() -> int:
    try:
        settings = get_settings()
        port = int(os.environ.get("PORT", "8000"))
        if not 1 <= port <= 65535:
            raise ValueError()
    except ValidationError as exc:
        errors = exc.errors(include_input=False, include_context=False)
        print("Invalid TaskFlow configuration:", file=sys.stderr)
        for item in errors:
            field = ".".join(map(str, item["loc"])) or "production_settings"
            print(f"- {field}: {item['msg']}", file=sys.stderr)
        return 1
    except (ValueError, TypeError):
        print("Invalid TaskFlow PORT; use an integer from 1 to 65535.", file=sys.stderr)
        return 1
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        workers=settings.web_concurrency,
        proxy_headers=settings.ingress_mode == "explicit-proxy",
        forwarded_allow_ips=settings.trusted_proxy_ips,
        access_log=False,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
