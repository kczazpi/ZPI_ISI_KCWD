# Etap 3: Uwierzytelnianie, Sesje i Kontrola Dostępu

> **Projekt**: Bezpieczna aplikacja notatek z szyfrowaniem End-to-End (E2EE)  
> **Przedmiot**: Zespołowy Projekt Inżynierski (ZPI / KCWD)  
> **Status**: Wdrożony i przetestowany moduł uwierzytelniania i sesji (Etap 3)  
> **Wersja**: 1.0.0  

---

## 1. Zrealizowany Zakres Prac (Etap 3)

W ramach Etapu 3 zaimplementowano kompletną architekturę uwierzytelniania, zarządzania sesjami oraz kontroli dostępu zgodną z założeniami Zero-Knowledge:

### 1.1. Warstwa Repozytoriów (`app/repositories`)
* **`user_repo.py` (`UserRepository`)**:
  - `get_by_id`: asynchroniczne wyszukiwanie użytkownika po UUID.
  - `get_by_email`: znormalizowane (lowercase, trim) wyszukiwanie użytkownika po adresie e-mail.
  - `create`: bezpieczne wstawienie rekordu użytkownika z serwerowym hashem hasła, solą `kdf_salt` i parametrami KDF.
* **`session_repo.py` (`SessionRepository`)**:
  - `create_session`: rejestracja nowej sesji z tokenem sesyjnym zashowanym algorytmem SHA-256.
  - `get_by_token_hash`: pobranie aktywnej sesji z bazy danych.
  - `revoke_session`: unieważnienie (usunięcie) pojedynczej sesji (logout).
  - `revoke_all_user_sessions`: unieważnienie wszystkich aktywnych sesji danego użytkownika na wszystkich urządzeniach (global logout).

### 1.2. Logika Biznesowa (`app/services/auth_service.py`)
* **Ochrona przed enumeracją kont (`Account Enumeration Mitigation`)**:
  - W endpointzie `GET /api/v1/auth/kdf-params`, jeśli konto nie istnieje, serwer zwraca deterministyczną fałszywą sól wygenerowaną za pomocą `HMAC-SHA256(SECRET_KEY, email)`.
  - Atakujący sondujący bazę adresów e-mail otrzymuje identyczną strukturę odpowiedzi i czas przetwarzania, co uniemożliwia stwierdzenie, czy dany e-mail jest zarejestrowany.
* **Ochrona przed atakami czasowymi (`Timing Attacks Mitigation`)**:
  - W przypadku próby logowania na nieistniejący adres e-mail wykonywana jest atrapa weryfikacji Argon2id (`DUMMY_PASSWORD_HASH`), co wyrównuje czas odpowiedzi serwera niezależnie od istnienia konta.
* **Separacja kryptograficzna E2EE**:
  - Serwer nigdy nie widzi hasła jawnego $P$ ani klucza deszyfrującego $K_{master}$.
  - Klient przesyła `auth_hash` (skrót SHA-256 z $K_{auth}$), który serwer powtórnie hashuje z użyciem **Argon2id** przed zapisem do bazy PostgreSQL.
* **Zarządzanie sesjami**:
  - Generowanie kryptograficznie bezpiecznych 32-bajtowych tokenów (64 znaki hex).
  - W bazie przechowywany jest wyłącznie hash SHA-256 tokenu sesyjnego.

### 1.3. Endpointy REST API (`app/api/v1/endpoints/auth.py`)
1. `GET /api/v1/auth/kdf-params?email=...` -> zwrot soli KDF i parametrów Argon2id (status 200).
2. `POST /api/v1/auth/register` -> rejestracja nowego konta (status 201 lub 409 Conflict).
3. `POST /api/v1/auth/login` -> uwierzytelnienie poświadczeń, utworzenie sesji w bazie i nadanie ciasteczka `Set-Cookie: e2ee_session_id=...; HttpOnly; SameSite=Lax; Path=/` (status 200).
4. `POST /api/v1/auth/logout` -> unieważnienie bieżącej sesji w bazie i usunięcie ciasteczka (status 200).
5. `POST /api/v1/auth/logout-all` -> globalne unieważnienie wszystkich aktywnych sesji zalogowanego użytkownika (status 200).
6. `GET /api/v1/auth/me` -> pobranie profilu zalogowanego użytkownika weryfikowane przez zależność `get_current_user` (status 200 lub 401 Unauthorized).

---

## 2. Testy Automatyczne i Weryfikacja Jakości

* **Pytest (`tests/test_auth.py` + dotychczasowe testy)**:
  - 18/18 testów zakończonych sukcesem w 4.40 s.
  - Pokrycie: rejestracja, duplikacja e-maila, pobieranie soli dla kont istniejących i nieistniejących, logowanie z poprawnym i błędnym hasłem, weryfikacja nagłówka `Set-Cookie: HttpOnly`, dostęp do endpointu chronionego `/me`, unieważnienie sesji po wylogowaniu, wygasanie sesji po czasie (`expires_at`), globalne wylogowanie ze wszystkich urządzeń (`logout-all`).
* **Linter Ruff**: 0 błędów (`All checks passed!`).
* **Statyczna kontrola typów Mypy**: 0 błędów w 26 plikach źródłowych (`Success: no issues found`).

---

## 3. Kolejne Kroki
Projekt jest w pełni przygotowany do realizacji **Etapu 4: API Notatek (CRUD na szyfrogramach, paginacja, wykrywanie konfliktów edycji i optymistyczna blokada)**.
