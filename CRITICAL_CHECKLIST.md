# CRITICAL CHECKLIST - Why Events Aren't Working

## ❓ Most Important Questions

### 1. Did you run `npm run release`?
**Event extensions ONLY work in released versions!**

If you just ran `npm run build`, that's NOT enough. You MUST run:
```bash
npm run release
```

### 2. Are you installing the RELEASED version?
Don't install from:
- ❌ Development preview
- ❌ `npm run dev` mode
- ❌ Old installed version

DO install from:
- ✅ App dashboard install URL (after release)
- ✅ Direct install link from dashboard
- ✅ Fresh install after running `npm run release`

### 3. Are you watching logs DURING install?
```bash
# Terminal 1 - Start this BEFORE installing
npm run logs

# Keep it open and watch while you install!
```

## 🔍 Quick Diagnostic

Run these commands to check your status:

```bash
# 1. Check if event file exists in correct location
ls -la src/backend/events/appInstanceEvents.ts

# 2. Check last build time
ls -la dist/

# 3. Try to release NOW
npm run release
```

## 📋 Step-by-Step Fix

### Step 1: Release the App Right Now
```bash
cd /Users/guillaume/Desktop/unified-orders-dashboard
npm run release
```

**Follow the prompts:**
- Version: Use `1.0.1` or increment current
- Description: "Added event extensions for lifecycle tracking"
- Confirm: Yes

**Wait for:** "Successfully created version X.X.X"

### Step 2: Get the Install URL

After release completes:
1. Go to: https://manage.wix.com/account/custom-apps
2. Click "Unified Orders Dashboard"
3. Look for "App URL" or "Installation URL"
4. Copy it

Example: `https://www.wix.com/installer/install?appId=aeb5e016-2505-4705-b39f-7724f4845fbd`

### Step 3: Uninstall Existing App

On your test site:
1. Go to Settings → Apps
2. Find "Unified Orders Dashboard"
3. Click "Uninstall"
4. Confirm

### Step 4: Start Log Monitoring

**BEFORE installing, in terminal:**
```bash
npm run logs
```

Keep this terminal visible!

### Step 5: Install Released Version

1. Use the install URL from Step 2
2. Install on your test site
3. **WATCH the logs terminal immediately!**

### Step 6: Check Results

**Expected in logs:**
```
=== APP_INSTALLED EVENT ===
Event data: {
  "metadata": {"instanceId": "..."},
  "entity": {...}
}
Sending to portfolio: {
  "eventType": "APP_INSTALLED",
  "ownerEmail": "your-email@example.com"
}
Portfolio response (200): {"success": true}
```

**Expected in collection:**
1. Go to karpo.studio
2. CMS → AppInstallations
3. Should see new record with your email!

## 🚨 If Logs Show NOTHING

If `npm run logs` shows absolutely nothing during install, it means:

### Option A: You're Not Using Released Version
→ Run `npm run release` again
→ Make sure you use the install URL from dashboard
→ Uninstall old version first

### Option B: Event Extension Not Registered
Check file location:
```bash
ls -la src/backend/events/
# Should show: appInstanceEvents.ts (NOT in subfolder!)
```

If it's in a subfolder like `my-event/`, move it:
```bash
mv src/backend/events/*/appInstanceEvents.ts src/backend/events/
rm -rf src/backend/events/my-event/
```

Then rebuild and release:
```bash
npm run build
npm run release
```

### Option C: Missing Permissions
1. Go to app dashboard
2. Click "Permissions"
3. Add:
   - "Manage Your App"
   - "Read Site Owner Email"
4. Save
5. Run `npm run release` again

## 🎯 Expected Timeline

```
1. npm run release         [Takes 1-2 min]
2. Copy install URL        [Takes 10 sec]
3. Uninstall old version   [Takes 20 sec]
4. npm run logs (open)     [Instant]
5. Install using URL       [Takes 30 sec]
6. Event triggers          [Instant - shows in logs]
7. Portfolio receives      [Within 1 sec]
8. Record created          [Within 1 sec]
9. Check collection        [See it immediately]
```

**Total time: ~3-4 minutes**

## ✅ Verification Commands

After install, run these to verify:

```bash
# Check logs (should show event)
npm run logs

# Test portfolio endpoint directly
curl -X POST https://karpo.studio/_functions/appInstanceEvent \
  -H "Content-Type: application/json" \
  -d '{"eventType":"TEST","instanceId":"verify-endpoint","appId":"aeb5e016-2505-4705-b39f-7724f4845fbd","appName":"Test","timestamp":"2025-11-10T20:00:00Z","siteId":"test","siteUrl":"https://test.com","siteName":"Test","ownerEmail":"verify@test.com","ownerId":"test","planId":null,"planName":null,"isFree":true,"eventData":{},"eventMetadata":{}}'

# Should return: {"success":true,"message":"Event recorded successfully"...}
```

## 🔧 Debug Output

Share this output if still not working:

```bash
echo "=== App Version ==="
cat package.json | grep version

echo "=== Event File Location ==="
ls -la src/backend/events/

echo "=== Last Build ==="
ls -lt dist/ | head -5

echo "=== Portfolio Endpoint Test ==="
curl https://karpo.studio/_functions/appInstanceEvent

echo "=== Logs Sample ==="
npm run logs
# Then install and capture output
```

---

**Start here: Run `npm run release` NOW!** 🚀
