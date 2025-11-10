# IMMEDIATE FIX - Error: "function 'use_appInstall' not found"

## What's Happening

Your portfolio site (karpo.studio) is trying to load a function called `use_appInstall` but it doesn't exist.

**This is because:** You have an **old webhook subscription** configured in your Wix App Dashboard.

---

## Fix in 3 Steps (5 minutes)

### 🔴 Step 1: Delete the Webhook (MOST IMPORTANT)

1. Open in browser: https://manage.wix.com/account/custom-apps
2. Click on **"Unified Orders Dashboard"**
3. In the left sidebar, click **"Webhooks"**
4. You'll see a webhook for "App Instance Installed" or similar
5. Click on it, then click **"Delete"** or **"Unsubscribe"**
6. Confirm the deletion

**THIS IS THE KEY STEP!** The webhook is causing the error.

---

### ✅ Step 2: Rebuild Your App

```bash
cd /Users/guillaume/Desktop/unified-orders-dashboard
npm run build
npm run release
```

Follow the prompts to create a new version.

---

### ✅ Step 3: Test

1. Uninstall the app from your test site
2. Reinstall it
3. Check your AppInstallations collection in karpo.studio
4. You should see a new record with the user's email! 🎉

---

## Why This Happened

### The Old Way (What's Breaking)
```
Wix Webhook in Dashboard
    ↓
Tries to call karpo.studio/_functions/use_appInstall
    ↓
❌ Function doesn't exist
    ↓
ERROR!
```

### The New Way (What Should Happen)
```
Event extension in your code
    ↓
Automatically triggers on events
    ↓
Calls karpo.studio/_functions/appInstanceEvent
    ↓
✅ Saves data to collection
```

---

## Checklist

- [ ] Go to Wix App Dashboard → Webhooks
- [ ] Delete ALL webhooks (especially "App Instance Installed")
- [ ] Run `npm run build`
- [ ] Run `npm run release`
- [ ] Uninstall app from test site
- [ ] Reinstall app
- [ ] Check AppInstallations collection for new record

---

## What If I Can't Find the Webhook?

If you don't see any webhooks in the dashboard, the issue might be:

1. **Portfolio function not added:** Make sure you added the `post_appInstanceEvent` function to karpo.studio
2. **Wrong endpoint name:** The function should be `post_appInstanceEvent` not `use_appInstall`
3. **App not rebuilt:** Make sure you ran `npm run build && npm run release`

---

## Quick Test

After fixing, test the portfolio endpoint:

```bash
curl https://karpo.studio/_functions/appInstanceEvent
```

Should return:
```json
{
  "success": true,
  "message": "App Instance Event endpoint is working!",
  "supportedEvents": [...]
}
```

---

## Still Getting the Error?

Share the following info:
1. Screenshot of Webhooks page in Wix App Dashboard
2. Result of: `curl https://karpo.studio/_functions/appInstanceEvent`
3. Content of your portfolio's `http-functions.js` file (first 50 lines)

---

**Bottom line:** Delete the webhook from the app dashboard. That's 99% of the fix! 🔥
