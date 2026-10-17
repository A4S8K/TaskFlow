FROM python:3.12.15-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml constraints.txt ./
COPY app ./app
RUN python -m pip install --no-cache-dir --upgrade pip==26.2 \
    && python -m pip install --no-cache-dir -c constraints.txt . \
    && useradd --create-home taskflow
COPY alembic ./alembic
COPY alembic.ini ./
COPY start.py ./
USER taskflow
EXPOSE 8000
CMD ["python", "start.py"]
