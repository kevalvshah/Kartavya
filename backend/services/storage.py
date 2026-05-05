"""
storage.py — Abstract storage interface.
Current implementation: base64-in-Postgres.
Swap to S3/R2/B2 by implementing the same interface in a subclass.
"""
import base64
import uuid
from typing import Optional


class StorageBackend:
    """Abstract base — all methods raise NotImplementedError."""
    async def upload(self, data: bytes, filename: str, content_type: str) -> str:
        raise NotImplementedError

    async def download(self, key: str) -> bytes:
        raise NotImplementedError

    async def delete(self, key: str):
        raise NotImplementedError

    def public_url(self, key: str) -> Optional[str]:
        return None


class InlineBase64Storage(StorageBackend):
    """
    Stores files as base64 data URIs directly in the key.
    Zero dependencies, works everywhere, but limited to ~5MB files.
    Replace with S3Storage or R2Storage once storage decision is made (end of Week 2).
    """
    async def upload(self, data: bytes, filename: str, content_type: str) -> str:
        b64 = base64.b64encode(data).decode()
        return f"data:{content_type};base64,{b64}"

    async def download(self, key: str) -> bytes:
        if key.startswith("data:"):
            b64_part = key.split(",", 1)[1]
            return base64.b64decode(b64_part)
        raise ValueError("Not a base64 inline key")

    async def delete(self, key: str):
        pass  # inline data — nothing to delete externally

    def public_url(self, key: str) -> Optional[str]:
        return key  # base64 URIs are self-contained


# Active backend — swap this line when storage decision is made
active_storage: StorageBackend = InlineBase64Storage()


async def upload_file(data: bytes, filename: str, content_type: str) -> str:
    return await active_storage.upload(data, filename, content_type)

async def download_file(key: str) -> bytes:
    return await active_storage.download(key)

async def delete_file(key: str):
    return await active_storage.delete(key)

def get_public_url(key: str) -> Optional[str]:
    return active_storage.public_url(key)
