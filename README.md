# QuChat

QuChat is a private chat application demonstrating an session-based chat, utilizing a trusted server key distributor using a BB84-inspired quantum key distribution (QKD) service for key generation and WebCrypto (AES-GCM) for message/file encryption.

The project contains three primary components:

- `frontend/` — React + Vite single-page application (login, user list, requests, chat UI).
- `backend/` — Express API and Socket.IO server (authentication, request persistence, socket events, signed upload/download links).
- `quantum_computer/` — FastAPI microservice used for RNG/QKD operations (Qiskit-based simulator / IBM runtime integration).

This README documents how the pieces fit together, required environment variables, developer run commands, and important implementation notes (file uploads, encryption, and QKD flow).

## Ports (development)

- Frontend (Vite dev server): <http://localhost:8595>
- Backend + Socket.io (Express HTTP API): <http://localhost:8596>
- Quantum / QKD service (FastAPI / Uvicorn): <http://localhost:8598>

These ports are the defaults used in the code and CORS configuration. If you change ports, update the corresponding env variables (`FRONTEND_ADDR`, `SERVER_ADDR`, `IO_ADDR`) used by the services.

## Domains (production)

- Frontend + Backend + Socket.io: <https://quchat-iu40.onrender.com>
- Quantum / QKD Service: <https://quantum-service-abgj.onrender.com>

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
uvicorn main:app --host "localhost" --port "8598"
```

Adjust commands as needed for your environment.

## Required environment variables

Backend (`backend/.env` or system env):

- `MONGODB_CONN` — MongoDB connection string.
- `REDIS_PASSWORD` — Redis password (if your Redis instance uses one).
- `QC_ADDR` — <https://quantum-service-abgj.onrender.com>
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
- `SERVER_ADDR` — origins for CORS (<https://quchat-iu40.onrender.com>)
- `PROD` — Decides origins for CORS

Note: many examples in the code expect these environment variables; inspect `backend/index.js`, `quantum_computer/main.py`, and `frontend/src/lib/api.js` for exact usage.

## API Endpoints (detailed)

### Auth Endpoints

- **POST /auth/signup**
  - Description: Create a new user account.
  - Request body: `{ "username": string, "password": string }`.
  - Responses: `201` on success; `400` if username exists or user already logged in; `500` on server error.
  - Implementation: `signupController` in [backend/controllers/auth.controller.js](backend/controllers/auth.controller.js). Route: [backend/routes/auth.route.js](backend/routes/auth.route.js).

- **POST /auth/login**
  - Description: Authenticate user credentials and start a session.
  - Request body: `{ "username": string, "password": string }`.
  - Behavior: Prevents concurrent logins, returns a short-lived `accessToken` in the JSON response and sets an `httpOnly` `refreshToken` cookie (cookie options configured in `auth.controller.js`).
  - Responses: `200` with `{ accessToken }` and cookie on success; `400` for invalid credentials; `409` if the user is already logged in; `500` on server error.
  - Implementation: `loginController` in [backend/controllers/auth.controller.js](backend/controllers/auth.controller.js). Route: [backend/routes/auth.route.js](backend/routes/auth.route.js).

- **POST /auth/refresh**
  - Description: Rotate refresh token (sent via `refreshToken` cookie) and return a new `accessToken`.
  - Behavior: Verifies cookie, rotates both access and refresh tokens, updates stored hash for the refresh token in the database and sets a new cookie.
  - Responses: `200` with `{ accessToken }` on success; `401`/`400` on token problems; `500` on server error.
  - Implementation: `refreshController` in [backend/controllers/auth.controller.js](backend/controllers/auth.controller.js). Route: [backend/routes/auth.route.js](backend/routes/auth.route.js).

- **POST /auth/logout**
  - Description: Clear the `refreshToken` cookie and remove the stored refresh token for the user.
  - Responses: `200` on success; `400` if no refresh cookie present; `500` on server error.
  - Implementation: `logoutController` in [backend/controllers/auth.controller.js](backend/controllers/auth.controller.js). Route: [backend/routes/auth.route.js](backend/routes/auth.route.js).

---

### Protected Application API

All routes under `/api` require an `Authorization: Bearer <accessToken>` header. The token verification middleware is `apiVerify` in [backend/middleware/api.middleware.js](backend/middleware/api.middleware.js).

- **GET /api/verify**
  - Description: Verify access token and return the authenticated `userId`.
  - Responses: `200` with `{ userId }`.
  - Implementation: `verifyAccessTokenController` in [backend/controllers/actions.api.controller.js](backend/controllers/actions.api.controller.js).

- **GET /api/getOnlineUsers**
  - Description: Return the list of currently-available users (excludes the caller).
  - Responses: `200` with `{ onlineUsers }`; `500` on server error.
  - Implementation: `getOnlineUsersController` in [backend/controllers/actions.api.controller.js](backend/controllers/actions.api.controller.js).

- **PATCH /api/setToBusy**
  - Description: Mark the caller as busy, remove from online index and broadcast `userLeft` via Socket.IO.
  - Responses: `200` on success; `500` on server error.
  - Implementation: `setToBusyController` in [backend/controllers/actions.api.controller.js](backend/controllers/actions.api.controller.js).

- **PATCH /api/setToAvailable**
  - Description: Mark the caller available, add to online index and broadcast `newUser` (includes a generated avatar URL).
  - Responses: `200` on success; `500` on server error.
  - Implementation: `setToAvailableController` in [backend/controllers/actions.api.controller.js](backend/controllers/actions.api.controller.js).

---

### Request / Eavesdrop Flow

These endpoints implement the request lifecycle used by the chat UI and the eavesdrop discovery flow.

- **POST /api/persistRequest**
  - Description: Sender creates a pending request to join another user.
  - Request body: `{ receiverId, timeLimitInMs, typeOfEncryption, chatSessionTimeInMin, isSimulator }` (sender is inferred from the access token).
  - Behavior: Verifies receiver availability, prevents duplicate requests, persists the request in MongoDB, indexes/cache entries in Redis, and emits the `requestForED` Socket.IO event for eavesdroppers.
  - Responses: `200` with `{ msg, newRequestPublic }` on success; `404` if receiver unavailable; `409` for duplicate request; `500` on server error.
  - Implementation: `persistRequestController` in [backend/controllers/request.api.controller.js](backend/controllers/request.api.controller.js).

- **GET /api/getMyActiveRequests**
  - Description: Return pending requests addressed to the caller (the receiver).
  - Responses: `200` with an array of request summaries; `500` on server error.
  - Implementation: `getMyActiveRequestsController` in [backend/controllers/request.api.controller.js](backend/controllers/request.api.controller.js).

- **GET /api/getEavesdroppableRequests**
  - Description: Return pending requests that other users can eavesdrop on (excludes requests involving the caller).
  - Responses: `200` with an array of request summaries; `500` on server error.
  - Implementation: `eavesdroppableRequestsController` in [backend/controllers/request.api.controller.js](backend/controllers/request.api.controller.js).

- **PATCH /api/eavesdrop/:roomId**
  - Description: Claim a pending request as an eavesdropper (`:roomId` is the sender id of the request).
  - Behavior: Atomically mark the request as eavesdropped, update Redis indices, and emit `removeRequestForED` to update UIs.
  - Responses: `200` on success; `404` if cannot eavesdrop; `500` on server error.
  - Implementation: `eavesdropController` in [backend/controllers/request.api.controller.js](backend/controllers/request.api.controller.js).

- **PATCH /api/finishRequest**
  - Description: Finalize or cancel a pending request. Body: `{ finishStatus }` (e.g., `accepted`, `cancelled`, etc.).
  - Behavior: Updates DB status, clears Redis indices, and emits `removeRequest` via Socket.IO.
  - Responses: `204` on success; `500` on error.
  - Implementation: `finishRequestController` in [backend/controllers/request.api.controller.js](backend/controllers/request.api.controller.js) which uses `lib/finishRequest.js`.

---

### File operations (signed links)

File upload/download endpoints return pre-signed URLs so the browser can PUT/GET directly to an S3-compatible R2 bucket. Signing and deletion helpers live in [backend/lib/R2Actions.js](backend/lib/R2Actions.js).

- **GET /api/getUploadLink?bucketName=&key=&fileType=**
  - Description: Returns a pre-signed `PUT` URL for client-side uploads. Server signs uploads with an 80-second expiry.
  - Query params: `bucketName`, `key`, `fileType` (mime type).
  - Responses: `200` with `{ uploadLink }`; `500` on server error.
  - Implementation: `getUploadLinkController` in [backend/controllers/file.api.controller.js](backend/controllers/file.api.controller.js).

- **GET /api/getDownloadLink?bucketName=&key=&expiresInMin=**
  - Description: Returns a pre-signed `GET` URL valid for the specified number of minutes.
  - Query params: `bucketName`, `key`, `expiresInMin`.
  - Responses: `200` with `{ downloadLink }`; `500` on server error.
  - Implementation: `getDownloadLinkController` in [backend/controllers/file.api.controller.js](backend/controllers/file.api.controller.js).

- **DELETE /api/deleteObjects**
  - Description: Delete one or more objects from a bucket.
  - Request body: `{ bucketName, keys }`.
  - Responses: `204` on success; `500` on server error.
  - Implementation: `deleteObjectsController` in [backend/controllers/file.api.controller.js](backend/controllers/file.api.controller.js).

The frontend requests an upload link and then PUTs the (optionally encrypted) file bytes directly to R2 — no proxy through the backend.

---

### Quantum / QKD Service (FastAPI)

The Quantum service runs under `quantum_computer/main.py` and exposes RNG and BB84-style key distribution endpoints used during secure session setup. See [quantum_computer/main.py](quantum_computer/main.py).

- **GET /rng/{typeOfMachine}**
  - Params: `typeOfMachine` = `sim` or `hw`. Query: `bit_length` (default 156), `no_of_shots` (default 1).
  - Description: Return quantum measurement bitstrings (used as randomness).

- **GET /getRandomIndices/{typeOfMachine}?keyLength=**
  - Description: Return a set of random indices (used for QKD subset selection). This endpoint is protected by the service middleware.
  - Responses: `200` with `{ randIndices: [...] }`; `400` if `keyLength >= 512`.

- **GET /distributeRawKey/{roomId}**
  - Description: Orchestrates raw key distribution for a given chat room. The endpoint is protected (expects a `Authorization: Bearer <token>` header checked against `ACCESS_TOKEN_SECRET`).
  - Behavior: If caller is the sender, generate and persist sender metadata (bases/bits) and return them. If caller is the receiver or an eavesdropper, retrieve metadata, generate receiver bases, run the BB84 circuit and return observed bits. Handles concurrency and may return `425` for "call again later" while metadata is generating.

- **GET /generateAndRunBB84Circuit**
  - Description: Run a BB84-style circuit with provided `sender_bits`, `sender_bases`, `receiver_bases` and return observed bits. Used internally and also callable directly.

- **DELETE /deleteMetadata/{roomId}**
  - Description: Delete stored circuit metadata for a room. Protected by service middleware.

Notes: Authentication middleware in `main.py` only enforces a bearer token for specific endpoints (e.g., `distributeRawKey`, `deleteMetadata`, `getRandomIndices`). Review `quantum_computer/main.py` for exact behavior.

---

### Socket.IO events (summary)

Real-time signaling and QKD coordination use Socket.IO. The socket initialization is in [backend/io.index.js](backend/io.index.js) and event handlers live in [backend/lib/socketEventLib.js](backend/lib/socketEventLib.js).

Client -> Server (examples): `sendJoinRequest`, `eavesdropRequest`, `accept`, `shareBases`, `calculateQBER`, `shareQBERResult`, `sendMessage`, `leave`, `sessionEnd`, etc.

Server -> Client (examples): `newUser`, `userLeft`, `requestForED`, `removeRequestForED`, `removeRequest`, `requestToJoin`, `bases`, `qber`, `qberResult`, `message`, `keyGenFailed`, `sessionDisturbed`, `sessionEnd`.

Socket handshake: pass the access token in the auth handshake, e.g. `io('http://localhost:8597', { auth: { token } })`.

For implementation details and the full list of events, see [backend/io.index.js](backend/io.index.js) and [backend/lib/socketEventLib.js](backend/lib/socketEventLib.js).

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
io({ auth: { token } })
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
