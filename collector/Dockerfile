FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY collector/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY detector/ /app/detector-pkg/
COPY collector/ /app/collector-pkg/
RUN pip install --no-cache-dir --no-deps /app/detector-pkg /app/collector-pkg
COPY ml/artifacts/model.joblib /app/model/model.joblib
RUN useradd --create-home detector
USER detector
CMD ["python", "-m", "collector.service"]
