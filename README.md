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