from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

DATABASE_URL = "postgresql://postgres:123456@localhost/netflix_db"

engine = create_engine(DATABASE_URL)  #this is to create the engine and connect to the database

SessionLocal = sessionmaker( #this is to create a session and store it in the local memory
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