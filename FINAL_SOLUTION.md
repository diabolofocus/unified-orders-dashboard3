# Final Solution: Complete Setup Guide

## ✅ Portfolio Endpoint is Working!

We just tested it and it successfully created a record! (ID: `ec788b1d-013a-4130-93c1-48c5567769f0`)

## 📁 Files to Use

### 1. Your App (Already Done)
✅ Event handler: `/src/backend/events/appInstanceEvents.ts`

### 2. Your Portfolio Site
✅ HTTP Functions: Copy from `COMPLETE_PORTFOLIO_HTTP_FUNCTIONS.js`

**This file includes:**
- `post_appInstanceEvent` - App lifecycle events
- `get_appInstanceEvent` - Test endpoint
- `options_appInstanceEvent` - CORS support
- `post_supportSubmission` - Bug reports & feature requests
- `get_supportSubmission` - Test endpoint
- `options_supportSubmission` - CORS support

## 🔥 Critical Step: RELEASE THE APP

Event extensions only work in RELEASED versions, not dev versions!

```bash
cd /Users/guillaume/Desktop/unified-orders-dashboard
npm run release
```

Follow prompts:
1. Version number (e.g., 1.0.1)
2. Release notes: "Added event extensions for app lifecycle tracking"
3. Confirm

## 📋 Complete Testing Checklist

### Step 1: Check Permissions
1. Go to app dashboard: https://manage.wix.com/account/custom-apps
2. Select "Unified Orders Dashboard"
3. Click "Permissions"
4. Verify you have:
   - ✅ **Manage Your App**
   - ✅ **Read Site Owner Email**
5. If missing, add them and release again

### Step 2: Release the App
```bash
npm run release
```

### Step 3: Prepare for Testing
Open TWO terminals:

**Terminal 1 - Logs:**
```bash
npm run logs
```
Keep this open and watching!

**Terminal 2 - Ready for commands**

### Step 4: Uninstall Old Version
1. Go to test site
2. Settings → Apps
3. Find "Unified Orders Dashboard"
4. Uninstall

### Step 5: Install Released Version
1. Get install URL from app dashboard
2. Install on test site
3. **IMMEDIATELY check Terminal 1 (logs)**

### Step 6: What You Should See

**In Terminal 1 (logs):**
```
=== APP_INSTALLED EVENT ===
Event data: {
  "metadata": {...},
  "entity": {...}
}
Metadata: {...instanceId...}
Sending to portfolio: {
  "eventType": "APP_INSTALLED",
  "ownerEmail": "your-email@example.com",
  ...
}
Portfolio response (200): {
  "success": true,
  "itemId": "...",
  "eventType": "APP_INSTALLED"
}
```

**In Portfolio Collection (karpo.studio):**
1. Go to CMS → AppInstallations
2. New record with:
   - eventType: "APP_INSTALLED"
   - userEmail: "your-email@example.com" ← THE EMAIL!
   - appName: "Unified Orders Dashboard"
   - All other fields populated

### Step 7: Test Removal
1. Uninstall app
2. Check logs for: `=== APP_REMOVED EVENT ===`
3. Check collection for removal record

## 🐛 If Still Not Working

### Check 1: Are Logs Showing Anything?
```bash
npm run logs
```

During install, if you see NOTHING:
→ Event handler not running
→ Check permissions
→ Make sure you released and installed RELEASED version

### Check 2: Do Logs Show Errors?
Look for:
- Permission errors → Add "Read Site Owner Email" permission
- Network errors → Check portfolio URL in code
- Module errors → Run `npm install` and rebuild

### Check 3: Is Portfolio Getting Requests?
Check karpo.studio site logs:
1. Go to karpo.studio dashboard
2. View site logs
3. Filter by "appInstanceEvent"

Should see:
```
=== APP INSTANCE EVENT RECEIVED ===
Event Type: APP_INSTALLED
✓ App Installed - Unified Orders Dashboard
```

## 🎯 Quick Manual Test

To verify everything works without installing:

```bash
# Test portfolio endpoint
curl -X POST https://karpo.studio/_functions/appInstanceEvent \
  -H "Content-Type: application/json" \
  -d '{
    "eventType":"APP_INSTALLED",
    "instanceId":"manual-test-456",
    "appId":"aeb5e016-2505-4705-b39f-7724f4845fbd",
    "appName":"Unified Orders Dashboard",
    "timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "siteId":"test-site",
    "siteUrl":"https://test.wixsite.com",
    "siteName":"Test Site",
    "ownerEmail":"manual-test@example.com",
    "ownerId":"test-owner",
    "planId":null,
    "planName":null,
    "isFree":true,
    "eventData":{},
    "eventMetadata":{}
  }'
```

Should return:
```json
{"success":true,"message":"Event recorded successfully","itemId":"...","eventType":"APP_INSTALLED"}
```

Then check your AppInstallations collection - you'll see the test record!

## 📊 Collection Schema

Make sure your AppInstallations collection has these fields:

**Required:**
- `eventType` (Text)
- `eventDescription` (Text)
- `eventTimestamp` (Date & Time)
- `appDefId` (Text)
- `appName` (Text)
- `instanceId` (Text)
- `siteId` (Text)
- `siteUrl` (Text)
- `siteName` (Text)
- `userEmail` (Text) ← For the email!
- `ownerId` (Text)
- `installMessage` (Text)
- `rawPayload` (Text)

**Optional (for plan events):**
- `planId` (Text)
- `planName` (Text)
- `planVendorId` (Text)
- `isFree` (Boolean)

## ✨ Success Indicators

You'll know it's working when ALL of these are true:

- ✅ `npm run logs` shows APP_INSTALLED event
- ✅ Logs show "Portfolio response (200)"
- ✅ AppInstallations collection has new record
- ✅ Record has `userEmail` filled in
- ✅ Record has `eventType: "APP_INSTALLED"`
- ✅ No errors in logs

## 🔄 Complete Files

1. **App event handler:** Already created at `src/backend/events/appInstanceEvents.ts`
2. **Portfolio functions:** Use `COMPLETE_PORTFOLIO_HTTP_FUNCTIONS.js`
3. **This guide:** `FINAL_SOLUTION.md`

---

**Start with: `npm run release` then test with logs open!** 🚀
