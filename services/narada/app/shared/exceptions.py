"""Errors raised below the API layer; endpoints translate them into HTTP responses."""


class NotFoundError(Exception):
    """A requested record does not exist. `code` becomes the HTTP 404 detail."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class ServiceUnavailableError(Exception):
    """A dependency the request needs is not configured. `code` becomes the HTTP 503 detail."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code
