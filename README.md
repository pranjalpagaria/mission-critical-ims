# 🚨 Mission-Critical Incident Management System (IMS)

High-Throughput SRE Observability & Incident Lifecycle Platform

---

## 🚀 Overview

The Mission-Critical IMS is a **production-grade, high-throughput system** designed to ingest, process, and manage incident signals in real time.

It is engineered to handle **10,000+ signals per second**, ensuring:

- High availability
- System resiliency
- Real-time observability
- Structured incident lifecycle management

The platform demonstrates real-world **Site Reliability Engineering (SRE)** principles such as:

- Buffering
- Backpressure handling
- Polyglot persistence
- Workflow-driven incident resolution

---

## 📊 Assignment Requirement Checklist

- ✔ High-throughput ingestion (10k signals/sec)
- ✔ Dual-database architecture (PostgreSQL + MongoDB)
- ✔ Real-time observability dashboard
- ✔ Incident lifecycle management
- ✔ RCA capture & MTTR calculation
- ✔ System resiliency with Docker health checks
- ✔ Chaos testing using simulation engine

---

## 🏗️ System Architecture

The architecture is designed to **decouple high-volume ingestion from transactional processing**, ensuring stability under heavy load.

<img width="1623" height="969" alt="ChatGPT Image May 4, 2026, 02_01_51 PM" src="https://github.com/user-attachments/assets/03f055e7-72d5-44ef-ab00-a8258349d218" />

### 🔄 1. Signal Ingestion Layer

Handles incoming signals from:

- APIs  
- MCP Hosts  
- RDBMS  
- Caches  
- Queues  

✔ Supports burst traffic up to **10,000 signals/sec**

---

### ⚡ 2. Fastify Ingestion API (Producer)

- Built using **Node.js (Fastify)**
- Entry point for all signals

**Key Features:**

- Internal memory buffer  
- Buffer limit: **100,000 signals**  
- Integrated Redis (hot-path cache)

#### 🛑 Backpressure Handling
- If buffer is full → returns **HTTP 503**
- Prevents system overload

#### 🔁 Debouncing Logic
- Multiple signals within 10 sec → **only one work item created**

---

### ⚙️ 3. Consumer Worker

- Drains buffer every **1 second**
- Processes signals asynchronously
- Sends data to persistence layer

---

### 💾 4. Persistence Layer (The Sink)

#### 📦 MongoDB (Audit Lake)
- Stores raw signals
- High-speed bulk writes (`insertMany`)
- Maintains full audit history

#### 📊 In-Memory Aggregator
- Runs every **5 seconds**
- Tracks:
  - Throughput
  - Error rates
  - Top affected components

#### 🗄️ PostgreSQL (Source of Truth)
- Stores structured incident data
- Stores RCA (Root Cause Analysis)
- Ensures **ACID compliance**

---

### 🔁 5. Workflow Engine (State Machine)

#### 📌 Incident Lifecycle
Signal → API → Buffer (Redis) → Worker → Databases → Dashboard


- **API (Fastify/Node.js)** → Accepts incoming signals  
- **Redis Buffer** → Handles traffic spikes  
- **Worker** → Processes signals asynchronously  
- **MongoDB** → Stores raw logs (audit trail)  
- **PostgreSQL** → Stores structured incident data  
- **React Dashboard** → Displays real-time insights  

---

## 🛠️ Tech Stack

- **Backend:** Node.js (Fastify / Express)  
- **Frontend:** React, Tailwind CSS, Recharts  
- **Databases:** PostgreSQL, MongoDB  
- **Cache:** Redis  
- **DevOps:** Docker, Docker Compose  

---

## ⚡ Getting Started

### ▶️ Run the Application

docker-compose up --build
⏳ Wait ~60–90 seconds for all services to become healthy.

## 🌐 Access Services
Frontend → http://localhost:5173

## 🧪 Testing (Generate Data)
node stress.js

## This will:

### Generate synthetic incidents
### Populate databases
### Display data in dashboard

## ✨ Key Features
### ✔ High-throughput ingestion (10k signals/sec)
### ✔ Redis-based buffering & backpressure handling
### ✔ Dual database architecture (MongoDB + PostgreSQL)
### ✔ Real-time observability dashboard
### ✔ Incident lifecycle management (state machine)
### ✔ RCA enforcement & MTTR tracking

## ⚠️ Known Behavior
### Dashboard shows data only after running the test script
### System is event-driven (no preloaded data)
