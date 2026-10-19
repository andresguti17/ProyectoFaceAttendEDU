FROM python:3.12-slim AS builder
WORKDIR /app
# face-recognition (dlib) and opencv-python-headless compile native extensions.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake pkg-config libopenblas-dev liblapack-dev \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir poetry==1.8.3 && poetry config virtualenvs.in-project true
COPY pyproject.toml poetry.lock* ./
RUN poetry install --no-root --only main --no-interaction --no-ansi

FROM python:3.12-slim
# dlib (a face-recognition dependency) is linked against libopenblas/liblapack
# at build time in the builder stage above — the runtime .so's must be present
# here too, or `import dlib` fails with "libopenblas.so.0: cannot open shared
# object file". Confirmed by actually running this image: it crashed on start
# without these. opencv-python-headless needs no extra runtime libs (that's
# the point of "headless" — no libGL/X11).
RUN apt-get update && apt-get install -y --no-install-recommends wget libopenblas0 liblapack3 \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system app && adduser --system --ingroup app app
WORKDIR /app
COPY --from=builder /app/.venv ./.venv
COPY . .
RUN chown -R app:app /app
ENV PATH="/app/.venv/bin:$PATH"
USER app
EXPOSE 8086
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8086"]
