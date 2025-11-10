# Complete App Instance Events Capture System

This guide explains how to capture ALL app lifecycle events from your Wix apps and store them in your portfolio site.

## Overview

This solution captures 8 different app instance events:
1. **APP_INSTALLED** - When app is installed on a site
2. **APP_REMOVED** - When app is uninstalled from a site
3. **PAID_PLAN_PURCHASED** - When user buys a paid plan
4. **PAID_PLAN_CHANGED** - When user upgrades/downgrades their plan
5. **PLAN_CONVERTED_TO_PAID** - When free trial converts to paid
6. **PLAN_REACTIVATED** - When auto-renewal is turned on
7. **PAID_PLAN_AUTO_RENEWAL_CANCELLED** - When auto-renewal is cancelled
8. **PLAN_TRANSFERRED** - When plan is transferred to another account

## Architecture

```
┌─────────────────────────────────────────┐
│  Your Wix App (Unified Orders Dashboard) │
│                                          │
│  Event Extensions (appInstanceEvents.ts) │
│  - onAppInstanceInstalled()              │
│  - onAppInstanceRemoved()                │
│  - onAppInstancePaidPlanPurchased()      │
│  - ... and 5 more event handlers         │
└────────────────┬─────────────────────────┘
                 │
                 │ HTTP POST
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Portfolio Site (karpo.studio)          │
│                                          │
│  HTTP Function: post_appInstanceEvent    │
│  - Receives event data                   │
│  - Enriches with metadata                │
│  - Saves to AppInstallations collection  │
└─────────────────────────────────────────┘
```

## Setup Instructions

### Part 1: Portfolio Site Setup

#### Step 1: Update Your Portfolio Site Collection

In your **karpo.studio** site, update the `AppInstallations` collection schema to include these fields:

**Required Fields:**
- `eventType` (Text) - Type of event (APP_INSTALLED, APP_REMOVED, etc.)
- `eventDescription` (Text) - Human-readable event description
- `eventTimestamp` (Date) - When the event occurred
- `appDefId` (Text) - Your app's ID
- `appName` (Text) - Name of your app
- `instanceId` (Text) - Unique instance ID
- `siteId` (Text) - Wix site ID
- `siteUrl` (Text) - Site URL
- `siteName` (Text) - Site display name
- `userEmail` (Text) - Site owner's email
- `ownerId` (Text) - Site owner's ID
- `installMessage` (Text) - Log message for display
- `rawPayload` (Text) - Complete event data as JSON

**Optional Fields (for plan events):**
- `planId` (Text) - Plan ID
- `planName` (Text) - Plan name
- `planVendorId` (Text) - Vendor plan ID
- `isFree` (Boolean) - Whether plan is free

#### Step 2: Add HTTP Function to Portfolio Site

Copy the code from `PORTFOLIO_HTTP_FUNCTION.js` to your portfolio site's `backend/http-functions.js` file.

The function will be available at: `https://karpo.studio/_functions/appInstanceEvent`

#### Step 3: Test the Endpoint

Test that the endpoint is working:
```bash
curl https://karpo.studio/_functions/appInstanceEvent
```

You should see:
```json
{
  "success": true,
  "message": "App Instance Event endpoint is working!",
  "supportedEvents": [...]
}
```

### Part 2: Wix App Setup

#### Step 1: Clean Up Old Event Files

Delete the old event handler files that aren't working:
```bash
rm src/backend/events/appInstalled.ts
rm src/backend/events/event.ts
```

#### Step 2: The Event Handler is Already Created

The file `src/backend/events/appInstanceEvents.ts` has been created with handlers for ALL 8 lifecycle events.

#### Step 3: Verify Dependencies

Make sure `@wix/app-management` is installed (it should already be in your package.json):
```bash
npm install
```

#### Step 4: Test Locally

Start your development server:
```bash
npm run dev
```

The event handlers are now active and will automatically trigger when events occur.

#### Step 5: Deploy to Production

Build and release your app:
```bash
npm run build
npm run release
```

## How It Works

### Event Flow

1. **Event Occurs**: User installs/removes app or changes plan
2. **Wix Triggers Event**: Wix's platform detects the action
3. **Event Handler Executes**: Your event extension code runs automatically
4. **Get App Instance Data**: Handler calls `appInstances.getAppInstance()` to get owner email and site details
5. **Send to Portfolio**: Handler sends comprehensive data to your portfolio site
6. **Save to Database**: Portfolio site saves event to AppInstallations collection

### What Data is Captured

For each event, you capture:
- Event type and timestamp
- App information (ID, name, instance ID)
- Site information (ID, URL, name)
- Owner information (email, ID)
- Plan information (for plan-related events)
- Complete event payload for debugging

## Viewing Your Data

### In Wix Portfolio Site

1. Go to your site's CMS: `https://manage.wix.com/dashboard/[site-id]/cms/content-manager/collections/AppInstallations`
2. View all captured events
3. Filter by:
   - Event type
   - App name
   - User email
   - Date range

### Query Examples

To get all installs:
```javascript
wixData.query('AppInstallations')
  .eq('eventType', 'APP_INSTALLED')
  .find()
```

To get all events for a specific app:
```javascript
wixData.query('AppInstallations')
  .eq('appName', 'Unified Orders Dashboard')
  .descending('eventTimestamp')
  .find()
```

To get user's lifecycle:
```javascript
wixData.query('AppInstallations')
  .eq('userEmail', 'user@example.com')
  .ascending('eventTimestamp')
  .find()
```

## Benefits Over Old Approach

### Old Approach Problems:
- ❌ Only captured install events
- ❌ Unreliable timing (3-second delay)
- ❌ No removal tracking
- ❌ No plan change tracking
- ❌ Required separate webhook setup
- ❌ Complex JWT verification

### New Approach Benefits:
- ✅ Captures ALL 8 lifecycle events
- ✅ Native Wix CLI event extensions
- ✅ Automatic webhook subscription
- ✅ Reliable event delivery
- ✅ No JWT handling needed
- ✅ Easy to add more events
- ✅ Works for multiple apps

## Adding More Apps

To track events from other Wix apps:

1. Copy `appInstanceEvents.ts` to the other app's `src/backend/events/` folder
2. Update the `appId` and `appName` in the file
3. The same portfolio endpoint handles all apps!

## Monitoring & Debugging

### Check Event Logs

In your Wix CLI during development:
```bash
npm run dev
# Then press 'L' to view logs
```

Look for:
```
=== APP_INSTALLED EVENT ===
Event data: {...}
Sending to portfolio: {...}
Portfolio response (200): {"success": true, ...}
```

### Check Portfolio Logs

In your portfolio site's backend logs, you'll see:
```
✓ App Installed - Unified Orders Dashboard (Instance: xxx-xxx-xxx)
```

### Production Logs

View production logs:
```bash
npm run logs
```

## Troubleshooting

### Events not being captured?

1. Check app is properly deployed: `npm run release`
2. Verify endpoint is accessible: `curl https://karpo.studio/_functions/appInstanceEvent`
3. Check CLI logs: `npm run logs`
4. Verify collection exists in portfolio site

### Missing email addresses?

The `getAppInstance()` call should return owner email. If it doesn't:
- Check app permissions in dashboard
- Verify app is properly installed
- Email may not be available during some events (this is a Wix limitation)

### Duplicate events?

This is normal! Wix may send events multiple times for reliability. You can:
- Add unique constraint on `instanceId` + `eventType` + `eventTimestamp`
- De-duplicate in queries
- Check `rawPayload` to identify true duplicates

## Next Steps

1. ✅ Deploy the portfolio HTTP function
2. ✅ Update your AppInstallations collection schema
3. ✅ Deploy your Unified Orders Dashboard app
4. ✅ Install app on a test site to trigger APP_INSTALLED event
5. ✅ Check your portfolio site's AppInstallations collection
6. ✅ Try removing the app to trigger APP_REMOVED event
7. ✅ Purchase a plan to trigger plan events

## Support

- Wix CLI Discord: https://discord.gg/aN9ubnrs2D
- Event Extensions Docs: https://dev.wix.com/docs/build-apps/develop-your-app/frameworks/wix-cli/supported-extensions/backend-extensions/events/add-event-extensions-with-the-cli
- App Instance Events: https://dev.wix.com/docs/sdk/backend-modules/app-management/app-instances/introduction
