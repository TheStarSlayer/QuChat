# QuantaChat

QuantaChat is a private, session-based chat application demonstrating secure session setup using a BB84-inspired Quantum Key Distribution (QKD) service and browser-side encryption (WebCrypto AES-GCM). The repository contains three cooperating components:

- `frontend/` — React + Vite SPA (login, online users, requests, chat UI).
- `backend/` — Express + Socket.IO server (authentication, request lifecycle, signed upload/download links, Redis + MongoDB persistence).
- `quantum_computer/` — FastAPI microservice providing RNG and BB84-style key-distribution endpoints (simulator + optional hardware integration).

This README follows the structure requested (i — ix) and documents ports, domains, architecture, run commands, required env vars, DB/Redis structure, API endpoints, and Socket.IO events.

---

## Ports (development defaults)

- Frontend (Vite): <http://localhost:8595>
- Backend (Express + Socket.IO): <http://localhost:8596> (controlled by `PORT` in `backend/index.js`)
- Quantum / QKD service (FastAPI / Uvicorn): <http://localhost:8598> (controlled by `PORT` in `quantum_computer/main.py`)

If you change ports, update related env variables: `FRONTEND_ADDR`, `QC_ADDR`, `SERVER_ADDR` as needed in your `.env` files and in the services.

---

## Domains (production)

- Frontend + Backend + Socket.IO: <https://quchat-iu40.onrender.com> (example)
- Quantum / QKD Service: <https://quantum-service-abgj.onrender.com> (example)

Update these hostnames for your deployment. The services set CORS and cookie behavior based on `PROD=true`.

---

## Quick architecture summary

- Frontend: stores a short-lived `accessToken` in `localStorage` (key: `access-token`) and relies on an `httpOnly` `refreshToken` cookie to rotate tokens. It calls `/auth/*` and `/api/*` and connects to the Socket.IO server with the access token passed in the socket handshake (`socket.handshake.auth.token`).
- Backend: exposes `/auth` and `/api` REST routes and a Socket.IO server. Authentication middleware (`api.middleware.js`) validates Bearer tokens on `/api` routes. The backend generates short-lived signed upload/download URLs for an S3-compatible R2 storage and coordinates request persistence in MongoDB and fast lookups in Redis.
- Quantum service: FastAPI microservice running Qiskit circuits (simulator or hardware). It provides RNG endpoints, BB84 distribution orchestration, index generation for QBER calculations, and error-correction helpers used during secure session setup.

High-level flow:

- User signs up / logs in → backend issues an `accessToken` (returned) and `refreshToken` cookie.
- Client lists online users (`/api/getOnlineUsers`), creates requests (`/api/persistRequest`) or eavesdrops.
- For `bb84` encryption: parties coordinate via Socket.IO (`shareBases`, `calculateQBER`, etc.) and the quantum service (`/distributeRawKey`, `/generateRandomIndices`) to derive a shared AES-GCM key for message/file encryption.

---

## Running locally

Prerequisites:

- Node.js (v18+ recommended)
- Python 3.10+ (for the quantum service)
- MongoDB and Redis (local, docker, or hosted)
- Optional: an S3-compatible R2 (Cloudflare R2) for signed uploads

Example local setup using separate terminals:

Frontend

```bash
cd frontend
npm install
npm run dev
```

Backend

```bash
cd backend
npm install
# development (nodemon):
npm run start
# or directly:
node index.js
```

Quantum service (preferred: `invoke` tasks)

```bash
cd quantum_computer
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows (PowerShell)
pip install -r requirements.txt
# Start via invoke (tasks.py provides `run`):
inv run
# or directly with uvicorn:
uvicorn main:app --host "localhost" --port 8598
```

Notes:

- `inv run` is a convenience wrapper (see `quantum_computer/tasks.py`) that runs the same `uvicorn` command.
- `backend/index.js` sets up the Socket.IO server and default CORS origin(s). In dev `io` accepts `http://localhost:8595` (frontend).

---

## Required environment variables

Recommended `backend/.env` keys (used throughout `backend/index.js`, controllers and helpers):

- `PORT` — backend HTTP port (default: `8596`)
- `FRONTEND_ADDR` — origin allowed by CORS (e.g. `http://localhost:8595`)
- `MONGODB_CONN` — MongoDB connection string (e.g., `mongodb://localhost:27017/quchat`)
- `REDIS_PASSWORD` — password for Redis (used by `redis.createClient` in `lib/dbConnect.js`)
- `R2_ENDPOINT` — S3/R2 endpoint URL used by `R2Actions.js`
- `R2_ACCESS_KEY` — R2 access key
- `R2_SECRET_ACCESS_KEY` — R2 secret key
- `ACCESS_TOKEN_SECRET` — JWT secret for access tokens
- `REFRESH_TOKEN_SECRET` — JWT secret for refresh tokens
- `SALT_ROUNDS` — bcrypt salt rounds (numeric string, e.g. `10`)
- `PROD` — `true`/`false`; sets secure cookie and static-serve behavior

Recommended `quantum_computer/.env` keys:

- `PORT` — quantum service port (default: `8598`)
- `QC_API_KEY` — optional IBM Qiskit runtime token
- `ACCESS_TOKEN_SECRET` — used to authorize QC endpoints (keep in sync with backend if needed)
- `SERVER_ADDR` — allowed origin (for CORS when `PROD=true`)
- `PROD` — `true`/`false`

### Frontend (.env) — Vite

The frontend uses Vite environment variables (must be prefixed with `VITE_`). There's a sample `frontend/.env` in the repo with values used for development. Key variables used by the frontend are:

- `VITE_QC_ADDR` — Quantum service base URL (used when `VITE_PROD` is `true`). Example: `https://quantum-service.example.com`
- `VITE_PROD` — `true`/`false` string used by the frontend to switch between dev and prod QC endpoints (e.g. `false` during local development).

Security note: keep secrets out of source control. Use `.env` and `.env.example` to document expected keys.

---

## Redis & MongoDB structure (how data is stored)

Redis (fast indices / short lived state):

- `onlineUsers` (ZSET) — score: timestamp, value: `username` — all currently-connected users.
- `idleUsers` (ZSET) — users available to receive requests (not busy). When user becomes busy `idleUsers` removes them.
- `allRequestIndex` (ZSET) — index of all pending request senders (score = createdOn).
- `EDRequestIndex` (ZSET) — pending requests available for eavesdropping (score = createdOn).
- `requester:<senderId>` (STRING) — serialized JSON of the request object created by `persistRequest` (used for quick lookup by senderId).
- `requestee:<receiverId>` (ZSET) — a list of senderIds waiting for this receiver.

Important implementation notes:

- `backend/lib/dbConnect.js` currently creates a Redis client that connects to a hard-coded host and calls `client.flushAll()` on connect — change this for production/local usage as needed.

MongoDB (persistent collections):

- `users` collection (see `backend/models/user.model.js`):
  - `username`: String
  - `password`: String (bcrypt hashed)
  - `refreshToken`: String (bcrypt-hashed refresh token)

- `onlineusers` collection (`OnlineUser` model):
  - `username`: String
  - `isBusy`: Boolean
  - `loggedAt`: Number (timestamp)

- `requestmodels` collection (`RequestModel`):
  - `sender`: String
  - `receiver`: String
  - `createdOn`: Number
  - `timeLimitInMs`: Number
  - `typeOfEncryption`: String (e.g., `bb84` or `none`)
  - `chatSessionTimeInMin`: Number
  - `isSimulator`: Boolean
  - `eavesdropper`: Boolean
  - `eavesdropperId`: String | null
  - `status`: String (e.g., `pending`, `accepted`, `cancelled`)

Quantum service Mongo collections (in `quantum_computer/main.py`):

- `circuit_metadata` — stores temporary metadata per `roomId` during key generation (`senderBases`, `senderBits`, `generatingMetadata`).
- `job_db` — stores outstanding job ids for simulator/hardware runs per `roomId` (`simulatorJobs`, `hardwareJobs`).

---

## API endpoints (detailed)

Auth routes (`backend/routes/auth.route.js` — unauthenticated):

- `POST /auth/signup` — body `{ username, password }` → creates user in MongoDB (returns `201` on success).
- `POST /auth/login` — body `{ username, password }` → returns `{ accessToken }` and sets `refreshToken` cookie (httpOnly). Prevents concurrent logins.
- `POST /auth/refresh` — rotates refresh/access tokens; requires `refreshToken` cookie. Returns `{ accessToken }` and sets new cookie.
- `POST /auth/logout` — clears cookie and clears stored hashed refresh token for the user.

Protected API (all routes under `/api` use `apiVerify` middleware that expects `Authorization: Bearer <token>`):

- `GET /api/verify` — returns `{ userId }` extracted from token.
- `GET /api/getOnlineUsers` — returns `{ onlineUsers: [{ username, profilePicture }, ...] }` (excludes requester).
- `PATCH /api/setToBusy` — marks caller busy, removes from `idleUsers`, and emits `userLeft` via Socket.IO.
- `PATCH /api/setToAvailable` — marks caller available, adds to `idleUsers`, and emits `newUser`.

Request lifecycle endpoints:

- `POST /api/persistRequest` — body `{ receiverId, timeLimitInMs, typeOfEncryption, chatSessionTimeInMin, isSimulator }`.
  - Verifies receiver availability, prevents duplicate requests, persists in `requestmodels` (Mongo) and updates Redis indices: `allRequestIndex`, `EDRequestIndex`, `requester:<senderId>`, `requestee:<receiverId>`.
  - Emits `requestForED` via Socket.IO.
  - Returns `{ msg, newRequestPublic }`.

- `GET /api/getMyActiveRequests` — returns pending requests where caller is the receiver (reads from Redis, falls back to Mongo where necessary).
- `GET /api/getEavesdroppableRequests` — returns pending requests other users can eavesdrop on (reads from Redis, falls back to Mongo).
- `PATCH /api/eavesdrop/:roomId` — caller claims eavesdrop on sender `roomId`. Atomically updates Mongo and Redis, removes `EDRequestIndex` entry and sets `requester:<senderId>` updated JSON. Emits `removeRequestForED`.
- `PATCH /api/finishRequest` — body `{ finishStatus }` — calls helper `finishRequest` that marks request status in Mongo, removes Redis indices (`allRequestIndex`, `EDRequestIndex`, etc.) and emits `removeRequest`.

File operations (R2 signed links):

- `GET /api/getUploadLink?bucketName=&key=&fileType=` — returns `{ uploadLink }` (signed PUT URL, expires ~80s).
- `GET /api/getDownloadLink?bucketName=&key=&expiresInMin=` — returns `{ downloadLink }` (signed GET URL, expiry in minutes).
- `DELETE /api/deleteObjects` — body `{ bucketName, keys }` — deletes objects in R2 via `R2Actions.js`.

Quantum / QKD service endpoints (`quantum_computer/main.py`):

- `GET /rng/{typeOfMachine}` — `typeOfMachine` ∈ {`sim`, `hw`} → schedule/run quantum measurements; returns job id or immediate bitstrings for simulator.
- `POST /generateRandomIndices` — body `{ typeOfMachine, keyLength }` (protected) → returns `{ randIndices: [...] }` used in QBER selection.
- `POST /generateECMetadata` — protected; body `{ key }` → returns parity bits for error-correction (uses BCHCode helper).
- `POST /correctErrorsInKey` — protected; body `{ key }` → returns corrected key after ECC decode.
- `POST /distributeRawKey/{roomId}` — protected; coordinates sender/receiver/eavesdropper flows for BB84 metadata (bases/bits), may return `425` while metadata is being generated.
- `GET /generateAndRunBB84Circuit` — runs provided bit strings/bases on simulator/hardware and returns observed bits / job ids.
- `DELETE /deleteMetadata/{roomId}` — protected; cleans up metadata and job_db entries for `roomId`.

Refer to `quantum_computer/main.py` for implementation details and return shapes.

---

## Socket.IO events (authoritative in `backend/io.index.js` & `backend/lib/socketEventLib.js`)

Socket auth: the client must pass the access token in the socket handshake: `{ auth: { token } }`. The socket middleware (`ioAuth`) verifies the token and attaches `socket.userId`.

Client -> Server (events emitted by clients):

- `sendJoinRequest` — payload: `request` object `{ sender, receiver, createdOn, timeLimitInMs, typeOfEncryption, chatSessionTimeInMin, isSimulator }`.
- `eavesdropRequest` — payload: `roomId` (sender id) — join as eavesdropper.
- `accept` — payload: `(roomId, typeOfEncryption)` — accept a request; server sets socket flags and emits `response` to the sender.
- `updateOnResponseAccept` — payload: `roomId` — mark non-QKD accept acknowledged.
- `updateOnResponseAcceptQC` — payload: `roomId` — mark QKD accept acknowledged.
- `reject` — payload: `roomId` — reject a request.
- `joinAck` — payload: `(roomId, ack)` — host ack; can trigger `distributeRawKey` flow.
- `shareBases` — payload: `(roomId, bases)` — share measurement bases (BB84).
- `calculateQBER` — payload: `(roomId, subset)` where `subset: { randIndex: [], randReceiverKey: [] }` — ask other party to calculate QBER.
- `shareQBERResult` — payload: `(roomId, qber)` — share measured QBER.
- `updateOnQBERAccept` — payload: `roomId` — finalize QKD accept and transition to chat.
- `sendParityBits` — payload: `(roomId, parityBits)` — send ECC parity bits.
- `keyCorrected` — payload: `(roomId)` — indicate key correction completed.
- `sendMessage` — payload: `(roomId, message)` where `message` is `{ message, sender, containsFile, fileKey, fileName }` — server forwards to room with added profilePic.
- `leave` — payload: `roomId` — leave room / stop eavesdropping.
- `resetSocketStats` — no payload — reset socket flags.
- `sessionDisturbed` — payload: `(roomId, message)` — notify others session was disturbed.
- `sessionEnd` — payload: `roomId` — terminate session.

Server -> Client (events emitted by server):

- `newUser` — `{ username, profilePicture }` — broadcast when a user becomes available.
- `userLeft` — `username` — broadcast when a user leaves or goes busy.
- `requestForED` — `newRequestPublic` — notify eavesdroppers of a new pending request.
- `removeRequestForED` — `senderId` — remove ED entry when claimed.
- `removeRequest` — `userId` — notify that a request was finished/removed.
- `renewedEDRequest` — `newRequestPublic` — emitted when an eavesdropping session aborts and the request is re-listed for ED.
- `requestToJoin` — `request` object — forwarded to receiver when sender emits `sendJoinRequest`.
- `requestFailed` — `message` — failure notifications (host gone, session disturbed, keygen failed).
- `response` — `'accepted' | 'rejected'` — the receiver's response to a join request.
- `ackFromHost` — `ack` boolean — host ack in join flow.
- `bases` — `(bases, userId)` — forwarded during QKD base exchange.
- `qber` — `subset` — forwarded during QBER calculation.
- `qberResult` — `qber` number — forwarded QBER result.
- `parity` — ECC parity bits.
- `keyCorrected` — notify correction done.
- `message` — `{ message, sender, containsFile, fileKey, fileName, profilePic }` — chat messages forwarded to room participants.
- `keyGenFailed` — `message` — emitted when a key generation session fails.
- `sessionDisturbed` / `sessionEnd` — notify session termination or disturbance.

Server disconnect logic:

- On socket `disconnect` the server deletes the user's `OnlineUser` entry, removes Redis indices, emits `userLeft`, handles in-flight request cleanup (e.g., returning an eavesdrop claim back to `EDRequestIndex`), and triggers `finishRequest` or `keyGenFailed` where appropriate.

---

## Notes & next steps

- `backend/lib/dbConnect.js` flushes Redis on connect — change before running against shared Redis in production.
- If you'd like, I can add a `backend/.env.example`, `docker-compose.yml` for local dev (MongoDB + Redis + backend + frontend + quantum), or small helper scripts to start all services. Tell me which you prefer and I'll add it.
