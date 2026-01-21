# Ancestry Family Tree

> A modern, PWA-compatible web application for building evidence-based family trees with strong citations, mapping, and AI-ready architecture.

## Vision

A multi-tenant family history platform where every assertion is traceable to evidence. Built for private family use initially, architected for future public collaboration and AI-powered research assistance.

## Core Features

- **Tree Management**: Independent family repositories (multi-tenant).
- **People & Relationships**: Track individuals and typed connections (parent/child, spouse, etc.).
- **Evidence-Based Claims**: Every factual assertion (birth, residence, occupation) is a "Claim" linked to evidence.
- **First-Class Places**: Geographic entities with geocoding, reusable across the tree.
- **Source & Citation System**: Canonical references linking claims to specific evidence (documents, media, URLs).
- **Media Management**: Storage for photos, documents, and external video embeds.
- **PWA Ready**: Offline support, service workers, and installable on devices.

## Technology Stack

### Client (React PWA)
- **Framework**: React 18 (Vite)
- **State Management**: React Query + Convex hooks
- **Offline**: Service Workers + IndexedDB
- **UI**: Modern, responsive design

### Backend (Serverless)
- **Platform**: [Convex](https://convex.dev)
- **Database**: Real-time document database
- **Storage**: Convex File Storage
- **Search**: Vector search (embeddings) and full-text search

## Data Model Overview

The application is built around a robust schema enforcing data integrity and traceability:

- **Trees**: The root boundary for all data.
- **People**: The central nodes of the graph.
- **Relationships**: Edges connecting people.
- **Claims**: The atomic units of genealogical information.
- **Evidence/Citations**: The proof backing up claims.

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation

```bash
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
```

Fill in the values in `.env.local` with your Convex and Clerk credentials.

### Development

Start the frontend and backend development servers:

```bash
npm run dev:all
```

Run them separately if needed:

```bash
npm run dev
npm run dev:backend
```

### Quality Checks

```bash
npm run lint
npm run typecheck
```

### Testing

Automated tests are not set up yet. New features should include tests and add a
test runner script when the first suite is introduced.

## Project Structure

```
ancestry-family-tree/
├── src/              # React frontend application
├── convex/           # Backend functions and schema definition
├── public/           # Static assets
└── docs/             # Project documentation
```

## License

TBD
