# ⚡ IMMEDIATE TEST PROCEDURE

## ✅ Good News

Your event code IS in the current build:
- File: `dist/backend/assets/event.mjs` (3.4KB)
- Contains: APP_INSTALLED event handler
- Build time: Nov 10 21:14

## 🎯 The Problem

You need to release THIS build (the one with events) with a **NEW version number**.

## 🚀 DO THIS NOW

### Step 1: Release with the current build
```bash
npm run release
```

When prompted:
- Version: Enter `4.0.2` (or whatever is next after your last release)
- Description: "Event extensions now properly registered"

### Step 2: Get the version number you just entered
After release completes, note the exact version number.

### Step 3: Start monitoring logs
```bash
# Replace X.X.X with the version you just released
npm run logs -- --version X.X.X
```

**Keep this terminal open and visible!**

### Step 4: Install on test site

In your browser:
1. Go to your test site
2. Settings → Apps → Uninstall "Unified Orders Dashboard" (if installed)
3. Go to app dashboard: https://manage.wix.com/account/custom-apps
4. Click "Unified Orders Dashboard"
5. Copy the install URL or use "Test Your App"
6. Install it on your test site

### Step 5: Watch the logs terminal

**You should see within 1-2 seconds:**
```
=== APP_INSTALLED EVENT ===
Event data: {
  "metadata": {...}
}
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

### Step 6: Verify in collection

Go to https://karpo.studio:
1. CMS → AppInstallations
2. Look for newest record
3. Should have:
   - eventType: "APP_INSTALLED"
   - userEmail: "your-email@example.com"
   - appName: "Unified Orders Dashboard"
   - timestamp: just now

## ❌ If You See NOTHING in Logs

This means one of two things:

### Option A: Wrong version installed
- Check what version is shown in your test site (Settings → Apps)
- Make sure it matches the version in your `npm run logs` command
- You might have installed an old version by mistake

### Option B: Events not triggering (rare)
If logs show absolutely nothing, then there's a deeper issue. But this is unlikely given that:
- ✅ Event file is in correct location
- ✅ Event code is in build output
- ✅ Dependencies are installed

## 🐛 If Logs Show Errors

If you see errors in the logs like:
- "Permission denied" → Need to add "Manage Your App" permission
- "getAppInstance failed" → Need "Read Site Owner Email" permission
- Network errors → Check portfolio URL

Then we'll fix those specific issues.

## 📊 What to Share If It Still Doesn't Work

Run this command and share the output:
```bash
echo "=== Version Check ===" && \
cat package.json | grep version && \
echo -e "\n=== Event File Location ===" && \
ls -la src/backend/events/app-lifecycle/event.ts && \
echo -e "\n=== Event in Build ===" && \
ls -la dist/backend/assets/event.mjs && \
echo -e "\n=== Event Code Sample ===" && \
head -20 dist/backend/assets/event.mjs
```

This will help diagnose exactly what's happening.

---

## 💡 Key Point

The build you have RIGHT NOW (as of Nov 10 21:14) **has the events**. You just need to release it with a new version number and install THAT specific version.
