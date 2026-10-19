# WhatsApp Clone — Backend

A real-time messaging backend built with TypeScript, Node.js, Express, MongoDB, and Socket.IO.

## Features

- JWT-based authentication with access tokens and refresh-token rotation
- User profile and contact management
- Conversation creation and participant authorization
- Persistent messaging with MongoDB
- Paginated message history
- Idempotent message sending
- Real-time messaging using Socket.IO
- Message delivery and read receipts
- Authenticated socket connections and conversation rooms

## Tech Stack

- TypeScript
- Node.js and Express
- MongoDB and Mongoose
- Socket.IO
- JWT and bcrypt

## Getting Started

### Prerequisites

- Node.js
- MongoDB Atlas account or a compatible MongoDB instance
- npm

### Installation

```bash
git clone https://github.com/khardiyasultan/whatsapp-clone-ts.git
cd whatsapp-clone-ts/backend
npm install
```

Create a `.env` file using `.env.example` as a template and configure your own environment variables. Never commit real secrets.

### Run in development

```bash
npm run dev
```

### Type-check and build

```bash
npm run typecheck
npm run build
```

### Run the production build

```bash
npm start
```

## Project Status

Backend implementation and Socket.IO tests are in progress toward a deployable release. Frontend integration and production deployment are not yet complete.

## Repository

https://github.com/khardiyasultan/whatsapp-clone-ts
