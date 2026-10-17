from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.db.engine import build_engine

engine = build_engine(get_settings())
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
