# Test Event Capture Manually

## What Was Wrong

Your event file was in the wrong location:
- ❌ Was: `src/backend/events/my-event/appInstanceEvents.ts`
- ✅ Now: `src/backend/events/appInstanceEvents.ts`

This is why events weren't being captured - Wix couldn't find the event handlers!

## Fixed and Rebuilt

✅ File moved to correct location
✅ App rebuilt successfully
✅ Portfolio endpoint is working

## Now Deploy and Test

### Step 1: Release the New Version
```bash
npm run release
```

Follow the prompts to create a new app version.

### Step 2: Uninstall the App
1. Go to your test Wix site
2. Go to: Settings → Apps
3. Find "Unified Orders Dashboard"
4. Click "Uninstall"
5. Confirm

### Step 3: Reinstall the App
1. Use your app's install URL or
2. Install from App Market if published or
3. Use direct install URL from app dashboard

### Step 4: Check Results

#### A. Check Wix CLI Logs
```bash
npm run logs
```

Look for:
```
=== APP_INSTALLED EVENT ===
Event data: {...}
Metadata: {...}
Sending to portfolio: {...}
Portfolio response (200): {"success": true, ...}
```

#### B. Check Portfolio Collection
1. Go to karpo.studio
2. Navigate to CMS → Content Manager
3. Open "AppInstallations" collection
4. You should see a NEW record with:
   - eventType: "APP_INSTALLED"
   - userEmail: "your-email@example.com"
   - appName: "Unified Orders Dashboard"
   - siteUrl: "https://..."
   - All other fields populated

#### C. Check Portfolio Logs
1. Go to karpo.studio dashboard
2. Check site logs
3. Look for:
```
=== APP INSTANCE EVENT RECEIVED ===
Event Type: APP_INSTALLED
✓ App Installed - Unified Orders Dashboard
```

## Manual Test (Alternative)

If you want to test the endpoint directly without installing:

```bash
curl -X POST https://karpo.studio/_functions/appInstanceEvent \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "APP_INSTALLED",
    "instanceId": "test-instance-123",
    "appId": "aeb5e016-2505-4705-b39f-7724f4845fbd",
    "appName": "Unified Orders Dashboard",
    "timestamp": "2025-11-10T19:30:00.000Z",
    "siteId": "test-site-456",
    "siteUrl": "https://test.wixsite.com/mysite",
    "siteName": "Test Site",
    "ownerEmail": "test@example.com",
    "ownerId": "test-owner-789",
    "planId": null,
    "planName": null,
    "planVendorId": null,
    "isFree": true,
    "eventData": {},
    "eventMetadata": {}
  }'
```

Should return:
```json
{
  "success": true,
  "message": "Event recorded successfully",
  "itemId": "...",
  "eventType": "APP_INSTALLED"
}
```

Then check your AppInstallations collection - you should see the test record!

## Why It Didn't Work Before

1. **File in wrong location** - Event handler wasn't being loaded
2. **Old webhook conflicts** - Deleted webhook was trying to call wrong endpoint
3. **Wasn't rebuilt** - Old code was still deployed

## Success Indicators

You'll know it's working when:

✅ No errors in CLI logs
✅ See "Portfolio response (200)" in logs
✅ New record appears in AppInstallations collection
✅ Record contains user email
✅ eventType is "APP_INSTALLED"

## Next Test: App Removal

After verifying install works:

1. Uninstall the app again
2. Check logs for: `=== APP_REMOVED EVENT ===`
3. Check collection for new record with eventType: "APP_REMOVED"

## Troubleshooting

### If logs show no event at all:
→ Event handler not registered. Check file is at `src/backend/events/appInstanceEvents.ts`

### If logs show event but no portfolio response:
→ Network issue. Check portfolio URL in code is correct

### If logs show 404 from portfolio:
→ Portfolio function not deployed. Republish karpo.studio

### If logs show 500 from portfolio:
→ Database error. Check collection schema matches expected fields
