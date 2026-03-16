# QuChat

A chat application that prioritizes privacy and end-to-end encryption using BB84 Quantum Key Distribution Protocol

## Functional Requirements

- **Authentication** - User login and registration
- **Authorization w/ Routing** - Role-based access control and protected routes
- **View available users** - Display list of online/available users for chatting
- **Request for private chat and subsequent acceptance/rejection** - Send chat requests and manage acceptance/rejection responses
- **Eavesdropping private chat request** - Monitor private chats (only 1 eavesdropper allowed per chat)
- **Quantum magic** - Implement BB84 QKD with and without eavesdropper detection
- **Message sending** - Encryption, Web sockets, and Multi-media support
- **Graceful shutdown of private chat session** - Clean termination of chat sessions

## Dev Notes

### Authentication Flow

1. **User Input** - User fills in username and password
2. **Server Validation** - Server authenticates the credentials
3. **Token Generation** - Server returns access token (short-lived) and refresh token (long-lived)
4. **WebSocket Connection** - Server and client initialize a WebSocket connection
5. **Cache Session** - Cache the WebSocket ID in Redis for quick retrieval

### View Available Users and WebSockets

- **Include auth.token in client initiation of websocket:** Client must send the authentication token in `socket.handshake.auth.token` when establishing the WebSocket connection.
- **This app prevents user to open multiple sessions for the same user:** The application checks for existing user sessions in Redis to prevent duplicate connections for the same user.
- **Error thrown when new session for same user is created should be handled by client (connect_error):** If a new session is attempted for an already connected user, an error is thrown; the client should listen for the `connect_error` event to handle this appropriately.

### Redis Data Structures

- **`onlineUsers`** - Set - value(s): `userId`
- **`allRequestIndex`** - Sorted Set - value: `senderId`; score: created time (for all requests)
- **`EDRequestIndex`** - Sorted Set - value: `senderId`; score: created time (for eavesdroppable requests)
- **`requester:{senderId}`** - Hash Set - value: `sender`, `receiver`, `roomId`, `createdOn`, `timeLimitInSec`
- **`requestee:{receiverId}`** - Sorted Set - value: `senderId`; score: created time (for requests sent to the user)

### Chat Request Handling

- **Real-time Communication:** Chat requests are sent, acknowledged, and rejected primarily via WebSockets to ensure real-time updates.
- **Persistence & Lifecycle:** Requests are persisted in the database upon creation and are deleted after they are acknowledged, rejected, or when they time out.
- **Request Payload:** A chat request must contain:
  - `receiverId`: The intended recipient.
  - `timeSent`: The timestamp when the request was initiated.
  - `validWindow`: The duration for which the request remains valid before timing out.
- **Message Queue Display:** Incoming requests are displayed in the UI's message queue, sorted by their arrival time. *(Implementation: The event emitted for an incoming request should add a callback to a queue/array, which is then executed based on the user's accept or reject action).*
- **Acceptance Flow & Concurrency:** 
  - Before accepting a request, the frontend must verify if the request is still valid (within its `validWindow`).
  - If valid and accepted, the system must automatically reject all other pending requests for that user.
  - Upon acceptance, the user's status must update so they are not available for other requests. *(Implementation: This can be managed by adding a new field like status/isBusy in the `onlineUsers` collection/hashset).*

### Routes

#### /auth

- **Purpose:** authentication endpoints (signup, login, logout, refresh)
- **Routes:**
  - `POST /auth/signup` — create a new user account
  - `POST /auth/login` — authenticate and return access + refresh tokens
  - `POST /auth/logout` — invalidate session / tokens
  - `POST /auth/refresh` — exchange refresh token for a new access token
- **Related files:** [backend/routes/auth.route.js](backend/routes/auth.route.js), [backend/controllers/auth.controller.js](backend/controllers/auth.controller.js)

#### /api

- **Purpose:** application-level actions for discovering users and managing chat sessions
- **Routes (current):**
  - `GET /api/verify` — verify entry to homepage
  - `GET /api/getOnlineUsers` — get list of online users
  - `PATCH /api/setToBusy` — set user status to busy
  - `PATCH /api/setToAvailable` — set user status to available
  - `POST /api/persistRequest` — persist chat request to another user in database
  - `GET /api/getRequestsToMe` — get list of requests sent to the user
  - `GET /api/getEavesdroppableRequests` — get requests that can be eavesdropped on
  - `PATCH /api/eavesdrop/:roomId` — eavesdrop private chat (1 eavesdropper allowed)
  - `DELETE /api/finishRequest` — finish request and remove from database
  - `POST /api/generateKey` — generate a new key for the chat session (Make call to QKD API) (TODO)
  - `POST /api/terminate/:roomId` — gracefully terminate a private chat session
- **Notes:** implement these under `backend/routes/` and map handlers to `backend/controllers/`. If using WebSockets, consider keeping chat message flows on the socket layer and using `/api` for control actions (request/terminate/metadata).

### Socket Events

#### Client-Side Emissions (Handled by Server)

- **`sendJoinRequest`**: Initiates a chat request to another user. Server validates receiver's availability before forwarding.
- **`eavesdropRequest`**: Requests to join an existing chat room as an eavesdropper.
- **`accept`**: Emitted by a user to accept an incoming chat request.
- **`reject`**: Emitted by a user to reject an incoming chat request.
- **`joinAck`**: Acknowledges joining a chat session room.
- **`sendMessage`**: Sends an encrypted message to the users in the specified chat room.
- **`leave`**: Leaves the specified chat room, clearing the session data.
- **`disconnect`**: Automatically sent when the client disconnects. Triggers server-side session cleanup, stops active requests, and notifies other relevant users.

#### Server-Side Emissions (Handled by Client)

- **`newUser`**: Broadcasted to all clients when a new user connects and comes online.
- **`userLeft`**: Broadcasted to all clients when a user goes offline or disconnects.
- **`requestFailed`**: Sent to a specific client when their request (join, eavesdrop, accept, etc.) fails because the target user is unavailable or disconnected.
- **`requestToJoin`**: Sent to the receiver of a chat request, containing the request details.
- **`requestForED`**: Broadcasted to all clients when a new chat request is created, making it available for potential eavesdroppers.
- **`removeRequestForED`**: Broadcasted to all clients when a chat request is no longer available for eavesdropping.
- **`response`**: Sent to the sender of a chat request indicating if the request was `"accepted"` or `"rejected"`.
- **`ack`**: Sent to coordinate state and successfully acknowledge that the user has joined the room.
- **`message`**: Delivers an encrypted message to users in a chat room.
- **`sessionDisturbed`**: Emitted to participants of an active chat room if a member unexpectedly disconnects, prompting a clear-out on the client.
