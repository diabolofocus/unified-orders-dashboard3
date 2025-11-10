# Install and Test Version 4.0.0

## ✅ Version 4.0.0 Released Successfully!

Great! Your app with event extensions is now released.

## 📋 Testing Steps

### Step 1: Get the Install URL

1. Go to: https://manage.wix.com/account/custom-apps
2. Click "Unified Orders Dashboard"
3. Find the install URL or copy it from the dashboard

**OR** use this direct link format:
```
https://www.wix.com/installer/install?appId=aeb5e016-2505-4705-b39f-7724f4845fbd
```

### Step 2: Uninstall Any Existing Version

On your test site:
1. Go to **Settings** → **Apps**
2. Find **"Unified Orders Dashboard"**
3. Click **"Uninstall"**
4. Confirm

### Step 3: Install Version 4.0.0

1. Use the install URL from Step 1
2. Follow the installation prompts
3. Complete the installation

### Step 4: Check Portfolio Collection

**Go to your portfolio site:**
1. Open: https://karpo.studio
2. Navigate to **CMS** → **Content Manager**
3. Open **"AppInstallations"** collection
4. **Look for a new record!**

**What you should see:**
```javascript
{
  eventType: "APP_INSTALLED",
  eventDescription: "App Installed",
  eventTimestamp: "2025-11-10T...",
  appName: "Unified Orders Dashboard",
  instanceId: "abc-123-xyz...",
  siteId: "...",
  siteUrl: "https://...",
  siteName: "...",
  userEmail: "YOUR-EMAIL@example.com",  // ← YOUR EMAIL!
  ownerId: "...",
  planId: null,
  planName: null,
  isFree: true,
  installMessage: "App Installed - Unified Orders Dashboard",
  rawPayload: "{...}"
}
```

### Step 5: Check Portfolio Logs (Optional)

1. Go to karpo.studio dashboard
2. Check site logs
3. Look for entries about appInstanceEvent

Should see:
```
=== APP INSTANCE EVENT RECEIVED ===
Event Type: APP_INSTALLED
✓ App Installed - Unified Orders Dashboard
```

## 🔍 If No Record Appears

### Check 1: Portfolio Endpoint

Test manually:
```bash
curl -X POST https://karpo.studio/_functions/appInstanceEvent \
  -H "Content-Type: application/json" \
  -d '{"eventType":"MANUAL_TEST","instanceId":"test-999","appId":"aeb5e016-2505-4705-b39f-7724f4845fbd","appName":"Unified Orders Dashboard","timestamp":"2025-11-10T20:00:00Z","siteId":"test","siteUrl":"https://test.com","siteName":"Test","ownerEmail":"manual-test@example.com","ownerId":"test","planId":null,"planName":null,"isFree":true,"eventData":{},"eventMetadata":{}}'
```

Should return:
```json
{"success":true,"message":"Event recorded successfully","itemId":"..."}
```

Then check collection - should see test record!

### Check 2: Wait a Moment

Sometimes there's a 10-30 second delay. Wait a bit and refresh the collection.

### Check 3: Check App Permissions

1. Go to app dashboard
2. Click "Permissions"
3. Verify you have:
   - ✅ **Manage Your App**
   - ✅ **Read Site Owner Email**

If missing, add them, then:
```bash
npm run release  # Create new version
# Reinstall app
```

### Check 4: View Logs (Later)

Logs might take 5-10 minutes to become available after release:
```bash
# Try again later
npm run logs -- --version 4.0.0
```

## 🎯 Expected Results

✅ **Success looks like:**
- New record in AppInstallations collection
- Record has your email address
- Record has eventType: "APP_INSTALLED"
- Record has all site information

❌ **Failure looks like:**
- No new record appears
- Collection is empty
- No logs showing event

## 🐛 Debug Commands

If it's not working:

```bash
# 1. Verify event file exists
ls -la src/backend/events/appInstanceEvents.ts

# 2. Test portfolio endpoint
curl https://karpo.studio/_functions/appInstanceEvent
# Should return: {"success":true,"message":"App Instance Event endpoint is working!"...}

# 3. Check app version
cat package.json | grep version

# 4. Try manual insert test
curl -X POST https://karpo.studio/_functions/appInstanceEvent \
  -H "Content-Type: application/json" \
  -d '{"eventType":"DEBUG_TEST","instanceId":"debug-123","appId":"aeb5e016-2505-4705-b39f-7724f4845fbd","appName":"Debug Test","timestamp":"2025-11-10T20:00:00Z","siteId":"debug","siteUrl":"https://debug.com","siteName":"Debug","ownerEmail":"debug@test.com","ownerId":"debug","planId":null,"planName":null,"isFree":true,"eventData":{},"eventMetadata":{}}'
```

## 📊 Collection Check

Go to: https://karpo.studio → CMS → AppInstallations

**Filter by:**
- appName = "Unified Orders Dashboard"
- Sort by: _createdDate (descending)

The newest record should be your install!

## ✨ Testing Other Events

Once install works, test removal:

1. Uninstall the app
2. Check collection
3. Should see new record with:
   - eventType: "APP_REMOVED"
   - Same instanceId as install
   - Your email

## 🎉 Success Criteria

You'll know it's working when:

1. ✅ Install app → New record appears
2. ✅ Record has your email
3. ✅ Uninstall app → Another record appears with "APP_REMOVED"
4. ✅ All 8 event types work (install, remove, plan changes, etc.)

---

**Start now: Install version 4.0.0 and check your collection!** 🚀
