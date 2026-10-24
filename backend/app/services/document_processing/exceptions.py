"""Document processing domain exceptions."""

from __future__ import annotations


class DocumentProcessingError(Exception):
    """Base error for document processing failures."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class DecryptionFailedError(DocumentProcessingError):
    """Raised when authorized PDF password fails to unlock the document."""

    def __init__(
        self,
        message: str = (
            "Document is encrypted and password verification failed. "
            "Please verify that client details match the issuing authority records."
        ),
    ):
        super().__init__(message, status_code=400)
