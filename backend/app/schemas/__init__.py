from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

Language = Literal["en", "ru", "kk"]
Status = Literal["TODO", "IN_PROGRESS", "DONE"]
Priority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]
Role = Literal["ADMIN", "MEMBER"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(Input):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("password", mode="before")
    @classmethod
    def preserve_password(cls, value):
        # Passwords are opaque; never strip whitespace from credentials.
        return value

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class Register(Login):
    username: str = Field(min_length=2, max_length=100, pattern=r"^\S(?:.*\S)?$")
    password: str = Field(min_length=8, max_length=128)
    preferred_language: Language = "en"


class Preferences(Input):
    preferred_language: Language


class ProjectCreate(Input):
    name: str = Field(min_length=1, max_length=150)
    description: str = Field(default="", max_length=10000)


class ProjectUpdate(Input):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=10000)

    @model_validator(mode="after")
    def no_nulls(self):
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Fields cannot be null")
        return self


class MemberCreate(Input):
    email: EmailStr
    role: Role = "MEMBER"


class MemberUpdate(Input):
    role: Role


class TaskCreate(Input):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=20000)
    assigned_to_id: int | None = Field(default=None, gt=0)
    status: Status = "TODO"
    priority: Priority = "MEDIUM"
    due_date: datetime | None = None

    @field_validator("due_date")
    @classmethod
    def aware_date(cls, value):
        if value is not None:
            if value.tzinfo is None:
                raise ValueError("Timezone required")
            return value.astimezone(UTC)
        return value


class TaskUpdate(TaskCreate):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=20000)
    status: Status | None = None
    priority: Priority | None = None

    @model_validator(mode="after")
    def no_nulls(self):
        if any(
            getattr(self, key) is None
            for key in self.model_fields_set
            if key not in {"due_date", "assigned_to_id"}
        ):
            raise ValueError("Fields cannot be null")
        return self
