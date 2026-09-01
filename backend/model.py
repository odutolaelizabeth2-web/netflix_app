
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from Ndatabase import Base


class Avatar(Base):
    __tablename__ = "avatars"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    avatar_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )

    gender: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC)
    )

    @property
    def image_path(self) -> str:
        return self.avatar_url


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    user_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False
    )

    password: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    phone_number: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    avatar_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("avatars.id"),
        nullable=True
    )

    movies_watched: Mapped[int] = mapped_column(
        Integer,
        default=0
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC)
    )

    # Relationships
    avatar: Mapped["Avatar | None"] = relationship()

    watch_history: Mapped[list["WatchHistory"]] = relationship(
        back_populates="user"
    )

    ratings: Mapped[list["Rating"]] = relationship(
        back_populates="user"
    )


class WatchHistory(Base):
    __tablename__ = "watch_history"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    movie_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    watched_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC)
    )

    user: Mapped["User"] = relationship(
        back_populates="watch_history"
    )


class Rating(Base):
    __tablename__ = "ratings"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    movie_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC)
    )

    user: Mapped["User"] = relationship(
        back_populates="ratings"
    )

    __table_args__ = (
        CheckConstraint(
            "rating BETWEEN 1 AND 5",
            name="rating_range"
        ),
        UniqueConstraint(
            "user_id",
            "movie_id",
            name="unique_user_movie_rating"
        ),
    )

