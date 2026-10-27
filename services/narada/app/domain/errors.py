"""Business-rule errors. Pure: no imports from other app layers."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FieldError:
    """One rule a submitted form broke, addressed to the field the user must fix.

    `field` is a dotted path in the API's camelCase vocabulary (e.g. `answers.2.key`) so
    the frontend can put the message under the exact input.
    """

    field: str
    message: str


class DomainValidationError(Exception):
    """A request was well-formed but broke a business rule."""

    def __init__(self, errors: list[FieldError]) -> None:
        super().__init__("; ".join(f"{e.field}: {e.message}" for e in errors))
        self.errors = errors
