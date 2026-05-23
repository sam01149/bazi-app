FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc g++ curl && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /app/ephe && \
    curl -o /app/ephe/seas_18.se1 https://www.astro.com/ftp/swisseph/ephe/seas_18.se1 && \
    curl -o /app/ephe/sepl_18.se1 https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1 && \
    curl -o /app/ephe/semo_18.se1 https://www.astro.com/ftp/swisseph/ephe/semo_18.se1

COPY backend/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
