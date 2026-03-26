# QR Pay Backend

Fastify + Prisma + TypeScript backend for QR Pay.

## Features
- User Authentication (JWT)
- Merchant Management
- Beneficiary Management
- Virtual Card Management
- Offline Transaction Synchronization (State Channels)
- PDF Receipt Generation

## Setup
1. Clone the repository.
2. Run `npm install`.
3. Configure `.env` based on `.env.example`.
4. Run `npx prisma migrate dev` to setup the database.
5. Run `npm run dev` to start the development server.

## Deployment
This backend is designed to be deployed as a Docker container.
