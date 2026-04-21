# statki

## Szybki start (1 komenda)

W katalogu glowym projektu uruchom:

```zsh
npm run up
```

To polecenie:
- utworzy `server/.env` i `client/.env` na podstawie plikow `.env.example` (jesli ich nie ma),
- zainstaluje zaleznosci dla `server` i `client`,
- uruchomi backend i frontend jednoczesnie.

## Kolejne uruchomienia

Po pierwszym setupie wystarczy:

```zsh
npm run dev
```

---

## Wdrożenie na Railway

Projekt składa się z dwóch serwisów: **backend** (Node.js + Express + Socket.IO) i **frontend** (React + Vite jako strona statyczna). Baza danych to **MongoDB Atlas** (zewnętrzny cloud, bezpłatny plan M0 wystarczy).

### 1. Przygotowanie bazy danych — MongoDB Atlas

1. Zarejestruj się na [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Utwórz bezpłatny klaster (tier **M0 Free**).
3. W zakładce **Database Access** dodaj użytkownika bazy z hasłem.
4. W zakładce **Network Access** dodaj regułę `0.0.0.0/0` (dostęp ze wszystkich adresów IP — Railway używa dynamicznych IP).
5. Skopiuj **Connection String** w formacie:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/statki?retryWrites=true&w=majority
   ```

---

### 2. Deploy backendu na Railway

1. Zaloguj się na [railway.app](https://railway.app) i kliknij **New Project → Deploy from GitHub repo**.
2. Wskaż swoje repozytorium.
3. Railway wykryje projekt — wybierz katalog **`server`** jako **Root Directory** (Settings → Root Directory → `server`).
4. Ustaw **Start Command** (jeśli nie wykryje automatycznie):
   ```
   node index.js
   ```
5. W zakładce **Variables** dodaj następujące zmienne środowiskowe:

   | Zmienna | Wartość |
   |---|---|
   | `PORT` | `3001` (Railway może to nadpisać automatycznie zmienną `$PORT`) |
   | `MONGODB_URI` | Connection String z MongoDB Atlas |
   | `JWT_SECRET` | Losowy długi ciąg znaków |
   | `JWT_REFRESH_SECRET` | Drugi losowy długi ciąg znaków |
   | `CLIENT_URL` | URL frontendu na Railway (uzupełnij po deployu frontendu, np. `https://statki-frontend.up.railway.app`) |

6. Kliknij **Deploy**. Po chwili otrzymasz publiczny URL backendu, np.:
   ```
   https://statki-backend.up.railway.app
   ```

> **Uwaga:** Railway automatycznie ustawia zmienną `PORT` — upewnij się, że serwer nasłuchuje na `process.env.PORT`. W `server/index.js` powinno być:
> ```js
> const PORT = process.env.PORT || 3001;
> ```

---

### 3. Deploy frontendu na Railway

1. W tym samym projekcie (lub nowym) kliknij **New Service → GitHub repo**.
2. Wskaż to samo repozytorium, ustaw **Root Directory** na `client`.
3. Ustaw **Build Command**:
   ```
   npm install && npm run build
   ```
4. Ustaw **Start Command**:
   ```
   npx serve dist -l $PORT
   ```
   lub skorzystaj z pluginu **Static Site** w Railway (jeśli dostępny), wskazując katalog `dist`.
5. W zakładce **Variables** dodaj:

   | Zmienna | Wartość |
   |---|---|
   | `VITE_API_URL` | `https://<twój-backend>.up.railway.app/api` |
   | `VITE_SOCKET_URL` | `https://<twój-backend>.up.railway.app` |

6. Kliknij **Deploy**. Zmienne `VITE_*` są wbudowywane w build — Railway musi je znać **przed** uruchomieniem `npm run build`.

---

### 4. Zaktualizuj `CLIENT_URL` w backendzie

Po uzyskaniu URL frontendu wróć do serwisu backendu i zaktualizuj zmienną:

```
CLIENT_URL=https://<twój-frontend>.up.railway.app
```

Następnie ponownie wdróż backend (lub poczekaj na automatyczny redeploy).

---

### Podsumowanie zmiennych środowiskowych

**Backend (`server/.env` / Railway Variables):**
```dotenv
PORT=3001
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/statki?retryWrites=true&w=majority
JWT_SECRET=<losowy-ciag-min-32-znaki>
JWT_REFRESH_SECRET=<losowy-ciag-min-32-znaki>
CLIENT_URL=https://<twój-frontend>.up.railway.app
```

**Frontend (`client/.env` / Railway Variables):**
```dotenv
VITE_API_URL=https://<twój-backend>.up.railway.app/api
VITE_SOCKET_URL=https://<twój-backend>.up.railway.app
```

