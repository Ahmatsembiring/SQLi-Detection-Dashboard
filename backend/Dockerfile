FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
RUN useradd --create-home appuser && chmod +x entrypoint.sh
USER appuser
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
