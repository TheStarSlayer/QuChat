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
  - `POST /api/requestChat/:username` — send a chat request to another user
  - `GET /api/awaitingChatRequests` — view ongoing chat requests
  - `POST /api/eavesdrop/:chatId` — eavesdrop private chat (1 eavesdropper allowed)
  - `POST /api/terminate/:chatId` — gracefully terminate a private chat session
- **Notes:** implement these under `backend/routes/` and map handlers to `backend/controllers/`. If using WebSockets, consider keeping chat message flows on the socket layer and using `/api` for control actions (request/terminate/metadata).
