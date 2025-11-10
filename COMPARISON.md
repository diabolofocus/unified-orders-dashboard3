# Old vs New: Event Capture Comparison

## What Changed?

### Old Approach (Doesn't Work Well)

**Files:**
- `src/backend/events/appInstalled.ts` ❌
- `src/backend/events/event.ts` ❌
- Portfolio: `post_updateInstallEmail()` ❌

**Flow:**
```
App Installed
    ↓
Wait 3 seconds (?)
    ↓
Try to call getAppInstance()
    ↓
Send to updateInstallEmail endpoint
    ↓
Portfolio tries to UPDATE existing record
    ↓
❌ Often fails because record doesn't exist yet
```

**Problems:**
1. ❌ Only captures 1 event (install)
2. ❌ Arbitrary 3-second delay
3. ❌ Unreliable timing
4. ❌ No removal tracking
5. ❌ No plan event tracking
6. ❌ Two separate systems (webhook + event)
7. ❌ UPDATE logic fails if record doesn't exist

---

### New Approach (Native & Reliable)

**Files:**
- `src/backend/events/appInstanceEvents.ts` ✅
- Portfolio: `post_appInstanceEvent()` ✅

**Flow:**
```
Any Event Occurs (Install/Remove/Plan Change)
    ↓
Event handler automatically triggered by Wix
    ↓
getAppInstance() called immediately
    ↓
Send complete data to portfolio
    ↓
Portfolio CREATES new record
    ↓
✅ Always works!
```

**Benefits:**
1. ✅ Captures ALL 8 lifecycle events
2. ✅ No arbitrary delays
3. ✅ Native Wix event system
4. ✅ Tracks complete user lifecycle
5. ✅ Single unified endpoint
6. ✅ Always creates new records
7. ✅ Works for multiple apps

---

## Side-by-Side Code Comparison

### Old: appInstalled.ts
```typescript
export const appInstalled = async (event: any, context: any) => {
  console.log('=== APP INSTALLED EVENT (Event Extension) ===');

  // Wait 3 seconds (??)
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Only handles install event
  const appInstanceData = await appInstances.getAppInstance();

  // Calls UPDATE endpoint (often fails)
  await fetch('https://karpo.studio/_functions/updateInstallEmail', {
    method: 'POST',
    body: JSON.stringify({
      instanceId: instanceId,
      email: ownerEmail
    })
  });
};
```

### New: appInstanceEvents.ts
```typescript
// Handles ALL events with single helper function
async function sendToPortfolio(eventType: string, event: any, metadata: any) {
  // No delay - immediate execution
  const appInstanceData = await appInstances.getAppInstance();

  // Comprehensive payload with ALL data
  const payload = {
    eventType,
    instanceId,
    appId,
    appName,
    siteId,
    siteUrl,
    ownerEmail,  // ← Got the email!
    planId,
    planName,
    eventData,
    // ... and more
  };

  // Calls unified CREATE endpoint (always works)
  await fetch('https://karpo.studio/_functions/appInstanceEvent', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// Register handlers for ALL 8 events
appInstances.onAppInstanceInstalled((event, metadata) => {
  sendToPortfolio('APP_INSTALLED', event, metadata);
});

appInstances.onAppInstanceRemoved((event, metadata) => {
  sendToPortfolio('APP_REMOVED', event, metadata);
});

// ... 6 more event handlers
```

---

## Portfolio Endpoint Comparison

### Old: post_updateInstallEmail
```javascript
export async function post_updateInstallEmail(request) {
  const data = await request.body.json();

  // Tries to FIND and UPDATE existing record
  const results = await wixData.query('AppInstallations')
    .eq('instanceId', data.instanceId)
    .find();

  if (results.items.length > 0) {
    // Update email field only
    await wixData.update('AppInstallations', {
      _id: results.items[0]._id,
      userEmail: data.email
    });
  } else {
    // ❌ Record not found - fails!
    return badRequest({ error: 'Installation not found' });
  }
}
```

**Problem:** Requires record to exist first. But how does it get created?

### New: post_appInstanceEvent
```javascript
export async function post_appInstanceEvent(request) {
  const eventData = await request.body.json();

  // Always CREATES new record with ALL data
  const installData = {
    eventType: eventData.eventType,        // What happened
    eventDescription: "App Installed",      // Human readable
    eventTimestamp: new Date(),            // When
    appName: eventData.appName,            // Which app
    instanceId: eventData.instanceId,      // Unique ID
    siteUrl: eventData.siteUrl,            // Site info
    userEmail: eventData.ownerEmail,       // ← Got the email!
    planId: eventData.planId,              // Plan info
    rawPayload: JSON.stringify(eventData)  // Everything
  };

  // Simple INSERT - always works
  await wixData.insert('AppInstallations', installData);
}
```

**Benefit:** Self-contained. Every event creates its own record.

---

## Data Captured Comparison

### Old Approach
```javascript
{
  instanceId: "abc-123",
  userEmail: "user@example.com"  // Only these 2 fields
}
```

### New Approach
```javascript
{
  // Event Info
  eventType: "APP_INSTALLED",
  eventDescription: "App Installed",
  eventTimestamp: "2025-01-10T...",

  // App Info
  appDefId: "aeb5e016-...",
  appName: "Unified Orders Dashboard",
  instanceId: "abc-123",

  // Site Info
  siteId: "d1234567-...",
  siteUrl: "https://example.wixsite.com/...",
  siteName: "My Awesome Site",

  // Owner Info
  userEmail: "user@example.com",  // ← Still got the email!
  ownerId: "user-123",

  // Plan Info (when applicable)
  planId: "premium-plan",
  planName: "Premium",
  planVendorId: "vendor-123",
  isFree: false,

  // Complete Data
  installMessage: "App Installed - Unified Orders Dashboard",
  rawPayload: "{...complete event data...}"
}
```

---

## Events Captured

### Old: 1 Event
- ✅ Install

### New: 8 Events
- ✅ Install
- ✅ Remove
- ✅ Paid Plan Purchased
- ✅ Paid Plan Changed
- ✅ Plan Converted to Paid
- ✅ Plan Reactivated
- ✅ Auto-renewal Cancelled
- ✅ Plan Transferred

---

## What This Means

### Old System
You know:
- Someone installed your app
- Their email address (sometimes)

### New System
You know:
- When they installed
- When they removed it
- If they upgraded to paid
- If they downgraded
- If they cancelled auto-renewal
- If they reactivated
- Their complete journey
- Everything about their site
- Complete plan history

---

## Migration Path

### Step 1: Remove Old Code ❌
```bash
# Delete these files
rm src/backend/events/appInstalled.ts
rm src/backend/events/event.ts
```

```javascript
// Remove from portfolio http-functions.js
export async function post_updateInstallEmail(request) { ... }  // DELETE THIS
```

### Step 2: Use New Code ✅
The new file is already created:
- `src/backend/events/appInstanceEvents.ts` ✓

Add new portfolio function:
- Copy code from `PORTFOLIO_HTTP_FUNCTION.js` ✓

### Step 3: Deploy
```bash
npm run build
npm run release
```

---

## Conclusion

**Old approach:** Hacky workaround that only captured installs

**New approach:** Professional, native Wix event system that captures complete lifecycle

**Action:** Use the new approach! It's what Wix designed for this exact purpose.
