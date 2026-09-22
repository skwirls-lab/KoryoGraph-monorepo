# **Product Requirements Document (PRD): The KoryoGraph Suite**

**Status:** Draft | **Date:** May 15, 2026 | **Lead Strategist:** SVL / John Crowley

## **1\. Executive Summary & Problem Statement**

**The Pitch:** KoryoGraph is an AI-native, modular SaaS platform designed to be the ultimate "Virtual Staff Member" for martial arts studios. Moving beyond the "digital filing cabinet" model of legacy software, KoryoGraph utilizes agentic workflows, biomechanical video analysis, and predictive analytics to actively manage class execution, drive student retention, and eliminate administrative burnout.

**The Problem:** The current martial arts software market (Spark, Zen Planner, Kicksite) is plagued by domain-specific logic gaps. They suffer from "Multi-Program Interference" (inability to cleanly separate progression tracks for multi-discipline schools), rely on static "Time in Rank" rather than true skill competency, and gate critical retention features behind exorbitant pricing tiers.

**The Solution:** A unified database powering three specialized front-end modules, supercharged by LLM and Vision APIs to automate both mat-side data entry and back-office operations.

## **2\. Brand Architecture & Naming Conventions**

* **Flagship Brand:** KoryoGraph (koryograph.ai)  
* **Module 1: KoryoGraph** (app.koryograph.ai) \- The mat-side engine for instructors.  
* **Module 2: KoryoGraph | Desk** (desk.koryograph.ai) \- The back-office admin brain.  
* **Module 3: KoryoGraph | Home** (home.koryograph.ai) \- The parent/student companion portal.

## **3\. User Personas**

* **The Owner/Admin (Alex):** Focuses on churn prediction, payroll, automated lead gen, and revenue growth.  
* **The Instructor:** Needs frictionless mat-side tools, automated class planning, and hands-free attendance/skill logging.  
* **The Parent:** Desires transparency, tangible proof of ROI, "parent-speak" curriculum translations, and easy billing.  
* **The Student (Teen/Adult):** Wants at-home training resources, highlight reels, and a clear visualization of their progression.

## **4\. Feature Matrix (The Multi-Agent Ecosystem)**

To ensure operational stability, every module contains strict manual "Core Operations" alongside its "AI-Native Enhancements." The system must function flawlessly even if AI endpoints are temporarily disabled.

### **A. KoryoGraph (Mat-Side Engine)**

**Core Operational Features:**

* **Manual Roster & Attendance:** A tablet-optimized UI for instructors to manually tap-to-check-in students from the daily roster.  
* **Manual Skill & Belt Logging:** Interface to physically select a student and check off curriculum requirements or process a belt promotion.  
* **Class Schedule View:** Daily and weekly calendar views of assigned classes.  
* **Student Quick-Profile:** Immediate access to emergency contacts, injuries/allergies, and progression history.  
* **Choreography Timeline Tool:** Demonstration team planning that syncs audio files with spatial formation notes.  
* **Manual Curriculum Builder & Viewer:** Instructor can use the AI built lessons or build their own plans to follow for classes.

**AI-Native Enhancements:**

* **Continuous Class Transcription (Post-Class Action Board):** Instructors wear a BT lapel mic. The app records the class, and the AI extracts roll-call and verbal corrections to build a post-class summary for 1-click approval.  
* **AI Curriculum & Progression Builder:** Instructors prompt the AI (e.g., "Build a 12-week sparring curriculum") and the system generates daily lesson plans mapped to specific belt requirements.

### **B. KoryoGraph | Desk (Back-Office Brain)**

**Core Operational Features:**

* **Member CRM & Family Linking:** Master database view to manage student profiles, digital waivers, and group multiple students under a single Parent billing entity.  
* **Billing, Invoicing & POS (Point of Sale):** Manual payment processing, auto-pay configuration, refund issuance, and physical retail checkouts. Integrates directly with physical **Stripe Terminal** hardware at the front desk for walk-in gear/apparel sales.  
* **Inventory & Supplier Management:** Digital ledger tracking real-time stock levels of retail items (uniforms, gear, weapons), low-stock alerts, product variations (size/color), and supplier cost-basis.  
* **Event & Camp Management:** Dedicated logic for After-School programs and Summer Camps (e.g., weekly billing cycles, specific liability waivers, daily check-in/out registers).  
* **Belt Testing Logistics:** Automated aggregation of eligible students, testing fee collection, certificate generation, and formatted CSV exports for official global registries (e.g., Kukkiwon Digital ID platform).  
* **Staff & Role Management:** UI to invite staff, create Custom Tenant-Level Roles, and assign granular permissions.  
* **Marketing & Pipeline CRM:** Drag-and-drop Kanban board for lead tracking (Trial Booked \-\> Signed Up) and manual SMS/Email broadcast tool.

**AI-Native Enhancements:**

* **Magic Inventory Receiver:** Utilize computer vision to process supplier packing slips. Admins snap a photo of an incoming invoice, and the AI automatically extracts SKUs, quantities, and sizes to draft an inventory update for 1-click approval.  
* **Generative AI Dashboards:** Admins prompt the system to generate dynamic data visualizations (e.g., "Show me revenue vs. churn risk").  
* **Desk AI Assistant (Internal Copilot):** A conversational RAG chatbot that can query student profiles or summarize financial health.  
* **The "Drift" Detector:** Predictive analytics identifying churn risks and drafting SMS re-engagement prompts (requires strict Admin approval).  
* **Empathetic Billing Recovery:** Conversational AI agents that handle failed payments via SMS with grace periods and secure update links.  
* **Frictionless Sales:** Auto-generated SMS URLs for trials and gear.

### **C. KoryoGraph | Home (Member Companion)**

**Core Operational Features:**

* **Visual Progression Tracker:** Dashboard showing current rank, earned stripes, and a progress bar to the next belt test.  
* **Digital Wallet & Payments:** Portal for parents to manually update credit cards on file, pay one-off invoices (e.g., tournament fees), and view billing history.  
* **Family Switcher UI:** Dropdown allowing a parent to seamlessly toggle the app context between multiple enrolled children.  
* **Class Booking & Event RSVP:** View upcoming classes, book private lessons, register for Summer Camps, or RSVP/pay for Belt Testing ceremonies.  
* **Direct Messaging:** Secure channel to message the front desk or specific instructors.

**AI-Native Enhancements:**

* **Vision Master (Biomechanical Analysis):** Uses "Gold Standard Matching." Students upload practice videos; the Vision API compares them to the Master Instructor's baseline video and returns actionable fixes.  
* **Home AI Assistant (Dojang Bot):** A Q\&A chatbot trained strictly on the studio's schedule, curriculum, and policies to answer parent/student questions 24/7.  
* **Curriculum Translator:** Converts technical mat-data into encouraging, easy-to-understand progress updates for parents.

## **5\. MVP Scope (Phase 1\) vs. Roadmap**

**Phase 1: The MVP (Instructor & Admin Value)**

* **Goal:** Prove mat-side value and cure administrative pain.  
* **Included:** Core Database Schema (Multi-Track Engine), KoryoGraph app (attendance, curriculum builder), KoryoGraph | Desk (Generative Dashboards, flat-rate billing, POS integration, Inventory Tracking).

**Phase 2: The Core Growth Engine**

* **Included:** Event/Camp Management, Belt Testing Logistics, The "Drift Detector", Continuous Class Transcription, Desk/Home Chatbots, Magic Inventory Receiver.

**Phase 3: The Member Experience**

* **Included:** KoryoGraph | Home full rollout, Vision Master, Frictionless AI checkouts.

## **6\. Technical Architecture**

* **Development Strategy:** Scaffolded via Gabby (GB10) and Windsurf.  
* **Frontend Stack:** Monorepo architecture (e.g., Turborepo) housing three distinct Next.js applications deployed via Vercel.  
* **Backend & Auth Platform:** Supabase (PostgreSQL) for relational data, vector storage (for RAG chatbots), and user identity.  
* **AI Logic & API Security:** Google AI Studio APIs (Gemini Flash & Vision). Next.js Serverless Functions proxy data between the app and the Gemini APIs.

## **7\. Identity, Access & Navigation (RBAC & SSO)**

* **Unified Identity (SSO):** A single Supabase Auth service governs the ecosystem.  
* **The "App Switcher" UI:** Global navigation menu to switch between Desk/Mat-side.  
* **Customizable Tenant-Level Roles (RBAC):** Admin-defined custom roles mapping via Supabase PostgreSQL Row Level Security (RLS) to allow flexible access without multiple accounts.

## **8\. Core Database Schema (Expanded Entity-Relationship Model)**

### **8.1. Infrastructure & Multi-Tenancy**

* **Tenants & Locations:** Overarching business entity and physical branch separation.

### **8.2. Identity, Family & Roles**

* **Users (Profiles) & Families (Guardianships):** Maps parents to children for unified billing.  
* **Roles & User\_Roles (RBAC):** Granular permission mapping.

### **8.3. The Multi-Track Progression Engine**

* **Programs, Curriculum\_Ranks, & Skills\_Checklist:** Isolates disciplines and tracks granular competency.  
* **Student\_Progression (Junction):** Tracks active status within a specific program.  
* **Belt\_Testing\_Events & Certifications:** Ledger tracking testing dates, pass/fail status, and generated credentials (prepped for Kukkiwon API/CSV data export).

### **8.4. Mat-Side Execution & Events**

* **Classes, Attendance\_Logs, & Skill\_Evaluations:** Ledger of scheduled instances and instructor sign-offs.  
* **Class\_Transcripts:** Stores raw and AI-processed audio logs for the Action Board.  
* **Events\_and\_Camps & Event\_Registrations:** Decouples After-School/Summer Camp rosters from standard martial arts classes, allowing distinct check-in and billing rules.

### **8.5. CRM & Marketing**

* **Leads, Pipelines, Campaigns, & Communications\_Log:** Replaces Hubspot/Mailchimp.

### **8.6. Billing & E-Commerce**

* **Subscriptions & Invoices:** Stripe-linked ledger for recurring memberships.  
* **Point\_of\_Sale\_Transactions:** Direct linkage to Stripe Terminal hardware IDs for walk-in front desk sales.  
* **Inventory (Products):** Retail items (gear, weapons, apparel) tracking variations (size/color), stock levels, and COGS for POS sales, Home app upselling, and AI packing slip ingest.

## **9\. Agentic Workflow Specifications**

### **9.1. The "Drift Detector" (Predictive Churn)**

* **The Trigger:** Nightly CRON job calculates 30-day trailing attendance velocity.  
* **The AI Logic Layer:** Drafts a highly personalized "re-engagement" message.  
* **The Output/Action:** Inserts payload into Communications\_Log as a "Draft SMS". **Explicit Admin 1-click approval in KoryoDesk is strictly required before dispatch.**

### **9.2. Vision Master (Gold Standard Matching)**

* **The Setup:** The Master Instructor uploads a baseline video of a technique (the "Gold Standard").  
* **The Trigger:** Student uploads a practice video via KoryoHome.  
* **The AI Logic Layer:** Gemini Vision API overlays kinematics, comparing the student's timing, chamber, and posture *exclusively* against the Instructor's baseline video.  
* **The Output/Action:** Returns an accuracy\_score and actionable\_tip logged to Skill\_Evaluations.

### **9.3. Continuous Class Transcription (Action Board)**

* **The Trigger:** Instructor starts a class recording via a BT lapel mic.  
* **The AI Logic Layer:** Post-class, Gemini parses the transcript utilizing Named Entity Recognition (NER) to find student names and maps spoken verbal corrections to database skill\_ids.  
* **The Output/Action:** Generates a "Post-Class Action Board" UI inside KoryoGraph, allowing the instructor to quickly review, edit, and click "Approve All" to mass-log attendance and skill notes.

### **9.4. Empathetic Billing Recovery**

* **The Logic Layer:** Stripe webhook triggers Gemini to draft an SMS. Empathy level adjusts dynamically based on customer tenure (3-year veteran gets relaxed tone; new user gets urgent tone).

### **9.5. Generative UI Dashboards (Desk)**

* **The Trigger:** Admin types a natural language query ("Show revenue vs attendance for Tigers class").  
* **The AI Logic Layer:** Gemini translates the intent into a secure SQL query, fetches the data, and returns a structured JSON payload defining chart type (e.g., line, bar) and data points.  
* **The Output/Action:** Next.js frontend renders the dynamic chart component instantly.

### **9.6. RAG Chatbots (Desk Copilot & Home Dojang Bot)**

* **The Infrastructure:** Supabase pgvector extension stores embeddings of studio policies, curriculum text, and FAQs.  
* **The Logic Layer:** When queried, the system retrieves relevant vectors, injects them into the Gemini prompt context window, and returns a highly accurate, domain-specific answer.

### **9.7. Magic Inventory Receiver (Vision-to-Stock)**

* **The Trigger:** Admin uploads a photo or PDF of a supplier packing slip (e.g., from Century Martial Arts) via KoryoDesk.  
* **The AI Logic Layer:** Gemini Vision analyzes the document, extracting line items, quantities, and sizes. It cross-references extracted items with existing SKUs in the Inventory table using semantic similarity.  
* **The Output/Action:** Generates a structured JSON payload mapping the incoming stock. Displays a "Draft Stock Update" UI for the Admin to verify and click "Approve," instantly adding the quantities to the database.

## **10\. Compliance & Security Constraints**

* **COPPA Compliance:** Strict protocols for parental consent and video purging.  
* **Payment Processing:** Tokenized Stripe integration including Stripe Terminal SDK for physical hardware.

## **11\. Success Metrics (KPIs for MVP)**

1. **Mat-Side Friction:** Reduce post-class data entry time by 80%.  
2. **Data Accuracy:** Zero "visit attribution errors".  
3. **Owner Adoption:** 100% transition from legacy software within 30 days.