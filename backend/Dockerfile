FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml constraints.txt ./
COPY app ./app
RUN pip install --no-cache-dir -c constraints.txt . && useradd --create-home taskflow
COPY alembic ./alembic
COPY alembic.ini ./
USER taskflow
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
