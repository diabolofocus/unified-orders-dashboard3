# Where to Delete the Webhook - Visual Guide

## The Error You're Seeing

```
Error loading function from web module backend/http-functions.js:
function 'use_appInstall' not found
```

**Translation:** Your app has an old webhook configured that's trying to call a function that doesn't exist.

---

## Where to Delete It

### Step-by-Step with Screenshots

#### 1. Go to Your App Dashboard
URL: https://manage.wix.com/account/custom-apps

You'll see a list of your apps.

#### 2. Click on "Unified Orders Dashboard"
This opens your app's dashboard.

#### 3. Look at the Left Sidebar
You'll see menu items like:
- Overview
- OAuth
- Permissions
- **Webhooks** ← CLICK THIS
- Extensions
- etc.

#### 4. Click "Webhooks"
This shows all configured webhooks for your app.

#### 5. You'll See Something Like:
```
Webhooks (1)

[Webhook Name]
App Instance Installed
Event: wix.app_instance.v1.instance_installed
URL: https://karpo.studio/_functions/...
Status: Active
```

#### 6. Click on That Webhook
This opens the webhook details.

#### 7. Look for a Button
You'll see buttons like:
- Edit
- **Delete** or **Unsubscribe** ← CLICK THIS
- View Logs

#### 8. Confirm Deletion
A dialog will ask "Are you sure?"
- Click **"Yes, Delete"** or **"Confirm"**

#### 9. Verify It's Gone
The webhooks list should now be empty or show:
```
Webhooks (0)
No webhooks configured
```

---

## Alternative: If You See Multiple Webhooks

Delete ALL of them, especially:
- ❌ App Instance Installed
- ❌ App Installed
- ❌ App Instance Created
- ❌ Any webhook with "install" in the name
- ❌ Any webhook pointing to `karpo.studio`

**Why?** The new system doesn't use webhooks at all. They're not needed and cause conflicts.

---

## What If I Don't See Any Webhooks?

If the Webhooks page shows:
```
Webhooks (0)
No webhooks configured
```

Then the problem is something else. Check:

### Option A: Portfolio Function Missing
Your portfolio site might not have the `post_appInstanceEvent` function.

**Fix:** Add this to karpo.studio's `backend/http-functions.js`:
```javascript
export async function post_appInstanceEvent(request) {
    // Copy code from PORTFOLIO_HTTP_FUNCTION.js
}
```

### Option B: Wrong Endpoint in Code
Check `src/backend/events/appInstanceEvents.ts` line 4:
```typescript
const PORTFOLIO_WEBHOOK_URL = 'https://karpo.studio/_functions/appInstanceEvent';
```

Should be `appInstanceEvent` not `appInstall` or `use_appInstall`.

### Option C: Old Code Still Deployed
**Fix:** Rebuild and release:
```bash
npm run build
npm run release
```

---

## After Deleting the Webhook

1. **Rebuild your app:**
   ```bash
   npm run build
   npm run release
   ```

2. **Test by reinstalling:**
   - Uninstall app from test site
   - Reinstall app
   - Check AppInstallations collection

3. **Check logs:**
   ```bash
   npm run logs
   ```
   Should see:
   ```
   === APP_INSTALLED EVENT ===
   Sending to portfolio: {...}
   Portfolio response (200): {"success": true}
   ```

---

## Common Questions

### Q: Will deleting the webhook break my app?
**A:** No! The new system uses event extensions (in your code), not webhooks. Deleting the webhook actually FIXES the app.

### Q: Do I need to create a new webhook?
**A:** No! Event extensions work automatically. No webhook configuration needed.

### Q: What if I had other webhooks configured?
**A:** You can delete them all. The new system handles ALL events (install, remove, plan changes, etc.) automatically through event extensions.

### Q: Can I test without deleting the webhook?
**A:** No. The webhook is causing the error. You must delete it to proceed.

---

## Visual Checklist

```
[1] Open https://manage.wix.com/account/custom-apps
    ↓
[2] Click "Unified Orders Dashboard"
    ↓
[3] Click "Webhooks" in left sidebar
    ↓
[4] See list of webhooks (if any)
    ↓
[5] Click on each webhook
    ↓
[6] Click "Delete" or "Unsubscribe"
    ↓
[7] Confirm deletion
    ↓
[8] Verify "Webhooks (0)"
    ↓
[9] Run: npm run build && npm run release
    ↓
[10] Reinstall app on test site
    ↓
[11] SUCCESS! ✅
```

---

## Need More Help?

If you can't find the Webhooks page or don't see any webhooks:

1. Take a screenshot of your app dashboard
2. Run: `curl https://karpo.studio/_functions/appInstanceEvent`
3. Share the output
4. Check your portfolio's `http-functions.js` file

The issue is likely in the portfolio site setup, not the app itself.
