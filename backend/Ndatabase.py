from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

DATABASE_URL = "postgresql://postgres:123456@localhost/Netflix_users"

# this is to create the engine and connect to the database
engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(  # this is to create a session and store it in the local memory
    autocommit=False,
    autoflush=False,
    bind=engine
)


class Base(DeclarativeBase):
    pass


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
