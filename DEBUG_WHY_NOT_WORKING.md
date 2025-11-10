# Debug: Why APP_INSTALLED Event Isn't Working

## ✅ What We Know Works

1. ✅ Portfolio endpoint is working (just tested with curl)
2. ✅ Database insert works (created record: `ec788b1d-013a-4130-93c1-48c5567769f0`)
3. ✅ Event file is in correct location (`src/backend/events/appInstanceEvents.ts`)
4. ✅ App was rebuilt successfully

## ❓ What We Need to Check

The event handler in your app needs to actually RUN when you install the app. Let's check:

### Check 1: Is the App Deployed with Event Extensions?

```bash
# Check if event file will be included in deployment
npm run build 2>&1 | grep -i event
```

### Check 2: View CLI Logs During Install

The KEY is to watch logs WHILE installing:

```bash
# In terminal, start watching logs
npm run logs

# Keep this running!
# Now in browser, install the app
# You should see event logs appear immediately
```

Expected output:
```
=== APP_INSTALLED EVENT ===
Event data: {...}
Sending to portfolio: {...}
Portfolio response (200): {"success": true}
```

## Most Likely Issue: App Not Released

**The event extension only works in a RELEASED version, not in development mode!**

### Solution: Release the App

```bash
# Create a new app version with the event extension
npm run release
```

Follow the prompts to:
1. Create a new version
2. Give it a version number (e.g., 1.0.1)
3. Add release notes
4. Confirm

### Then: Install the RELEASED Version

1. **Uninstall any existing version**
2. **Install using the released version URL** from your app dashboard
3. **Watch logs immediately**: `npm run logs`

## How Event Extensions Work

```
Development (npm run dev)
━━━━━━━━━━━━━━━━━━━━━━━━━
- Frontend works locally
- Backend extensions MAY work
- Event extensions: ❓ Limited support

Released Version (npm run release)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Full app deployed to Wix cloud
- All extensions active
- Event extensions: ✅ WORK FULLY
```

## Debug Steps

### Step 1: Release the App
```bash
cd /Users/guillaume/Desktop/unified-orders-dashboard
npm run release
```

### Step 2: Get Install URL
After release:
1. Go to app dashboard
2. Copy the installation URL
3. Or use direct install link from dashboard

### Step 3: Start Log Monitoring
```bash
npm run logs
```

Keep this terminal open!

### Step 4: Install App
1. Open new browser tab
2. Navigate to test site
3. Install app using release URL
4. **Immediately look at logs terminal**

### Step 5: What to Look For

**In Logs (npm run logs):**
```
✅ GOOD:
=== APP_INSTALLED EVENT ===
Event data: {...ownerEmail: "user@example.com"...}
Sending to portfolio: {...}
Portfolio response (200): {"success": true, "itemId": "..."}

❌ BAD (nothing appears):
- Event handler not running
- App not fully deployed
- Need to release and use released version
```

**In Portfolio Collection:**
- New record should appear
- Has eventType: "APP_INSTALLED"
- Has ownerEmail filled in

## Alternative: Check if getAppInstance() Has Permission

The event handler calls `appInstances.getAppInstance()` which requires permission.

### Check App Permissions

1. Go to app dashboard
2. Click "Permissions" in sidebar
3. Make sure you have:
   - ✅ **Manage Your App** (required)
   - ✅ **Read Site Owner Email** (required for email)

If missing, add them and release a new version.

## Test Without Actual Install

Want to test the code without installing? Add a test endpoint to your app:

**In `src/backend/` create `test-event.web.ts`:**
```typescript
import { appInstances } from '@wix/app-management';

export async function testInstallEvent() {
  try {
    const appInstanceData = await appInstances.getAppInstance();

    const testPayload = {
      eventType: 'APP_INSTALLED',
      instanceId: appInstanceData.instance?.instanceId || 'test-123',
      appId: 'aeb5e016-2505-4705-b39f-7724f4845fbd',
      appName: 'Unified Orders Dashboard',
      timestamp: new Date().toISOString(),
      siteId: appInstanceData.site?.siteId || 'test',
      siteUrl: appInstanceData.site?.url || 'test',
      siteName: appInstanceData.site?.siteDisplayName || 'test',
      ownerEmail: appInstanceData.site?.ownerInfo?.email || 'test@test.com',
      ownerId: appInstanceData.site?.siteId || 'test',
      planId: null,
      planName: null,
      isFree: true,
      eventData: {},
      eventMetadata: {}
    };

    const response = await fetch('https://karpo.studio/_functions/appInstanceEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    return { success: true, appData: appInstanceData, portfolioResult: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

Then call it from your dashboard to test!

## Bottom Line

**Most likely:** You need to `npm run release` and install the **released version**, not a dev version.

Event extensions only fully work in released versions!
