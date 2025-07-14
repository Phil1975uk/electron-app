# Developer Context

This file keeps running context and decisions made while working on the Electron Import-Analysis application.
It can be updated at any time as the project evolves.  
(Always remember to stop & restart the app after code changes as per user preference.)

---

## 2025-07-03 Session Start

### Application Overview
* Electron app with a renderer side built mostly in vanilla JS + Bootstrap.
* Main complex file: `renderer/import-analysis.js` (≈5.3k LOC) – handles BigCommerce & Hypa CSV import pipelines, card creation, validation, analytics dashboard, etc.

### Key Global Helpers (moved outside main load listener)
* `getCardTypeDisplayName(cardType)` – returns short human-readable card type labels.
* `validateHypaData(data)` – validates Hypa CSV rows & gathers stats.
* `showCardDetailsModal(card)` – renders a Bootstrap modal with full card details when user clicks the blue "i" on grid items.
* All three helpers are now bound to `window.*` so any component can call them.

### Recent Fixes
1. **File closure errors fixed** – added missing `});` and ensured main `window.addEventListener('load', …)` closes properly.
2. **Helpers exported globally** – to resolve `ReferenceError` for `validateHypaData`, `getCardTypeDisplayName`, and `showCardDetailsModal`.
3. **Card Details modal now works** – clicking the blue info icon opens the modal without JS errors.

---

## 2025-07-03 Hypa Metafields Architecture Overhaul

### Fundamental Approach Change
**CRITICAL**: The app is a **card editor for existing Hypa metafields**, NOT a product manager.

#### Key Rules:
1. **No New Rows**: Never create new rows in the CSV - only work within existing product rows
2. **Hypa CSV is Master**: The original Hypa CSV is the source of truth for what's on the website
3. **Selection = Final Authority**: The selection step determines what stays vs gets removed from the website

### Import Process (Fixed)
**Before**: Only imported cards for SKUs that exist in local configurations
**After**: Imports ALL cards from Hypa CSV, regardless of local configurations

**Benefits**:
- Complete picture of what's currently on the website
- Can edit cards for products not yet imported from BigCommerce
- Enriches cards with local config data when available

### Export Process (Fixed)
**Before**: Only exported selected local cards, ignored unselected ones
**After**: 
1. Start with original Hypa CSV structure (no new rows)
2. Clear all card-related columns first
3. Update only selected cards
4. Unselected cards remain cleared (removed from website)

**Result**: Selection determines what stays vs gets removed

### Comparison Logic (Updated)
**Before**: "New/Update/Skip/Conflict" (export-focused)
**After**: "Add/Update/Keep/Remove" (selection-focused)

**Definitions**:
- **Add**: Card doesn't exist in Hypa, will be added to existing row
- **Update**: Card exists in Hypa but local version is different
- **Keep**: Card is identical to Hypa (no changes detected)
- **Remove**: Card exists in Hypa but user wants to clear/remove it

### Card Types Supported
The system can import/export these card types from Hypa:
- **Feature Cards**: Product features with titles, descriptions, images
- **Product Options**: Optional add-ons with pricing
- **Cargo Options**: Cargo-related accessories
- **Weather Protection**: Weather-related accessories
- **Specification Tables**: Technical specifications

### Data Extraction Methods
Two approaches for extracting card data:

#### Standard Column Format
Looks for structured columns like:
- `features.feature_1_title`, `features.feature_1_description`, `features.feature_1_image`
- `options.option_1_title`, `options.option_1_description`, `options.option_1_price`
- `cargo.cargo_1_title`, `cargo.cargo_1_description`, `cargo.cargo_1_price`

#### HTML Block Parsing
Falls back to parsing HTML content from columns like:
- `shared.feature-1-card`, `shared.feature-2-card`
- `shared.option-1-card`, `shared.option-2-card`
- `shared.cargo-option-1-card`, `shared.weather-option-1-card`

### Workflow Summary
1. **Import**: Import ALL cards from Hypa CSV → complete local database
2. **Edit**: Modify cards locally as needed
3. **Export**: 
   - Start with original Hypa CSV structure
   - Clear all card columns
   - Update only selected cards
   - Final CSV = exactly what you want on the website

### Debug Logging
Added comprehensive debug logging throughout the import/export process to help trace data flow and issues.

### User Preferences / Reminders
* Always remind to **stop & restart the app** after code changes so Electron reloads the new bundle.
* Next time working on the Card Manager page, remind the user to add Hypa import labels onto the cards for better tracking of imported cards.

---

(Use this file to append future notes, TODOs, or architecture insights.) 