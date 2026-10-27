# Zadanie: Zaprojektowanie architektury i szkieletu bezpiecznej aplikacji do notatek z szyfrowaniem end-to-end

## 1. Rola i cel

Działaj jako doświadczony Senior Backend Engineer, Software Architect oraz Security Engineer, specjalizujący się w Pythonie, FastAPI, PostgreSQL, aplikacjach internetowych i bezpieczeństwie systemów.

Zaprojektuj architekturę oraz szkielet backendu dla nowoczesnej aplikacji internetowej, w której użytkownicy mogą tworzyć, odczytywać, edytować i usuwać prywatne notatki.

**Kluczowym wymaganiem jest rzeczywiste szyfrowanie end-to-end (E2EE).** Backend nie może mieć możliwości odczytania treści notatek ani uzyskania dostępu do kluczy deszyfrujących użytkownika.

Projekt ma być bezpieczny, modularny, łatwy w rozwijaniu, testowaniu i utrzymaniu. Stosuj dobre praktyki programistyczne, zasadę najmniejszych uprawnień, bezpieczne domyślne ustawienia oraz standardy tworzenia API.

Nie ograniczaj się do ogólnych porad. Przygotuj konkretny plan architektury, strukturę katalogów, schemat bazy danych, kontrakty API, przykładowe implementacje oraz dokumentację techniczną.

## 2. Stack technologiczny

Wykorzystaj następujące technologie:

### Backend
- Python 3.12 lub nowszy, stabilny i zgodny z wybranymi zależnościami.
- FastAPI jako framework API.
- Pydantic v2 do walidacji danych i konfiguracji.
- PostgreSQL jako relacyjna baza danych.
- SQLAlchemy 2.x jako ORM.
- Alembic do migracji schematu bazy danych.
- Pytest do testów jednostkowych i integracyjnych.
- Ruff do lintowania i formatowania kodu oraz kontroli wybranych błędów.
- Mypy lub inny uzasadniony mechanizm statycznej kontroli typów.

### Frontend
- React.
- TypeScript.
- Vite.
- Biblioteka kryptograficzna działająca po stronie przeglądarki, dobrana na podstawie bezpieczeństwa, jakości dokumentacji i utrzymania projektu.

Frontend odpowiada za szyfrowanie i odszyfrowywanie notatek. Backend odpowiada za uwierzytelnianie, autoryzację, przechowywanie zaszyfrowanych danych oraz synchronizację.

### Środowisko
- Docker i Docker Compose do lokalnego uruchamiania aplikacji i PostgreSQL.
- Pliki `.env` wyłącznie na potrzeby lokalnej konfiguracji, bez umieszczania sekretów w repozytorium.
- Git oraz pliki konfiguracyjne przydatne w profesjonalnym procesie developmentu.

W przypadku wyboru dodatkowych bibliotek uzasadnij ich wykorzystanie. Nie dodawaj zależności bez konkretnej potrzeby.

## 3. Najważniejszy wymóg: prawdziwe szyfrowanie E2EE

Zaprojektuj system tak, aby treść notatek była szyfrowana i odszyfrowywana wyłącznie po stronie klienta.

Wymagania:

1. Treść notatki musi zostać zaszyfrowana w przeglądarce przed wysłaniem do backendu.
2. Backend nie może otrzymywać tekstu jawnego notatek, kluczy szyfrujących ani danych umożliwiających ich odtworzenie.
3. Odszyfrowywanie musi odbywać się po stronie klienta.
4. Baza danych może przechowywać wyłącznie szyfrogramy oraz niezbędne metadane.
5. Uwierzytelnianie użytkownika i szyfrowanie notatek muszą być rozdzielone na poziomie architektury i przepływu danych.
6. Zmiana lub reset hasła do konta nie może automatycznie powodować utraty albo niejawnego zastępowania kluczy szyfrujących.
7. Zaprojektuj bezpieczny proces tworzenia, przechowywania, odtwarzania i rotacji kluczy, uwzględniając możliwość utraty dostępu do danych.
8. Jasno opisz, co stanie się z notatkami w przypadku utraty hasła lub materiału kluczowego oraz jakie ograniczenia ma odzyskiwanie konta.
9. Nie implementuj własnych algorytmów kryptograficznych. Korzystaj z uznanych, sprawdzonych bibliotek i standardowych konstrukcji kryptograficznych.
10. Zapewnij integralność i uwierzytelnienie szyfrogramów, a nie tylko poufność danych.
11. Zadbaj o bezpieczne generowanie nonce/IV, odpowiednie parametry algorytmów i brak ponownego używania nonce w sytuacjach, w których jest to niedopuszczalne.
12. Nie przesyłaj kluczy ani haseł w logach, adresach URL, analityce, komunikatach błędów lub metadanych requestów.

Przed wyborem rozwiązania kryptograficznego porównaj odpowiednie opcje, takie jak AES-GCM lub XChaCha20-Poly1305, oraz uzasadnij wybór biblioteki przeznaczonej do użycia w przeglądarce. Przy projektowaniu wyprowadzania kluczy z hasła uwzględnij odpowiedni, odporny na ataki offline mechanizm KDF, np. Argon2id, wraz z odpowiednimi parametrami i solą.

Nie zakładaj, że samo przesyłanie danych przez HTTPS zapewnia E2EE.

Wyraźnie wskaż, które informacje mimo szyfrowania pozostają widoczne dla serwera, np. identyfikatory użytkowników, rozmiary szyfrogramów, czasy aktualizacji oraz część metadanych. Ogranicz ich zakres do niezbędnego minimum.

## 4. Model zagrożeń i granice zaufania

Przed zaprojektowaniem implementacji określ model zagrożeń.

Uwzględnij co najmniej:

- nieautoryzowany dostęp do konta użytkownika;
- ataki brute force i credential stuffing;
- SQL injection;
- XSS oraz ryzyko kradzieży danych i materiału kluczowego w przeglądarce;
- CSRF, jeżeli sposób uwierzytelniania tworzy takie ryzyko;
- IDOR/BOLA, czyli dostęp do notatek należących do innych użytkowników;
- kradzież lub wyciek sesji;
- wyciek danych z logów, backupów i komunikatów błędów;
- przejęcie bazy danych;
- błędną konfigurację CORS, HTTPS i nagłówków bezpieczeństwa;
- ataki na łańcuch dostaw zależności;
- błędy w obsłudze kluczy kryptograficznych;
- kompromitację kodu JavaScript dostarczanego użytkownikowi przez serwer.

Dla każdego istotnego zagrożenia przedstaw:
- scenariusz ataku;
- potencjalne konsekwencje;
- zabezpieczenia w projekcie;
- ograniczenia zastosowanych zabezpieczeń.

Nie deklaruj pełnego bezpieczeństwa. Wyjaśnij, że E2EE nie chroni automatycznie przed złośliwym kodem dostarczonym przez skompromitowany frontend, zainfekowaną przeglądarką ani przejętym urządzeniem.

## 5. Architektura backendu

Zaprojektuj backend w sposób modularny, unikając zarówno monolitycznego pliku z całą logiką, jak i przedwczesnego dzielenia aplikacji na mikroserwisy.

Preferuj jasny podział odpowiedzialności pomiędzy:
- warstwę API i endpointy;
- schematy żądań oraz odpowiedzi;
- logikę biznesową;
- dostęp do danych;
- modele ORM;
- obsługę uwierzytelniania i autoryzacji;
- konfigurację aplikacji;
- obsługę błędów;
- mechanizmy bezpieczeństwa;
- testy i migracje.

Wskaż, które elementy należą do backendu, a które muszą pozostać po stronie klienta, aby zachować E2EE.

Zaproponuj spójny styl architektoniczny. Unikaj zbędnych warstw, wzorców projektowych i abstrakcji, które nie przynoszą rzeczywistych korzyści.

## 6. Struktura projektu

Zaproponuj kompletną strukturę katalogów dla backendu i przedstaw, w jaki sposób frontend React + Vite powinien integrować się z API.

Struktura powinna uwzględniać przynajmniej:
- aplikację FastAPI i punkt wejścia;
- routery i endpointy;
- schematy Pydantic;
- logikę biznesową;
- repozytoria lub inny uzasadniony mechanizm dostępu do danych;
- modele SQLAlchemy;
- konfigurację i zarządzanie ustawieniami;
- uwierzytelnianie oraz autoryzację;
- obsługę wyjątków;
- migracje Alembic;
- testy jednostkowe i integracyjne;
- dokumentację;
- pliki Docker i konfigurację środowiska.

Dla każdego katalogu oraz istotnego pliku opisz jego odpowiedzialność. Struktura ma być praktyczna dla małego projektu, ale umożliwiać dalszy rozwój.

## 7. Projekt bazy danych PostgreSQL

Przygotuj schemat bazy danych dostosowany do E2EE.

Rozważ tabele dotyczące:
- użytkowników i danych potrzebnych do logowania;
- sesji lub mechanizmu odświeżania uwierzytelnienia, jeżeli będzie używany;
- notatek;
- wersji formatu szyfrowania i kryptograficznych metadanych potrzebnych do deszyfrowania;
- opcjonalnych mechanizmów odzyskiwania lub opakowywania kluczy.

Dla każdej tabeli podaj:
- kolumny i typy danych;
- klucz główny i klucze obce;
- ograniczenia, indeksy i unikalność;
- zasady usuwania danych;
- uzasadnienie przyjętego projektu.

Uwzględnij wersjonowanie formatu szyfrogramu, aby umożliwić przyszłe zmiany kryptograficzne.

Nie zapisuj jawnych tytułów ani treści notatek w bazie, jeżeli mają być poufne. Wyjaśnij, czy tytuły, tagi i inne funkcje organizacyjne również będą szyfrowane.

Nie zapisuj haseł w postaci jawnej ani w postaci zwykłego skrótu SHA-256. Dobierz odpowiedni mechanizm przechowywania haseł do uwierzytelniania.

Przedstaw przykładowe modele SQLAlchemy i migrację Alembic dla podstawowego schematu.

## 8. Projekt API REST

Zaprojektuj wersjonowane API REST z czytelnym kontraktem.

Uwzględnij endpointy dla:
- rejestracji;
- logowania i wylogowania;
- odświeżania sesji, jeśli jest potrzebne;
- informacji o aktualnie uwierzytelnionym użytkowniku;
- tworzenia notatki;
- pobierania listy notatek;
- pobierania pojedynczej notatki;
- edycji notatki;
- usuwania notatki;
- opcjonalnej synchronizacji oraz obsługi konfliktów edycji.

Dla każdego endpointu podaj:
- metodę HTTP i ścieżkę;
- przeznaczenie;
- wymagane uprawnienia;
- schemat żądania i odpowiedzi;
- możliwe kody statusu HTTP;
- walidację danych;
- ograniczenia rozmiaru i częstotliwości żądań;
- istotne przypadki błędów.

Przesyłane treści notatek powinny mieć format umożliwiający przechowywanie szyfrogramu oraz niezbędnych parametrów kryptograficznych. Backend nie może interpretować ani odszyfrowywać treści.

Zastosuj paginację list notatek oraz mechanizm wykrywania konfliktów edycji, jeśli jest potrzebny. Nie wprowadzaj funkcji współdzielenia notatek ani wyszukiwania po tekście jawnego, jeżeli nie zostaną osobno uzasadnione i zaprojektowane dla E2EE.

## 9. Uwierzytelnianie, sesje i autoryzacja

Zaprojektuj bezpieczny mechanizm uwierzytelniania dla aplikacji React + FastAPI.

Porównaj odpowiednie opcje, a następnie wybierz i uzasadnij rozwiązanie dopasowane do aplikacji przeglądarkowej.

Uwzględnij:
- bezpieczne przechowywanie haseł;
- bezpieczne zarządzanie sesją;
- rotację i unieważnianie tokenów, jeśli są stosowane;
- ciasteczka `HttpOnly`, `Secure` i odpowiednią politykę `SameSite`, jeżeli wybór architektury je wykorzystuje;
- ochronę przed CSRF stosownie do przyjętej metody uwierzytelniania;
- ograniczenia prób logowania;
- procedury wylogowania;
- weryfikację uprawnień do każdej notatki;
- możliwość unieważnienia sesji;
- bezpieczne odzyskiwanie konta bez udawania, że reset hasła automatycznie przywraca dostęp do zaszyfrowanych notatek.

Nie używaj JWT tylko dlatego, że jest popularny. Wybierz rozwiązanie na podstawie rzeczywistych potrzeb aplikacji.

## 10. Bezpieczeństwo backendu

Uwzględnij co najmniej następujące zabezpieczenia:

- walidacja wszystkich danych wejściowych;
- parametryzowane zapytania i bezpieczne operacje ORM;
- kontrola własności zasobów;
- ograniczenia rozmiaru żądań i długości pól;
- rate limiting dla logowania, rejestracji i pozostałych wrażliwych endpointów;
- bezpieczna obsługa wyjątków;
- brak szczegółowych tracebacków w odpowiedziach produkcyjnych;
- minimalne uprawnienia konta PostgreSQL;
- prawidłowa obsługa sekretów i konfiguracji;
- restrykcyjna konfiguracja CORS;
- wymuszanie HTTPS w środowisku produkcyjnym;
- odpowiednie nagłówki bezpieczeństwa, w tym polityka CSP;
- bezpieczne logowanie zdarzeń bez treści notatek i sekretów;
- aktualizacja oraz audyt zależności;
- kopie zapasowe i udokumentowane zasady retencji danych;
- bezpieczne migracje bazy danych;
- opcjonalne kontrole jakości kodu i skanowanie zależności w CI.

Rozdziel zabezpieczenia konieczne w pierwszej wersji od ulepszeń, które można wdrożyć na późniejszym etapie.

## 11. Dokumentowanie kodu

Dokumentuj kod w sposób profesjonalny i praktyczny.

Wymagania:
- type hints dla funkcji i istotnych struktur;
- docstringi dla modułów, klas i funkcji, których odpowiedzialność nie jest oczywista;
- komentarze wyjaśniające decyzje architektoniczne i nietrywialne aspekty bezpieczeństwa;
- czytelne nazwy;
- jednoznaczne komunikaty błędów;
- brak komentarzy, które jedynie powtarzają działanie oczywistego kodu;
- dokumentacja uruchomienia, konfiguracji, API i migracji;
- diagram przepływu danych dla szyfrowania oraz uwierzytelniania;
- udokumentowane założenia i ograniczenia systemu.

Wygeneruj przykładowy plik `.env.example` zawierający wyłącznie nazwy zmiennych i niesekretne wartości przykładowe. Nie umieszczaj prawdziwych kluczy, haseł ani tokenów.

## 12. Testy

Zaprojektuj strategię testowania obejmującą:

- testy jednostkowe logiki biznesowej;
- testy endpointów FastAPI;
- testy integracyjne z PostgreSQL;
- testy walidacji i obsługi błędów;
- testy autoryzacji i izolacji danych między użytkownikami;
- próby odczytu i edycji cudzych notatek;
- testy limitów żądań;
- testy migracji;
- testy integracji frontend-backend;
- testy przepływu szyfrowania i deszyfrowania po stronie klienta;
- testy sprawdzające, że backend przechowuje i zwraca wyłącznie szyfrogram;
- testy regresyjne krytycznych mechanizmów bezpieczeństwa.

Dodaj przykłady testów, które sprawdzają, czy użytkownik A nie może uzyskać dostępu do notatki użytkownika B nawet po ręcznej zmianie identyfikatora zasobu.

Nie traktuj pomyślnego przejścia testów jako dowodu pełnego bezpieczeństwa kryptograficznego.

## 13. Docker i środowiska

Przygotuj konfigurację lokalnego środowiska z Docker Compose dla:
- backendu FastAPI;
- PostgreSQL;
- opcjonalnych narzędzi pomocniczych, jeżeli są rzeczywiście potrzebne.

Zastosuj dobre praktyki:
- przypięte lub kontrolowane wersje obrazów;
- nieuruchamianie aplikacji z uprawnieniami roota, gdy to możliwe;
- healthchecki;
- trwały wolumen dla danych PostgreSQL;
- bezpieczną konfigurację sieci;
- brak sekretów w obrazach i repozytorium;
- poprawną obsługę migracji;
- rozdzielenie konfiguracji deweloperskiej i produkcyjnej.

Wyjaśnij, czego nie należy kopiować z lokalnej konfiguracji bez zmian do środowiska produkcyjnego.

## 14. Organizacja pracy

Podziel realizację na etapy:

**Etap 1 — projekt i decyzje architektoniczne**
- wymagania funkcjonalne i niefunkcjonalne;
- model zagrożeń;
- diagram komponentów i granic zaufania;
- decyzje dotyczące kryptografii, kluczy i uwierzytelniania;
- projekt bazy danych oraz API.

**Etap 2 — szkielet projektu**
- struktura katalogów;
- konfiguracja aplikacji;
- połączenie z PostgreSQL;
- modele i migracje;
- podstawowe testy;
- Docker Compose.

**Etap 3 — uwierzytelnianie i autoryzacja**
- rejestracja i logowanie;
- sesje;
- kontrola dostępu;
- testy izolacji danych.

**Etap 4 — API notatek**
- operacje CRUD na szyfrogramach;
- paginacja;
- walidacja;
- obsługa błędów i konfliktów.

**Etap 5 — integracja z E2EE**
- kontrakt frontend-backend;
- szyfrowanie po stronie klienta;
- zarządzanie i odzyskiwanie kluczy;
- testy przepływu kryptograficznego.

**Etap 6 — hardening i dokumentacja**
- testy bezpieczeństwa;
- konfiguracja produkcyjna;
- analiza zależności;
- checklisty wdrożeniowe;
- dokumentacja uruchomienia i utrzymania.

## 15. Format odpowiedzi

Pracuj w następującej kolejności:

1. Założenia i wymagania.
2. Najważniejsze decyzje architektoniczne wraz z uzasadnieniem.
3. Model zagrożeń i granice zaufania.
4. Diagram architektury oraz przepływu szyfrowania.
5. Struktura katalogów z opisem.
6. Schemat bazy danych.
7. Specyfikacja endpointów.
8. Strategia uwierzytelniania i zarządzania kluczami.
9. Plan zabezpieczeń.
10. Szkielet kodu najważniejszych modułów.
11. Testy jednostkowe i integracyjne.
12. Docker Compose oraz konfiguracja.
13. Instrukcja uruchomienia krok po kroku.
14. Lista pozostałych zadań i ograniczeń przed wdrożeniem produkcyjnym.

Kod podawaj w osobnych blokach z dokładną ścieżką pliku. Dbaj o spójność importów, nazw klas, modeli i endpointów pomiędzy plikami.

Nie generuj całego projektu w jednym ogromnym bloku kodu. Zbuduj minimalny, działający i spójny szkielet, a następnie rozwijaj go etapami.

Gdy musisz podjąć decyzję, której nie określono w wymaganiach, wybierz bezpieczny i praktyczny wariant, jawnie opisz założenie i krótko je uzasadnij. Pytaj o doprecyzowanie tylko wtedy, gdy brak informacji rzeczywiście uniemożliwia podjęcie istotnej decyzji.

**Priorytety projektu w kolejności ważności:**
1. Poprawność i rzeczywista poufność E2EE.
2. Bezpieczeństwo uwierzytelniania i autoryzacji.
3. Czytelność, modularność i utrzymywalność kodu.
4. Testowalność i możliwość dalszego rozwoju.
5. Prostota wdrożenia i rozsądne koszty utrzymania.

Nie deklaruj, że projekt jest produkcyjnie bezpieczny bez niezależnego audytu. Wskaż obszary wymagające szczególnej weryfikacji kryptograficznej i bezpieczeństwa.