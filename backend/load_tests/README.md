# Local Load-Testing Infrastructure & Benchmarks

> **Note**: This directory and the root `docker-compose.yml` provide an **optional, throwaway local load-testing sandbox**. Normal local development does **not** require Docker Postgres or Redis.

---

## Overview

This directory contains the k6 load-testing suite for MediClinic, designed to benchmark system throughput, concurrency resilience, query counts, and cache effectiveness under multi-stage virtual user (VU) ramps.

Traffic is weighted across three primary categories:
1. **Public Listing Reads (~50%)**: Cached endpoints (`/api/public/clinics/`, `/api/public/doctors/`, `/api/public/specialties/`).
2. **Authenticated Dashboard Reads (~35%)**: Authenticated staff endpoints (`/api/appointments/`, `/api/analytics/dashboard/`).
3. **Slot Availability Lookup (~15%)**: Uncached live database evaluation (`/api/public/doctors/{id}/slots/?date=...`).

---

## Spin-up & Execution Steps

Follow these steps to run a load test against an isolated local environment:

### 1. Start Sandbox Services (Docker)
Start the dedicated load-test PostgreSQL (port `5433`) and Redis (port `6379`):
```bash
docker compose up -d
```

### 2. Apply Migrations to Sandbox Database
Ensure `DATABASE_URL` in `backend/.env` points to the sandbox (`postgres://postgres:localdev@127.0.0.1:5433/mediclinic`):
```bash
cd backend
python manage.py migrate
```

### 3. Seed Realistic Load-Test Volume
Populate the sandbox with realistic clinics, doctors, staff, patients, and appointments:
```bash
python manage.py seed_load_test_data --clinics 4 --doctors-per-clinic 4 --patients 75 --appointments 300
```

### 4. Run WSGI Application Server
Launch a multi-threaded WSGI server (e.g. Waitress on Windows or Gunicorn on Linux):
```bash
# Windows (Waitress with 6 worker threads)
waitress-serve --listen=127.0.0.1:8000 --threads=6 config.wsgi:application

# Linux/macOS (Gunicorn with 3 workers, 2 threads)
gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3 --threads 2
```

### 5. Execute k6 Benchmark
Run the automated multi-stage benchmark (`10 -> 50 -> 100 -> 200` VUs):
```bash
k6 run backend/load_tests/k6_load_test.js
```

### 6. Teardown
When load testing is complete, destroy the throwaway sandbox containers and volumes:
```bash
docker compose down -v
```
