# Quick Cleanup and Deploy Guide

## The Problem

You're getting: `function 'use_appInstall' not found`

**This means:** There's an old webhook configured in your Wix App Dashboard that needs to be removed.

---

## 5-Minute Fix

### Step 1: Remove Old Webhooks (2 minutes)

1. Open: https://manage.wix.com/account/custom-apps
2. Select "Unified Orders Dashboard"
3. Click "Webhooks" in sidebar
4. **DELETE ALL WEBHOOKS** (especially any pointing to karpo.studio)
5. Confirm deletions

**Why?** The new system uses event extensions, not webhooks. Old webhooks cause conflicts.

---

### Step 2: Clean Up Old Event Files (30 seconds)

In your terminal:
```bash
cd /Users/guillaume/Desktop/unified-orders-dashboard

# Delete old event files
rm src/backend/events/appInstalled.ts
rm src/backend/events/event.ts

# Confirm only the new file exists
ls src/backend/events/
# Should only show: appInstanceEvents.ts
```

---

### Step 3: Rebuild and Deploy (2 minutes)

```bash
# Build the app
npm run build

# Release new version
npm run release
```

Follow the prompts to create a new app version.

---

### Step 4: Test (30 seconds)

1. Go to a test Wix site
2. **Uninstall** the app (if installed)
3. **Reinstall** the app
4. Check karpo.studio AppInstallations collection
5. You should see a new record! 🎉

---

## What Changed?

### Before (Old System) ❌
- Used webhooks configured in dashboard
- Required JWT decoding
- Had `use_appInstall` function
- Only captured installs
- Unreliable

### After (New System) ✅
- Uses native event extensions
- No webhook config needed
- Has `appInstanceEvent` function
- Captures all 8 events
- Reliable

---

## File Checklist

### In Your Wix App
- ✅ KEEP: `src/backend/events/appInstanceEvents.ts`
- ❌ DELETE: `src/backend/events/appInstalled.ts`
- ❌ DELETE: `src/backend/events/event.ts`

### In Your Portfolio (karpo.studio)
- ✅ ADD: `post_appInstanceEvent()` function
- ✅ ADD: `options_appInstanceEvent()` function
- ✅ ADD: `get_appInstanceEvent()` function
- ❌ OPTIONAL DELETE: `post_appInstall()` (old)
- ❌ OPTIONAL DELETE: `post_updateInstallEmail()` (old)

---

## Quick Commands

```bash
# 1. Clean up
rm src/backend/events/appInstalled.ts src/backend/events/event.ts

# 2. Verify clean
ls src/backend/events/
# Should show only: appInstanceEvents.ts

# 3. Build
npm run build

# 4. Release
npm run release

# 5. Check logs after reinstalling app
npm run logs
```

---

## Expected Log Output

After reinstalling the app, you should see in `npm run logs`:

```
=== APP_INSTALLED EVENT ===
Event data: {...}
Metadata: {...}
Sending to portfolio: {...}
Portfolio response (200): {"success": true, ...}
```

And in your portfolio AppInstallations collection:
```javascript
{
  eventType: "APP_INSTALLED",
  userEmail: "user@example.com", // ← The email!
  appName: "Unified Orders Dashboard",
  siteUrl: "https://...",
  // ... more data
}
```

---

## Still Getting Errors?

### If you see: "function 'use_appInstall' not found"
→ You didn't delete the webhooks from the dashboard. Go to Step 1.

### If you see: "Cannot find module"
→ Run `npm install` then `npm run build`

### If nothing shows in logs
→ Make sure you rebuilt and released: `npm run build && npm run release`

### If portfolio returns 404
→ Make sure you added the `post_appInstanceEvent` function to karpo.studio

---

## Success Checklist

After following these steps:

- [ ] All webhooks deleted from app dashboard
- [ ] Old event files deleted
- [ ] New version built and released
- [ ] App reinstalled on test site
- [ ] No "use_appInstall" error
- [ ] New record in AppInstallations collection
- [ ] Record contains user email

---

## Next Steps

Once working:
1. Test other events (remove app, upgrade plan, etc.)
2. All should appear in AppInstallations collection
3. You now have complete lifecycle tracking! 🎉
