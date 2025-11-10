# Event Extension Troubleshooting - Final Diagnosis

## ✅ What Was Fixed

The event file structure is now **CORRECT**:
```
✅ src/backend/events/app-lifecycle/event.ts
```

The build output confirms events are included:
```
✅ dist/backend/assets/event.mjs (contains all event handlers)
```

## 🔍 Current Situation

You released a new version and installed it on a test site, but **no event was triggered**.

## 🚨 Critical Questions to Answer

### 1. What version number did you release?

When you ran `npm run release`, what version number did you enter?
- Check your app dashboard: https://manage.wix.com/account/custom-apps
- Look for the most recent version

### 2. Did you rebuild BEFORE releasing?

The sequence MUST be:
```bash
npm run build        # ← Did you run this?
npm run release      # ← Then this
```

If you only ran `npm run release` without `npm run build`, the old build (without events) was released.

## 🔧 Solution: Rebuild and Re-release

### Step 1: Clean rebuild
```bash
# Clean dist folder
rm -rf dist/

# Rebuild from scratch
npm run build
```

### Step 2: Verify events are in build
```bash
# This should show your event handlers
grep -r "APP_INSTALLED" dist/backend/
```

Expected output:
```
dist/backend/assets/event.mjs:... APP_INSTALLED ...
```

If you see **NO OUTPUT**, the events aren't being built. That means there's still a structural issue.

### Step 3: Release new version
```bash
npm run release
```

Enter a NEW version number (e.g., if you released 4.0.1, use 4.0.2)

### Step 4: Test with logs
```bash
# Use the exact version number you just released
npm run logs -- --version X.X.X
```

Keep this running, then install the app on a test site.

## 🐛 If Events STILL Don't Work

This means the Wix CLI is not recognizing the event extension. Possible causes:

### Cause 1: Missing dependencies
```bash
npm install @wix/app-management
```

### Cause 2: TypeScript errors preventing compilation
```bash
npm run typecheck
```

Fix any errors that appear.

### Cause 3: Event handler signature wrong

Check line 76 in `event.ts`. It MUST be:
```typescript
appInstances.onAppInstanceInstalled(async (event) => {
  await sendToPortfolio('APP_INSTALLED', event, event.metadata);
});
```

NOT:
```typescript
appInstances.onAppInstanceInstalled(async (event, metadata) => {
  // ❌ WRONG - two parameters
});
```

## 📊 Debugging Steps

### Check 1: Is the event file being imported?
```bash
# Check if event.ts is referenced in build output
cat dist/backend/getRegisteredExtensions.mjs | grep -i "event\|app-lifecycle"
```

### Check 2: Are there any build errors?
```bash
npm run build 2>&1 | grep -i error
```

### Check 3: Is the correct version installed?

After installing on test site:
1. Go to test site dashboard
2. Settings → Apps
3. Find "Unified Orders Dashboard"
4. Check version number matches what you released

### Check 4: Test portfolio endpoint directly
```bash
curl -X POST https://karpo.studio/_functions/appInstanceEvent \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "APP_INSTALLED",
    "instanceId": "test-manual-'$(date +%s)'",
    "appId": "aeb5e016-2505-4705-b39f-7724f4845fbd",
    "appName": "Unified Orders Dashboard",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "siteId": "test",
    "siteUrl": "https://test.com",
    "siteName": "Test",
    "ownerEmail": "test@example.com",
    "ownerId": "test",
    "planId": null,
    "planName": null,
    "isFree": true,
    "eventData": {},
    "eventMetadata": {}
  }'
```

Expected: `{"success":true,"itemId":"...","eventType":"APP_INSTALLED"}`

If this works but app install doesn't, the issue is with the event extension registration.

## 🎯 Most Likely Issue

Based on the fact that:
1. ✅ Event file structure is correct
2. ✅ Event code is in build output
3. ❌ But events don't trigger on install

**The most likely issue is: You released version 4.0.0 BEFORE we fixed the file structure.**

### Solution:
1. Run `npm run build` now (with the correct structure)
2. Run `npm run release` with a NEW version number (4.0.2)
3. Check logs with that new version: `npm run logs -- --version 4.0.2`
4. Install the NEW version on a test site

## 📝 Quick Verification Checklist

Before testing again, verify ALL of these:

```bash
# 1. Event file exists in correct location
ls -la src/backend/events/app-lifecycle/event.ts
# Should show the file

# 2. Event code is in build output
grep "APP_INSTALLED" dist/backend/assets/event.mjs
# Should show matches

# 3. No TypeScript errors
npm run typecheck
# Should show no errors

# 4. Portfolio endpoint works
curl https://karpo.studio/_functions/appInstanceEvent
# Should return success message

# 5. @wix/app-management is installed
npm list @wix/app-management
# Should show version number
```

If ALL 5 checks pass, the next release WILL work.

## 🚀 Final Test Procedure

1. **Clean build:**
   ```bash
   rm -rf dist/ && npm run build
   ```

2. **Release NEW version:**
   ```bash
   npm run release
   # Enter version: 4.0.2 (or next available)
   ```

3. **Start logs IMMEDIATELY:**
   ```bash
   npm run logs -- --version 4.0.2
   ```

4. **Install on test site:**
   - Uninstall old version first
   - Install new version using dashboard install URL

5. **Watch logs terminal:**
   - Should see: `=== APP_INSTALLED EVENT ===`
   - Should see: `Sending to portfolio: {...}`
   - Should see: `Portfolio response (200): {...}`

6. **Verify in collection:**
   - Go to karpo.studio
   - CMS → AppInstallations
   - Should see new record with your email

---

## 💡 What to Share

Please share:
1. What version number you released
2. Output of: `grep "APP_INSTALLED" dist/backend/assets/event.mjs`
3. Any errors from `npm run build`
4. Screenshot of the version installed on your test site
