# Quick Start: Capture All App Events

## What You Get

A complete system to capture **8 app lifecycle events** with **user emails** automatically:

```
✅ APP_INSTALLED              - Someone installs your app
✅ APP_REMOVED                - Someone uninstalls your app
✅ PAID_PLAN_PURCHASED        - User buys a paid plan
✅ PAID_PLAN_CHANGED          - User upgrades/downgrades
✅ PLAN_CONVERTED_TO_PAID     - Free trial converts to paid
✅ PLAN_REACTIVATED           - Auto-renewal turned on
✅ PAID_PLAN_AUTO_RENEWAL_CANCELLED - Auto-renewal cancelled
✅ PLAN_TRANSFERRED           - Plan moved to another account
```

## Files Created

### 1. In Your Wix App
- ✅ `src/backend/events/appInstanceEvents.ts` - Captures all 8 events

### 2. For Your Portfolio Site
- ✅ `PORTFOLIO_HTTP_FUNCTION.js` - Add this to karpo.studio backend

### 3. Documentation
- ✅ `APP_EVENTS_SETUP_GUIDE.md` - Complete setup guide
- ✅ `QUICK_START.md` - This file

## 3-Step Setup

### Step 1: Portfolio Site (5 minutes)

1. **Add HTTP Function**
   - Copy code from `PORTFOLIO_HTTP_FUNCTION.js`
   - Paste into `karpo.studio/backend/http-functions.js`
   - Publish your portfolio site

2. **Update Collection Schema**
   Add these fields to your `AppInstallations` collection:
   ```
   - eventType (Text)
   - eventDescription (Text)
   - eventTimestamp (Date)
   - appName (Text)
   - instanceId (Text)
   - siteId (Text)
   - siteUrl (Text)
   - siteName (Text)
   - userEmail (Text)         ← THE EMAIL YOU WANT!
   - ownerId (Text)
   - planId (Text)
   - planName (Text)
   - isFree (Boolean)
   - installMessage (Text)
   - rawPayload (Text)
   ```

### Step 2: Wix App (2 minutes)

1. **Clean up old files**
   ```bash
   rm src/backend/events/appInstalled.ts
   rm src/backend/events/event.ts
   ```

2. **The new file is already created!**
   - `src/backend/events/appInstanceEvents.ts` ✓

3. **Deploy**
   ```bash
   npm run build
   npm run release
   ```

### Step 3: Test (1 minute)

1. Install your app on a test site
2. Check karpo.studio AppInstallations collection
3. You should see a new record with the user's email! 🎉

## What You'll See in Your Collection

```javascript
{
  eventType: "APP_INSTALLED",
  eventDescription: "App Installed",
  eventTimestamp: "2025-01-10T...",
  appName: "Unified Orders Dashboard",
  instanceId: "abc-123-xyz",
  siteId: "d1234567-...",
  siteUrl: "https://example.wixsite.com/...",
  siteName: "My Awesome Site",
  userEmail: "john@example.com",  // ← HERE IT IS!
  ownerId: "user-123",
  planId: null,
  planName: null,
  isFree: null,
  installMessage: "App Installed - Unified Orders Dashboard",
  rawPayload: "{...complete event data...}"
}
```

## Why This Works Better

### Your Old Approach ❌
```
1. Webhook sends JWT → 2. Update email endpoint → 3. Event handler tries to update
                         (creates record)         (sometimes fails)
```

**Problems:**
- Timing issues
- Two separate systems
- Only captured installs
- Unreliable

### New Approach ✅
```
1. Event occurs → 2. Event handler gets data → 3. Send to portfolio → 4. Save
                     (including email!)         (single endpoint)      (always works)
```

**Benefits:**
- Native Wix events
- Gets email immediately
- Captures ALL events
- Reliable & simple
- Works for multiple apps

## Use Cases

### See who installed your app
```javascript
wixData.query('AppInstallations')
  .eq('eventType', 'APP_INSTALLED')
  .descending('eventTimestamp')
  .find()
```

### Track user lifecycle
```javascript
wixData.query('AppInstallations')
  .eq('userEmail', 'john@example.com')
  .ascending('eventTimestamp')
  .find()
// Returns: INSTALLED → PURCHASED → CHANGED → REMOVED
```

### Monitor churn
```javascript
wixData.query('AppInstallations')
  .eq('eventType', 'APP_REMOVED')
  .find()
```

### Find paying customers
```javascript
wixData.query('AppInstallations')
  .eq('eventType', 'PAID_PLAN_PURCHASED')
  .find()
```

## Can You Remove the Old Code?

**Yes!** You can safely remove:

```javascript
// DELETE THIS from your portfolio http-functions.js:
export async function post_updateInstallEmail(request) { ... }
```

The new unified endpoint handles everything!

## Next: Add More Apps

Want to track events from your other apps?

1. Copy `appInstanceEvents.ts` to other app
2. Update the `appId` and `appName`
3. Deploy the app
4. Done! Same endpoint handles all apps ✨

## Questions?

Check `APP_EVENTS_SETUP_GUIDE.md` for detailed documentation including:
- Complete architecture diagram
- Troubleshooting guide
- Advanced queries
- Monitoring tips
