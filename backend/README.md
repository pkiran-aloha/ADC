# Welina Analytics - .NET Core Web API Backend

Backend service for the **Welina Applied Behavior Analysis (ABA) Analytics & Reporting Module**.

## Tech Stack
- **Framework**: ASP.NET Core 8.0 Web API
- **Documentation**: Swagger / OpenAPI 3.0 (Swashbuckle)
- **Data Architecture**: In-memory analytics engine backed by the same versioned, fictional `data/clinicalSeed.json` fixture used by the frontend. The fixture is embedded into the API assembly at build time.

## Features & Endpoints
- `GET /api/clients`: Retrieve client roster and supervisor details
- `GET /api/programs`: Retrieve Skill Acquisition programs and unitary Behavior Reduction records by client (including objectives, teaching instructions and type-specific target settings)
- `GET /api/programs/catalogs`: Retrieve master prompt hierarchy templates and custom-field definitions referenced by programs
- `GET /api/overallmastery`: Cumulative target mastery progression over time with change-date aggregation
- `GET /api/targetanalytics/data`: Granular trial-by-trial, duration, frequency, interval, fluency/rate, therapist splits, and linear regression calculations
- `GET /api/abcanalytics`: Structured ABC observations for a client
- `GET /api/abcanalytics/configuration?clientId=cli-liam`: Treatment area, teaching instructions and configured textual antecedent/behavior/consequence/location lists
- `GET /api/annotations/summary`: Phase change lines, graph notes, and phase ranges
- `POST /api/annotations/phase-lines`: Create custom or automated phase change lines
- `GET /api/export/raw`: Export trial-level non-aggregated CSV
- `GET /api/export/raw/zip`: Export multi-target structured ZIP package

## How to Run Locally

### Prerequisites
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

### Run via .NET CLI
```bash
cd backend/src/Welina.Analytics.Api
dotnet run
```
API runs on `http://localhost:5000` (or `https://localhost:5001`).
Access Swagger UI at `http://localhost:5000/swagger`.

### Run via Docker
```bash
# From the repository root (the shared fixture is outside backend/):
docker build -t welina-analytics-api -f backend/Dockerfile .
docker run -p 5000:5000 welina-analytics-api
```
