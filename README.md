# QuChat

Private chat application that combines WebSockets and a BB84-inspired quantum key distribution (QKD) service.

This repository contains three main parts:

- `frontend/` — React + Vite single-page app (login, user list, requests, chat UI)
- `backend/` — Express API and Socket.IO server (authentication, request persistence, socket events)
- `quantum_computer/` — FastAPI service used for RNG/QKD operations (calls Qiskit or simulator)

## Ports (development)

- Frontend (Vite dev server): `http://localhost:8595`
- Backend (Express HTTP API): `http://localhost:8596`
- Socket.IO server (separate IO port): `http://localhost:8597`
- Quantum / QKD service (FastAPI / Uvicorn): `http://localhost:8598`

## Architecture overview

- Frontend: React SPA handles auth, shows online users, pending requests, and chat area. It stores the short-lived access token in `localStorage.accessToken` and relies on the browser cookie for the refresh token (httpOnly cookie on `/auth`).
- Backend: Express provides `/auth` and `/api` REST endpoints and spins up a Socket.IO server for real-time request flow and messaging. Redis stores online indices for fast lookups; MongoDB persists requests and user metadata.
- Quantum service: provides RNG and QKD support endpoints used during key distribution.

## API (HTTP)

Auth routes (backend `backend/routes/auth.route.js`):

- `POST /auth/signup` — register (returns 201 on success)
- `POST /auth/login` — login; returns `accessToken` (short-lived). The backend sets a `refreshToken` httpOnly cookie.
- `POST /auth/refresh` — exchange refresh cookie for a new access token
- `POST /auth/logout` — clear refresh cookie, logout user

Application routes (`backend/routes/api.route.js`):

- `GET /api/verify` — simple token verify endpoint
- `GET /api/getOnlineUsers` — returns list of online users (excluding caller)
- `PATCH /api/setToBusy` — mark current user busy (not available)
- `PATCH /api/setToAvailable` — mark current user available
- `POST /api/persistRequest` — create a chat request (sender -> receiver)
- `GET /api/getMyActiveRequests` — requests where the current user is receiver
- `GET /api/getEavesdroppableRequests` — get public requests available for eavesdroppers
- `PATCH /api/eavesdrop/:roomId` — claim eavesdropper spot on a request
- `PATCH /api/finishRequest` — finish/cancel a pending request

All `/api` routes require `Authorization: Bearer <accessToken>` header; the `api.middleware` enforces token verification.

## WebSocket (Socket.IO) events

Client -> Server (emit):

- `sendJoinRequest` — (receiverId, request) send a join request to a user
- `eavesdropRequest` — (roomId) join as eavesdropper
- `accept` — (roomId) accept incoming request
- `reject` — (roomId) reject incoming request
- `joinAck` — (roomId, ack) acknowledge joining the session
- `shareBases`, `calculateQBER`, `shareQBERResult` — QKD coordination events
- `sendMessage` — (roomId, encryptedMessage) send encrypted chat message
- `leave` — (roomId) leave a room
- `resetSocketStats` — clear socket state
- `sessionEnd` — (roomId) end session

Server -> Client (on):

- `newUser` — broadcast when a new user connects
- `userLeft` — broadcast when a user disconnects or goes offline
- `requestForED` — broadcasted for eavesdroppable requests
- `removeRequestForED` / `removeRequest` — notify removal of requests
- `requestToJoin` — sent to the intended receiver when someone requests to join
- `response` — sent to sender to indicate `accepted` or `rejected`
- `bases`, `qber`, `qberResult`, `ackFromHost` — QKD coordination
- `message` — encrypted message from other participant(s)
- `requestFailed` — failure for a request (target went offline / unavailable)
- `sessionDisturbed` — a participant dropped; clients should clean up

Clients must attach the access token in the socket handshake: `io('http://localhost:8597', { auth: { token } })` so the backend `ioAuth` middleware can validate and populate `socket.userId`.

## Redis keys (short)

- `onlineUsers` (sorted set) — online usernames (score = loggedAt)
- `allRequestIndex`, `EDRequestIndex` (sorted sets) — indices for active requests
- `requester:{senderId}` (set) — request details stored per sender
- `requestee:{receiverId}` (sorted set) — who has requested this receiver

## Quantum / QKD service endpoints

The quantum service exposes:

- `GET /rng/{typeOfMachine}` — generate random bitstrings using a simulator or hardware
- `GET /distributeRawKey/{roomId}` — used during the key generation/distribution flow between sender/receiver/eavesdropper
- `GET /generateAndRunBB84Circuit` — helper used by the service to run BB84 circuits
- `DELETE /deleteMetadata/{roomId}` — clear metadata after a session finishes

The QC service uses JWT in `Authorization: Bearer <accessToken>` for the routes that affect request data (see `quantum_computer/main.py` middleware). Keep the `ACCESS_TOKEN_SECRET` in sync between backend and QC service if you want shared verification.

## Development notes

- Use the recommended ports above during local development to match the backend's CORS configuration.
- The backend sets the `refreshToken` cookie at path `/auth` and `httpOnly` — refreshes are handled by `POST /auth/refresh`.
- The app prevents multiple simultaneous sessions for the same username — attempting to connect while a session exists will produce a `connect_error`. Handle this event in the frontend.

## Contributing

Contributions are welcome. If you change API routes or socket event names, update this README and the frontend accordingly.
