"""Pydantic schemas for authentication and authorization."""

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field


class LoginRequest(BaseModel):
    """User credentials for authentication."""

    email: EmailStr = Field(..., description="Corporate or user email address")
    password: str = Field(..., min_length=1, description="Account password")


class RefreshTokenRequest(BaseModel):
    """Payload to exchange a refresh token for a new access token."""

    refresh_token: str | None = Field(default=None, description="Raw refresh token string (optional if provided via session cookie)")


class UserResponse(BaseModel):
    """Public user identity and role assignment."""

    id: uuid.UUID
    email: str
    full_name: str | None = None
    is_active: bool = True
    roles: list[str] = Field(default_factory=list)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def role(self) -> str:
        """Primary role for frontend and API compatibility."""
        if "SUPER_ADMIN" in self.roles:
            return "SUPER_ADMIN"
        if "ADMIN" in self.roles:
            return "ADMIN"
        if "MANAGER" in self.roles:
            return "MANAGER"
        return self.roles[0] if self.roles else "EMPLOYEE"

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """Access and refresh token payload returned on successful authentication."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(default=900, description="Access token lifespan in seconds")
    user: UserResponse
    session_expires_in: int | None = Field(default=28800, description="Session absolute lifespan in seconds (8 hours)")


class RegisterRequest(BaseModel):
    """Payload to provision a new user account."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=150)
    role: str = Field(default="EMPLOYEE", description="Initial role assignment")


class UpdateUserRequest(BaseModel):
    """Payload to modify user profile, active state, or role assignment."""

    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    role: str | None = None
    is_active: bool | None = None

