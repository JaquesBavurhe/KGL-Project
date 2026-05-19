# KARIBU GROCERIES MANAGEMENT SYSTEM (KGMS)

## Project Overview
Karibu Groceries LTD (KGL) is a wholesale produce distributor dealing in cereals, with two branches located in different areas. Previously, all business operations were recorded manually in ruled black books. This project aims to design and implement a **software-based solution** to automate and streamline KGL’s operations.

The system manages produce procurement, sales (cash and credit), stock control, and reporting while enforcing business rules and user roles.

---

## Problem Statement
Manual record keeping at Karibu Groceries LTD has led to inefficiencies, poor data tracking, and difficulty in generating accurate reports. There is a need for a centralized digital system to manage procurement, sales, stock levels, and reporting across branches.

---

## Objectives
- To digitize produce procurement and sales records  
- To manage stock levels automatically  
- To separate roles and permissions for users  
- To track credit sales and outstanding payments  
- To generate summary reports for management  

---

## Scope of the System
The system supports:
- Produce procurement by the manager  
- Produce sales by sales agents  
- Credit sales tracking for trusted buyers  
- Automatic stock updates  
- Aggregated sales reports for the director  

---

## Produce Handled
- Beans  
- Grain Maize  
- Cow Peas  
- Ground Nuts  
- Soybeans  

---

## User Roles and Responsibilities

### 1. Manager
- Records all procured produce  
- Sets and updates selling prices  
- Can record produce sales  
- Monitors stock levels  

### 2. Sales Agent
- Records sales at their assigned branch  
- Records credit sales for trusted buyers  
- Cannot record produce procurement  

### 3. Director (Mr. Orban)
- Views aggregated sales data from all branches  
- Cannot edit or record transactions  

---

## System Features

### Produce Procurement
Records include:
- Produce name and type  
- Date and time  
- Tonnage (kg)  
- Cost (UGX)  
- Dealer details and contacts  
- Branch to be stocked  
- Selling price  

### Produce Sales
- Cash sales recording  
- Automatic stock reduction  
- Sale date and time  
- Buyer and sales agent details  

### Credit Sales (Deferred Payment)
- Buyer identification (including NIN)  
- Location and contact details  
- Amount due  
- Due date  
- Produce details and dispatch date  

### Stock Management
- Only available stock can be sold  
- Stock reduces after every sale  
- Manager is notified when stock runs out  

### Reporting
- Branch-level sales reports  
- Aggregated sales totals for the director  

---

## Business Rules
- Only products in stock can be sold  
- Prices are set by the manager and pre-populated  
- Sales agents cannot record produce procurement  
- Stock quantity reduces automatically after sales  
- Only the director can view system-wide sales totals  

---

## Technologies Used
- **Frontend:** HTML, CSS, JavaScript  
- **Backend:** Node.js, Express.js  
- **Database:** MongoDB  
- **Other Tools:** Bootstrap (UI), Git  

---

## System Architecture
- MVC (Model–View–Controller) architecture  
- RESTful API for backend operations  
- MongoDB for data persistence  

---

## Installation and Setup

1. Clone the repository  
   ```bash
   git clone https://github.com/your-username/karibu-groceries-system.git
