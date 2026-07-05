from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class BootstrapAdminRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=255)
    full_name: str = Field(min_length=1, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, value: str) -> str:
        return value.strip()


class DeleteAccountRequest(BaseModel):
    # SSO accounts have no usable password, so a fresh Google ID token for the
    # account's email is accepted as the confirmation credential instead.
    password: Optional[str] = Field(default=None, min_length=1, max_length=255)
    google_id_token: Optional[str] = Field(default=None, min_length=1, max_length=4096)

    @model_validator(mode="after")
    def require_exactly_one_credential(self) -> "DeleteAccountRequest":
        if bool(self.password) == bool(self.google_id_token):
            raise ValueError(
                "Provide either your password or a Google sign-in token"
            )
        return self


class ChangePasswordRequest(BaseModel):
    # Google re-auth lets SSO accounts set their first usable password.
    current_password: Optional[str] = Field(default=None, min_length=1, max_length=255)
    google_id_token: Optional[str] = Field(default=None, min_length=1, max_length=4096)
    new_password: str = Field(min_length=8, max_length=255)

    @model_validator(mode="after")
    def require_exactly_one_credential(self) -> "ChangePasswordRequest":
        if bool(self.current_password) == bool(self.google_id_token):
            raise ValueError(
                "Provide either your current password or a Google sign-in token"
            )
        return self


class GoogleSsoRequest(BaseModel):
    id_token: str = Field(min_length=1, max_length=4096)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=4096)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserRead
