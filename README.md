# 🏥 MASAS — Medicine Availability & Shortage Alert System

> **"Google Maps + Inventory Intelligence for Medicines"**

A production-oriented full-stack platform that helps users find medicines across nearby pharmacies in real-time and enables pharmacies to manage inventory efficiently.

---

## 🚨 Real-World Problem

Patients often struggle to find medicines:

* Visit **3–5 pharmacies** before finding availability
* Face **out-of-stock / expired medicines**
* Critical in:

  * Emergency situations
  * Chronic diseases (BP, Diabetes)
  * Rare medicines

👉 This is a **daily real-world problem**, not a theoretical one.

---

## 💡 Solution

MASAS provides a centralized platform that:

* 🔍 Shows **real-time medicine availability**
* 🏪 Connects users with **nearby pharmacies**
* 📦 Helps pharmacies **manage inventory**
* ⏳ Tracks **expiry and stock levels**

---

## 🧠 Key Features (MVP)

### 👤 User

* Search medicines by name
* View nearby pharmacies with availability
* Check stock status:

  * 🟢 Available
  * 🟡 Low
  * 🔴 Out of Stock

### 🏪 Pharmacy

* Manage inventory (CRUD)
* Update stock & expiry
* Track medicine availability

### ⚙️ System

* Authentication (User & Pharmacy)
* Real-time search system
* Expiry tracking logic
* Basic analytics (low stock detection)

---

## 🛠️ Tech Stack

| Layer        | Technology                  |
| ------------ | --------------------------- |
| Frontend     | React (Vite) + Tailwind CSS |
| Backend      | Node.js + Express           |
| Database     | MongoDB (Mongoose)          |
| Auth         | JWT                         |
| Architecture | MVC Pattern                 |

---

## 🏗️ System Design (Simplified)

* **Users** → search medicines
* **Pharmacies** → manage inventory
* **Inventory** → connects medicines & pharmacies

👉 Many-to-many relationship handled via Inventory collection

---

## 🔥 Core Feature

Search medicine by name + location:

```http
GET /search?medicine=paracetamol&location=city
```

Returns:

* Nearby pharmacies
* Availability status
* Stock insights

---

## 🚀 Future Enhancements (Major Version)

* 📊 Demand Prediction (ML-based)
* 🔔 Smart Alerts (Email / SMS)
* 💊 Substitute Recommendation (same salt)
* 📈 Analytics Dashboard (heatmaps, trends)
* 📍 Geo-based pharmacy discovery

---

## 📦 Project Structure

```
/backend
  /controllers
  /models
  /routes
  /services
  /middleware

/frontend
  /components
  /pages
```

---

## ⚡ Getting Started

### 1. Clone Repo

```bash
git clone https://github.com/your-username/masas-platform.git
```

### 2. Backend Setup

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 API Testing

Use Postman to test APIs:

* Auth APIs
* Medicine APIs
* Search API

---

## 🎯 Why This Project Stands Out

* Solves a **real healthcare problem**
* Designed with **scalability in mind**
* Clean architecture (MVC)
* Expandable to **AI + analytics system**
* Demonstrates **full-stack + system design skills**

---

## 👨‍💻 Author

Built by ANCHIT GUPTA

---

## ⭐ If you like this project

Give it a star ⭐ — it helps a lot!
