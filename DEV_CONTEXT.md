# Developer Context

This file keeps running context and decisions made while working on the Electron Import-Analysis application.
It can be updated at any time as the project evolves.  
(Always remember to stop & restart the app after code changes as per user preference.)

---

## 2025-07-03 Session Start

### Application Overview
* Electron app with a renderer side built mostly in vanilla JS + Bootstrap.
* Main complex file: `renderer/import-analysis.js` (≈5 k LOC) – handles BigCommerce & Hypa CSV import pipelines, card creation, validation, analytics dashboard, etc.

### Key Global Helpers (moved outside main load listener)
* `getCardTypeDisplayName(cardType)` – returns short human-readable card type labels.
* `validateHypaData(data)` – validates Hypa CSV rows & gathers stats.
* `showCardDetailsModal(card)` – renders a Bootstrap modal with full card details when user clicks the blue "i" on grid items.
* All three helpers are now bound to `window.*` so any component can call them.

### Recent Fixes
1. **File closure errors fixed** – added missing `});` and ensured main `window.addEventListener('load', …)` closes properly.
2. **Helpers exported globally** – to resolve `ReferenceError` for `validateHypaData`, `getCardTypeDisplayName`, and `showCardDetailsModal`.
3. **Card Details modal now works** – clicking the blue info icon opens the modal without JS errors.

### User Preferences / Reminders
* Always remind to **stop & restart the app** after code changes so Electron reloads the new bundle.

---

(Use this file to append future notes, TODOs, or architecture insights.) 