# Troubleshooting: Event Capture Not Working

## Error: "function 'use_appInstall' not found"

### Problem
The error shows:
```
Error loading function from web module backend/http-functions.js:
function 'use_appInstall' not found
```

This means:
1. ❌ There's a **webhook subscription** in your Wix App Dashboard
2. ❌ That webhook is looking for `use_appInstall` function in your portfolio
3. ❌ But the new system uses **event extensions** (not webhooks)

### Why This Happened
You had an **old webhook-based system** configured in the Wix App Dashboard that was trying to call your portfolio site's `use_appInstall` function.

The **new system uses event extensions** which don't require webhook configuration in the dashboard - they work automatically!

---

## Solution: Remove Old Webhook Subscription

### Step 1: Go to Your App Dashboard

1. Go to: https://manage.wix.com/account/custom-apps
2. Select "Unified Orders Dashboard"
3. Click **"Webhooks"** in the left menu

### Step 2: Check for Existing Webhooks

Look for any webhooks like:
- ❌ "App Instance Installed"
- ❌ "App Installed"
- ❌ Any webhook pointing to `karpo.studio/_functions/appInstall`
- ❌ Any webhook pointing to `karpo.studio/_functions/use_appInstall`

### Step 3: Delete Those Webhooks

1. Click on each old webhook
2. Click **"Delete"** or **"Unsubscribe"**
3. Confirm deletion

**Why?** The new event extensions handle everything automatically. Old webhooks will conflict with the new system.

---

## How the New System Works

### Old System (Webhooks - Don't Use This)
```
Wix Dashboard Webhook Config
    ↓
Sends JWT to portfolio endpoint
    ↓
Portfolio decodes and saves
```

### New System (Event Extensions - Use This) ✅
```
Event occurs (install/remove/etc)
    ↓
Event extension automatically triggered
    ↓
Sends data to portfolio endpoint
    ↓
Portfolio saves to collection
```

**Key difference:** Event extensions don't require webhook configuration in the dashboard!

---

## Verification Steps

### Step 1: Remove Webhooks from Dashboard
✅ Delete all webhooks pointing to your portfolio site

### Step 2: Check Your App Files
✅ Make sure `src/backend/events/appInstanceEvents.ts` exists
✅ Delete old files: `appInstalled.ts` and `event.ts`

### Step 3: Rebuild & Redeploy
```bash
# Make sure old event files are deleted
rm src/backend/events/appInstalled.ts 2>/dev/null
rm src/backend/events/event.ts 2>/dev/null

# Build and release
npm run build
npm run release
```

### Step 4: Install Portfolio HTTP Function

Make sure your portfolio site has the new endpoint:

**In karpo.studio/backend/http-functions.js**, add:

```javascript
export async function post_appInstanceEvent(request) {
    // ... (code from PORTFOLIO_HTTP_FUNCTION.js)
}

export function options_appInstanceEvent(request) {
    // ... (code from PORTFOLIO_HTTP_FUNCTION.js)
}

export function get_appInstanceEvent(request) {
    // ... (code from PORTFOLIO_HTTP_FUNCTION.js)
}
```

**Important:** The endpoint should be `appInstanceEvent` (not `appInstall` or `use_appInstall`)

### Step 5: Remove Old Portfolio Functions (Optional)

You can now safely remove these old functions from your portfolio:
```javascript
// DELETE THESE:
export async function post_appInstall(request) { ... }
export async function post_updateInstallEmail(request) { ... }
```

### Step 6: Test the New System

1. **Uninstall** the app from your test site (if installed)
2. **Reinstall** the app
3. Check your portfolio's **AppInstallations** collection
4. You should see a new record with:
   - `eventType: "APP_INSTALLED"`
   - `userEmail: "user@example.com"` ← The email!
   - All other data populated

---

## Still Not Working?

### Check 1: Portfolio Endpoint is Accessible
```bash
curl https://karpo.studio/_functions/appInstanceEvent

# Should return:
# {"success":true,"message":"App Instance Event endpoint is working!"...}
```

### Check 2: Event File Exists
```bash
ls src/backend/events/appInstanceEvents.ts
# Should show the file
```

### Check 3: Old Event Files are Deleted
```bash
ls src/backend/events/
# Should NOT show: appInstalled.ts or event.ts
```

### Check 4: App is Rebuilt and Released
```bash
npm run build
npm run release
# Follow the prompts
```

### Check 5: Check Wix CLI Logs
```bash
npm run logs
# Look for:
# - "=== APP_INSTALLED EVENT ==="
# - "Sending to portfolio:"
# - "Portfolio response (200):"
```

### Check 6: Check Portfolio Logs
In your portfolio site dashboard:
1. Go to Site Logs
2. Filter for errors
3. Look for successful POST to `appInstanceEvent`

---

## Common Mistakes

### ❌ Mistake 1: Old Webhook Still Configured
**Problem:** Webhook in dashboard trying to call old endpoint
**Solution:** Delete all webhooks from app dashboard

### ❌ Mistake 2: Wrong Portfolio Endpoint Name
**Problem:** Using `use_appInstall` or `appInstall` instead of `appInstanceEvent`
**Solution:** Update portfolio function name to `post_appInstanceEvent`

### ❌ Mistake 3: Old Event Files Not Deleted
**Problem:** Multiple event handlers conflicting
**Solution:** Delete `appInstalled.ts` and `event.ts`

### ❌ Mistake 4: App Not Rebuilt After Changes
**Problem:** Running old version of the app
**Solution:** Run `npm run build && npm run release`

### ❌ Mistake 5: Collection Schema Not Updated
**Problem:** Database insert fails due to missing fields
**Solution:** Add all required fields to AppInstallations collection (see QUICK_START.md)

---

## Debug Checklist

- [ ] Removed all webhooks from Wix App Dashboard
- [ ] Deleted old event files (appInstalled.ts, event.ts)
- [ ] Added portfolio HTTP function (post_appInstanceEvent)
- [ ] Updated AppInstallations collection schema
- [ ] Built and released app (npm run build && npm run release)
- [ ] Tested portfolio endpoint (curl https://karpo.studio/_functions/appInstanceEvent)
- [ ] Uninstalled and reinstalled app on test site
- [ ] Checked portfolio collection for new record
- [ ] Verified email is captured in record

---

## Success Indicators

You'll know it's working when:

✅ No webhook errors in portfolio logs
✅ App installs without errors
✅ AppInstallations collection gets new records
✅ Records contain user email
✅ All 8 event types are captured

---

## Need More Help?

1. Check CLI logs: `npm run logs`
2. Check portfolio site logs in Wix dashboard
3. Verify endpoint: `curl https://karpo.studio/_functions/appInstanceEvent`
4. Re-read [QUICK_START.md](QUICK_START.md) for setup steps
