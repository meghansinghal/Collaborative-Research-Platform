# Collaborative Research Platform

A real-time collaborative research workspace that helps teams **read, analyze, and discuss research papers together**. The platform combines shared research rooms with AI-powered paper analysis, contextual Q&A, and collaborative annotations.

## Features

- **Collaborative Research Rooms** — Create or join shared rooms using room codes.
- **Research Paper Management** — Upload and manage PDF research papers within rooms.
- **AI-Powered Analysis** — Generate paper summaries and ask questions using Google Gemini.
- **Collaborative Annotations** — Add research notes and insights to papers.
- **AI Research Mentor** — Get AI-generated feedback and suggestions on research annotations.
- **Real-Time Collaboration** — Synchronize papers and annotations across collaborators using Supabase Realtime.

## How It Works

```text
Create / Join Research Room
            ↓
      Upload Research Paper
            ↓
       Extract PDF Text
            ↓
    ┌───────┴────────┐
    ↓                ↓
AI Summary        Paper Q&A
    │                │
    └───────┬────────┘
            ↓
   Add Research Annotations
            ↓
     AI Research Feedback
            ↓
    Real-Time Collaboration

```

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- AI: Google Gemini API
- Database: PostgreSQL, Supabase
- Realtime: Supabase Realtime
- Document Processing: PDF.js
- Routing: React Router

## Data Model

The application is centered around three core entities:
1. rooms: Represents a shared collaborative research workspace.

2. papers: Stores research papers uploaded to a room, including their title, extracted text, and generated summary.

3. annotations: Stores collaborators' research notes, along with metadata such as contributor identity, color, position, timestamp, and AI-generated feedback.

The relationships between rooms, papers, and annotations allow research teams to organize papers and collaborate on their analysis in real time.
