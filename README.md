# QuChat

QuChat is a private chat application demonstrating an session-based chat, utilizing a trusted server key distributor using a BB84-inspired quantum key distribution (QKD) service for key generation and WebCrypto (AES-GCM) for message/file encryption.

The project contains three primary components:

- `frontend/` — React + Vite single-page application (login, user list, requests, chat UI).
- `backend/` — Express API and Socket.IO server (authentication, request persistence, socket events, signed upload/download links).
- `quantum_computer/` — FastAPI microservice used for RNG/QKD operations (Qiskit-based simulator / IBM runtime integration).

This README documents how the pieces fit together, required environment variables, developer run commands, and important implementation notes (file uploads, encryption, and QKD flow).

## Ports (development)

- Frontend (Vite dev server): <http://localhost:8595>
- Backend (Express HTTP API): <http://localhost:8596>
- Socket.IO server (Socket.IO server created in backend): <http://localhost:8597>
- Quantum / QKD service (FastAPI / Uvicorn): <http://localhost:8598>

These ports are the defaults used in the code and CORS configuration. If you change ports, update the corresponding env variables (`FRONTEND_ADDR`, `SERVER_ADDR`, `IO_ADDR`) used by the services.

## Quick architecture summary

- Frontend: stores a short-lived `accessToken` (returned by `POST /auth/login`) in `localStorage.accessToken`. A `refreshToken` is stored as an `httpOnly` cookie by the backend and is used with `POST /auth/refresh` to obtain fresh access tokens.
- Backend: serves REST endpoints under `/auth` and `/api`, and a Socket.IO server for real-time signaling and in-session messaging. It also provides endpoints for signed file upload/download links (used for large media transfers) backed by an S3-compatible R2 client.
- Quantum service: provides randomness and BB84-like key distribution endpoints used during secure session setup when `bb84` encryption is selected.

## Running locally — overview

Prerequisites:

- Node.js (v18+ recommended)
- Python 3.10+ (for the quantum service)
- A running Redis and MongoDB instance (or set `MONGODB_CONN` / `REDIS_PASSWORD` accordingly)
- Optional: Cloudflare R2 or an S3-compatible storage for file uploads (with credentials in env)

Typical workflow:

1. Start Redis & MongoDB or configure connection strings.
2. Start the quantum service (optional if you only test without hardware): see `quantum_computer/README` (or run using uvicorn below).
3. Start the backend: installs dependencies and `node backend/index.js` (or use `npm run dev` if you add a script).
4. Start the frontend: `npm install` then `npm run dev` in `frontend/`.

### Start commands (quick)

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
node index.js
```

Quantum service (optional)

```bash
cd quantum_computer
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows (PowerShell)
pip install -r requirements.txt
python -u main.py
```

Adjust commands as needed for your environment.

## Required environment variables

Backend (`backend/.env` or system env):

- `MONGODB_CONN` — MongoDB connection string.
- `REDIS_PASSWORD` — Redis password (if your Redis instance uses one).
- `FRONTEND_ADDR` — origin allowed by CORS for frontend (e.g., `http://localhost:8595`).
- `SERVER_ADDR` — backend server origin (e.g., `http://localhost:8596`).
- `IO_ADDR` — Socket.IO origin (e.g., `http://localhost:8597`).
- `R2_ENDPOINT` — S3/R2 endpoint URL (required for file signed links).
- `R2_ACCESS_KEY` — S3/R2 access key.
- `R2_SECRET_ACCESS_KEY` — S3/R2 secret key.
- `ACCESS_TOKEN_SECRET` — JWT secret for access tokens.
- `REFRESH_TOKEN_SECRET` — JWT secret for refresh tokens.
- `SALT_ROUNDS` — bcrypt salt rounds used for password hashing (numeric string).
- `PROD` — when set to "true" enables secure cookie settings for refresh token.

Quantum service (`quantum_computer/.env`):

- `QC_API_KEY` — if using IBM Qiskit runtime.
- `ACCESS_TOKEN_SECRET` — shared JWT secret used to authorize certain QC calls (keep in sync with backend if you require QC route authorization).
- `FRONTEND_ADDR` / `SERVER_ADDR` — origins for CORS.

Frontend (`frontend/.env`):

- `VITE_API_BASE` or similar (depending on your `frontend/src/lib/api.js` configuration) — point to `http://localhost:8596` in dev.

Note: many examples in the code expect these environment variables; inspect `backend/index.js`, `quantum_computer/main.py`, and `frontend/src/lib/api.js` for exact usage.

## API endpoints (high level)

Auth (`/auth`):

- `POST /auth/signup` — create account
- `POST /auth/login` — returns `{ accessToken }` and sets `refreshToken` cookie
- `POST /auth/refresh` — exchange cookie for new access token
- `POST /auth/logout` — clear refresh cookie

Application API (`/api/*`) — protected by access token via `Authorization: Bearer <token>` header:

- `GET /api/verify` — check token
- `GET /api/getOnlineUsers` — list other online users
- `PATCH /api/setToBusy` / `PATCH /api/setToAvailable` — update availability
- Request management: `POST /api/persistRequest`, `GET /api/getMyActiveRequests`, `GET /api/getEavesdroppableRequests`, `PATCH /api/finishRequest`, `PATCH /api/eavesdrop/:roomId`

File operations (signed links):

- `GET /api/getUploadLink?bucketName=quchat&key=<fileKey>&fileType=<mime>` — returns a signed URL to `PUT` the file to R2. The backend `getUploadLink` uses an 80-second expiry for upload links.
- `GET /api/getDownloadLink?bucketName=quchat&key=<fileKey>&expiresInMin=<minutes>` — returns a signed URL valid for `expiresInMin` minutes to `GET` the file.

The frontend uses these signed URLs for direct client-side uploads/downloads (no file is proxied through the backend). When `bb84` encryption is in use the frontend encrypts files client-side before uploading.

## Encryption and QKD (implementation notes)

- When users select `bb84` encryption, the app runs a BB84-inspired flow coordinated via the quantum service and Socket.IO. The QC service generates random bases/bits and the parties perform sifting and QBER estimation using Socket.IO events (`shareBases`, `calculateQBER`, `qberResult`, etc.).
- After sifting, the frontend derives an AES-GCM key from the QKD result (the frontend uses `getAESKey()` which hashes the sifted/processed key and imports it as a WebCrypto AES-GCM key).
- Messages are encrypted with AES-GCM using WebCrypto and encoded as Base64 strings. Files are encrypted client-side (AES-GCM) as raw bytes before being uploaded to the signed upload URL. On download the client fetches the blob and decrypts it using the same AES key.
- Protector utilities for the frontend are in `frontend/src/lib/protector.js` (`getAESKey`, `encrypt`, `decrypt`, `encryptFile`, `decryptFile`).

Security notes / caveats:

- AES-GCM is used in the browser via WebCrypto — keys are derived locally from QKD output. Do not send raw secret keys over the network.
- Signed upload links are short-lived (server-side upload expiry is 80 seconds). Ensure the client uploads quickly after receiving the link; otherwise the signed URL will expire and the upload will fail.
- CORS settings for the signed URL (R2) must allow browser access — misconfigured R2/CORS will cause uploads/downloads to fail.

## File size and client behavior

- The frontend validates selected files before upload. The current client-side limit is 100 MB (see `ChatSession.jsx` -> `checkFileSize`). If a file exceeds the limit the UI discards the selected file and shows an error toast.
- On upload the client requests an upload link from `/api/getUploadLink` and performs a `PUT` directly to R2. If the session uses `bb84` encryption the client encrypts the file bytes before the `PUT`.

## Socket.IO events (Complete)

Below are the Socket.IO events used by the server and clients. See `backend/io.index.js` and `backend/lib/socketEventLib.js` for the authoritative implementation.

Clients must attach the access token in the socket handshake, for example:

```js
io('http://localhost:8597', { auth: { token } })
```

Client -> Server (events the client emits):

- `sendJoinRequest` — payload: `request` object
  - `request` shape: `{ sender, receiver, createdOn, timeLimitInMs, typeOfEncryption, chatSessionTimeInMin, isSimulator }`.
  - Action: Sender requests to join another user; server forwards to receiver via `requestToJoin`.

- `eavesdropRequest` — payload: `roomId` (the sender's id)
  - Action: Join as eavesdropper for `roomId`.

- `accept` — payload: `(roomId, typeOfEncryption)`
  - Action: Receiver accepts a request; server joins room and emits `response` to the sender.

- `updateOnResponseAccept` — payload: `roomId`
  - Action: Client informs server to update socket state for non-QKD accept.

- `updateOnResponseAcceptQC` — payload: `roomId`
  - Action: Client informs server to update socket state for QKD accept.

- `reject` — payload: `roomId`
  - Action: Reject incoming request; server emits `response: 'rejected'` to sender.

- `joinAck` — payload: `(roomId, ack)`
  - Action: Acknowledge that the client joined; server forwards `ackFromHost`.

- `shareBases` — payload: `(roomId, bases)`
  - Action: Share measurement bases during QKD; server forwards `bases` to other party.

- `calculateQBER` — payload: `(roomId, subset)`
  - `subset` shape: `{ randIndex: [], randReceiverKey: [] }`.
  - Action: Ask the other party to calculate QBER; server forwards as `qber`.

- `shareQBERResult` — payload: `(roomId, qber)`
  - Action: Share QBER result; server forwards as `qberResult` and updates session status if necessary.

- `updateOnQBERAccept` — payload: `roomId`
  - Action: Inform server that QBER was accepted and finalize transition to chat session.

- `sendMessage` — payload: `(roomId, message)`
  - `message` shape: `{ message, sender, containsFile, fileKey }`.
  - Action: Send encrypted/text message or file metadata to other participants; server forwards as `message` with a `profilePic` field added.

- `leave` — payload: `roomId`
  - Action: Leave the session room; server resets socket stats.

- `resetSocketStats` — no payload
  - Action: Reset session-related socket flags on server.

- `sessionDisturbed` — payload: `(roomId, message)`
  - Action: Notify server of a disturbance; server forwards to room.

- `sessionEnd` — payload: `roomId`
  - Action: End the session; server forwards `sessionEnd` to room.

- `disconnect` — no payload (socket.io disconnect)
  - Action: Server handles disconnect and may emit cleanup events (see server behavior below).

Server -> Client (events the server emits / clients should handle):

- `newUser` — payload: `{ username, profilePicture }`
  - Emitted when a user becomes available (e.g., `setToAvailable`) or on connect broadcast.

- `userLeft` — payload: `username`
  - Emitted when a user goes busy or disconnects.

- `requestForED` — payload: `newRequestPublic` (see `POST /api/persistRequest`)
  - Emitted via `io.emit` when a new request is persisted; used to populate eavesdroppable request lists.

- `removeRequestForED` — payload: `senderId`
  - Emitted when an eavesdropper claims a request (remove from ED index/UI).

- `removeRequest` — payload: `userId` (sender)
  - Emitted when a request is finished/removed (via `finishRequest`).

- `requestToJoin` — payload: `request` object
  - Forwarded to the intended receiver when a sender emits `sendJoinRequest`.

- `requestFailed` — payload: `message` (string)
  - Emitted in many failure cases (host not available, disconnected, key gen failure, etc.).

- `response` — payload: `'accepted' | 'rejected'`
  - Sent to the sender to indicate whether the receiver accepted or rejected a join request.

- `ackFromHost` — payload: `ack` (boolean)
  - Forwarded as part of join acknowledgement flow.

- `bases` — payload: `(bases, userId)`
  - Forwarded during QKD base exchange.

- `qber` — payload: `subset` (the subset for QBER calculation)
  - Forwarded during QBER calculation step.

- `qberResult` — payload: `qber` (number)
  - Forwarded to receivers indicating QBER percentage.

- `message` — payload: `{ message, sender, containsFile, fileKey, profilePic }`
  - Forwarded encrypted/text messages or file metadata to room participants.

- `keyGenFailed` — payload: `message` (string)
  - Emitted when key generation fails (e.g., session disturbed during QKD).

- `sessionDisturbed` — payload: `message` (string)
  - Emitted when a participant leaves or session is otherwise disturbed.

- `sessionEnd` — no payload
  - Emitted to indicate session termination.

Server behavior notes:

- On disconnect the server cleans up user entries (MongoDB + Redis), emits `userLeft`, and may emit `requestFailed`, `keyGenFailed`, `sessionDisturbed` or re-index requests if an eavesdropper disconnected while waiting.
- API endpoints such as `POST /api/persistRequest`, `PATCH /api/eavesdrop/:roomId` and `PATCH /api/finishRequest` also trigger `io.emit` events (`requestForED`, `removeRequestForED`, `removeRequest`) that clients should handle.

## Troubleshooting

- Upload fails immediately: confirm the signed upload URL was returned and that it hasn't expired. The server signs uploads with a short expiry (80s).
- Download fails or CORS error: check the R2/CORS policy for your bucket and the signed URL validity.
- QKD errors / high QBER: real quantum hardware introduces noise; the sample app treats high QBER as session compromise and will abort.

## Contributing

If you change API shapes or socket event names update the frontend accordingly and document the change here. When adding features that affect privacy/security (key derivation, encryption algorithm, file handling), include a short security rationale in your PR.
