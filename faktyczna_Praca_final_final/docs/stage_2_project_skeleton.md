# Etap 2: Szkielet Projektu i Środowisko Uruchomieniowe

> **Projekt**: Bezpieczna aplikacja notatek z szyfrowaniem End-to-End (E2EE)  
> **Przedmiot**: Zespołowy Projekt Inżynierski (ZPI / KCWD)  
> **Status**: Wdrożony i przetestowany szkielet backendu (Etap 2)  
> **Wersja**: 1.0.0  

---

## 1. Zrealizowany Zakres Prac (Etap 2)

W ramach Etapu 2 zaimplementowano kompletną architekturę szkieletu aplikacji backendowej, warstwy danych, testów oraz konteneryzacji:

1. **Modularna struktura katalogów**:
   - `backend/app/core`: Zarządzanie konfiguracją (`Pydantic Settings`), obsługa wyjątków bez wycieku szczegółów wewnętrznych oraz kryptograficzne hashowanie haseł (`Argon2id`) i tokenów sesyjnych (`SHA-256`).
   - `backend/app/db`: Asynchroniczny silnik SQLAlchemy 2.0 (`AsyncEngine`, `async_sessionmaker`, generator sesji `get_db`).
   - `backend/app/models`: Deklaratywne modele relacyjne `User`, `UserSession` oraz `Note` zgodne z architekturą Zero-Knowledge.
   - `backend/app/schemas`: Kontrakty DTO i schematy walidacji Pydantic v2 dla uwierzytelniania, parametrów KDF, szyfrogramów i paginacji.
   - `backend/app/api`: Zależności (`deps.py`), router API v1 oraz endpoint diagnostyczny `GET /api/v1/health`.
   - `backend/app/main.py`: Punkt startowy aplikacji FastAPI z middleware CORS oraz nagłówkami bezpieczeństwa (CSP, X-Frame-Options, X-Content-Type-Options, HSTS).
2. **Warstwa bazodanowa i migracje Alembic**:
   - Skonfigurowane asynchroniczne środowisko `alembic/env.py`.
   - Gotowa pierwsza migracja `001_initial_schema.py` tworząca tabele `users`, `user_sessions` oraz `notes`.
3. **Konteneryzacja Docker**:
   - Wielowarstwowy `Dockerfile` dla backendu oparty na unprivileged userze (`appuser`).
   - `docker-compose.yml` dla PostgreSQL 16 Alpine oraz backendu FastAPI z healthcheckami i izolowaną siecią `app_network`.
   - `docker-compose.override.yml` dla wygody lokalnego developmentu (porty, live reload).
4. **Zestaw testów automatycznych (Pytest)**:
   - `conftest.py` z testową bazą asynchroniczną in-memory SQLite (`aiosqlite`).
   - Testy endpointów API (`/`, `/api/v1/health`, nagłówki bezpieczeństwa).
   - Testy integralności modeli, kluczy obcych i kaskadowego usuwania.
   - Testy operacji kryptograficznych (`Argon2id`, `SHA-256`, constant-time compare).
   - 100% testów przechodzi pomyślnie.
5. **Jakość kodu**:
   - Zgodność ze standardami lintera **Ruff** (0 błędów).
   - Ścisła kontrola typów Mypy / Pydantic.

---

## 2. Instrukcja Uruchomienia Lokalnego

### 2.1. Uruchomienie za pomocą Docker Compose (Zalecane)
```bash
cd ZPI_ISI_KCWD/faktyczna_Praca_final_final
cp .env.example .env
docker compose up --build
```
Aplikacja będzie dostępna pod adresem:
* API: `http://localhost:8000`
* Dokumentacja OpenAPI: `http://localhost:8000/api/v1/docs`
* Healthcheck: `http://localhost:8000/api/v1/health`

### 2.2. Uruchomienie lokalne z wirtualnym środowiskiem Python
```bash
cd ZPI_ISI_KCWD/faktyczna_Praca_final_final/backend
python -m venv .venv
# Aktywacja środowiska (Windows):
.\.venv\Scripts\Activate.ps1

# Instalacja zależności:
pip install -r requirements.txt

# Uruchomienie testów:
$env:PYTHONPATH="."
pytest tests

# Uruchomienie serwera deweloperskiego:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
