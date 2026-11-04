# Etap 4: API Notatek (CRUD na Szyfrogramach, Paginacja i Obsługa Konfliktów)

> **Projekt**: Bezpieczna aplikacja notatek z szyfrowaniem End-to-End (E2EE)  
> **Przedmiot**: Zespołowy Projekt Inżynierski (ZPI / KCWD)  
> **Status**: Wdrożone i przetestowane API notatek (Etap 4)  
> **Wersja**: 1.0.0  

---

## 1. Zrealizowany Zakres Prac (Etap 4)

W ramach Etapu 4 zaimplementowano pełne asynchroniczne API REST dla operacji na zaszyfrowanych notatkach w modelu **Zero-Knowledge**:

### 1.1. Warstwa Repozytorium (`app/repositories/note_repo.py`)
* **Izolacja Danych (Strict Multi-Tenancy)**:
  - Metoda `get_by_id(db, note_id, user_id)` bezwzględnie wymusza warunek `Note.id == note_id AND Note.user_id == user_id`.
  - Zapobiega podatnościom **BOLA / IDOR** (Broken Object Level Authorization).
* **Paginacja i Sortowanie**:
  - Metoda `list_by_user(db, user_id, limit, offset)` zwraca posortowaną listę notatek (od najnowszej modyfikacji `updated_at DESC`) oraz całkowitą liczbę rekordów `total` użytkownika.
* **Optymistyczna Blokada Współbieżności**:
  - Każda operacja aktualizacji `update(...)` atomowo inkrementuje licznik `version` (`note.version += 1`).
* **Trwałe Usuwanie**:
  - `delete(...)` wykonuje trwałe usunięcie (Hard Delete) szyfrogramu z bazy PostgreSQL.

### 1.2. Warstwa Logiki Biznesowej (`app/services/note_service.py`)
* **Rygorystyczna Walidacja Kryptograficzna**:
  - Sprawdzanie poprawności kodowania Base64 dla pól `ciphertext`, `nonce_iv` oraz `auth_tag`.
  - Weryfikacja długości wektora IV po zdekodowaniu: **dokładnie 12 bajtów (96 bitów)** – standard dla AES-GCM.
  - Weryfikacja długości tagu uwierzytelniającego: **dokładnie 16 bajtów (128 bitów)** – standard dla AES-GCM.
  - Ochrona przed atakami DoS przez ograniczenie maksymalnego rozmiaru szyfrogramu (10 MB).
* **Wykrywanie Konfliktów Edycji (Optimistic Concurrency Control)**:
  - Przed modyfikacją sprawdzane jest, czy przesłana przez klienta wersja odpowiada wersji w bazie (`note.version == request.version`).
  - W przypadku rozbieżności zgłaszany jest wyjątek `ConflictError (409 Conflict)`, co chroni użytkownika przed nadpisaniem notatki edytowanej w innej karcie/urządzeniu.
* **Ochrona Przed Powtórzeniem Wektora Nonce/IV (Nonce Reuse Prevention)**:
  - AES-GCM traci gwarancje poufności i integralności w przypadku ponownego użycia tego samego IV z tym samym kluczem.
  - Serwis jawnie odrzuca żądania aktualizacji, w których `request.nonce_iv == note.nonce_iv`, wymuszając wygenerowanie nowej, kryptograficznie bezpiecznej wartości losowej na kliencie.
  - Dodatkowo ograniczenie unikalności `uq_note_nonce (id, nonce_iv)` na poziomie bazy danych stanowi ostateczną barierę ochronną.
* **Mitigacja Enumeracji Zasobów**:
  - Przy próbie pobrania, modyfikacji lub usunięcia cudzej bądź nieistniejącej notatki serwer zwraca identyczny błąd `404 Not Found`.

### 1.3. Endpointy REST API (`app/api/v1/endpoints/notes.py`)
Wszystkie endpointy wymagają uwierzytelnienia przez ciasteczko sesyjne `HttpOnly` (`get_current_user`):

| Metoda | Ścieżka | Opis | Kody Statusu |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notes` | Pobranie paginowanej listy szyfrogramów użytkownika (`limit`, `offset`) | `200 OK` |
| `POST` | `/api/v1/notes` | Utworzenie nowej zaszyfrowanej notatki (klient generuje UUID lub serwer przypisuje nowe) | `201 Created`, `400 Bad Request`, `409 Conflict` |
| `GET` | `/api/v1/notes/{id}` | Pobranie pojedynczego szyfrogramu do odszyfrowania po stronie klienta | `200 OK`, `404 Not Found` |
| `PUT` | `/api/v1/notes/{id}` | Aktualizacja szyfrogramu z wersją optymistyczną i nowym IV | `200 OK`, `400 Bad Request`, `404 Not Found`, `409 Conflict` |
| `DELETE` | `/api/v1/notes/{id}` | Trwałe usunięcie notatki | `204 No Content`, `404 Not Found` |

---

## 2. Testy Automatyczne i Jakość Kodu

W pliku `tests/test_notes.py` zaimplementowano pełen zestaw scenariuszy testowych:
1. `test_notes_crud_lifecycle`: pełny cykl życia notatki (tworzenie -> pobranie -> edycja -> usunięcie -> weryfikacja 404).
2. `test_notes_pagination`: wielostronicowa paginacja (strony po 2 elementy, offset, poprawność sumarycznego licznika `total`).
3. `test_optimistic_concurrency_conflict`: wykrycie konfliktu wersji, odmowa nadpisania przy nieaktualnej wersji (`409 Conflict`), poprawna inkrementacja wersji na 2.
4. `test_nonce_iv_reuse_forbidden`: natychmiastowe odrzucenie powtórzonego wektora IV przy aktualizacji (`409 Conflict`).
5. `test_crypto_validation_rules`: walidacja uszkodzonego Base64, niepoprawnej długości IV (np. 8 bajtów zamiast 12) oraz niepoprawnej długości tagu (np. 10 bajtów zamiast 16).
6. `test_data_isolation_idor_bola_protection`: rygorystyczny test wielodostępności – Użytkownik B nie ma możliwości odczytania, zmodyfikowania, usunięcia ani wylistowania notatek Użytkownika A (każda próba zwraca `404 Not Found`, a lista notatek B jest pusta).

### Statystyka Weryfikacji:
* **Pytest**: **24/24 testy zakończone sukcesem (100% passed)** w 18.11 s.
* **Ruff**: 0 błędów (`All checks passed!`).
* **Mypy**: 0 błędów w 29 plikach źródłowych (`Success: no issues found`).

---

## 3. Gotowość do Kolejnego Etapu
API backendu jest w pełni ukończone i gotowe do integracji z warstwą kryptograficzną klienta w **Etapie 5: Implementacja E2EE po stronie klienta (React/TypeScript, Web Crypto API, Argon2id Wasm)**.
