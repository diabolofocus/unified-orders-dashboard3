# Quick Start: Enabling Free Trial & Premium Plans

## 5-Minute Setup Guide

### Step 1: Configure Wix Dashboard (5 minutes)

1. Go to [dev.wix.com](https://dev.wix.com)
2. Select your app: **Unified Orders Dashboard**
3. Click **Pricing** in the left sidebar

### Step 2: Enable Free Trial

```
☐ Click "Business Model" dropdown
☐ Select "Premium" or "Freemium"
☐ Toggle "Free Trial" to ON
☐ Set duration: 14 days
☐ Click "Save"
```

### Step 3: Create Your First Plan

```
☐ Click "Add Plan"
☐ Choose "Recurring (Monthly)"
☐ Set price: $19.99/month
☐ Add plan name: "Starter"
☐ Add 4 benefits:
   - Advanced order analytics
   - Real-time notifications
   - Per-item fulfillment
   - Email support
☐ Click "Add Plan"
☐ Toggle "Visible" to ON
☐ Click "Save"
```

### Step 4: Configure Pricing Page

```
☐ Click "Pricing Page" tab
☐ Select "Wix pricing page"
☐ Click "Customize Pricing Page"
☐ Choose "Starter" as recommended plan
☐ Add features for comparison
☐ Click "Save"
```

### Step 5: Test It!

```
☐ Click "Test Your App"
☐ Select "App Market"
☐ Click "Add to Site" on a test site
☐ You should see the free trial banner!
☐ Click "Start Free Trial" to test upgrade flow
```

## What Happens Automatically

Once you complete the setup above:

✅ Free trial banner appears automatically for free users
✅ Banner shows countdown for trial users
✅ Banner hides for premium users
✅ Upgrade button directs to your pricing page
✅ All premium status checks work correctly

## Quick Reference: Plan Status

| User Type | Banner Shown? | Message |
|-----------|---------------|---------|
| Free user | ✅ Yes | "Start your 14-day free trial" |
| Trial user (Day 1-13) | ✅ Yes | "X days left in your free trial" |
| Trial user (Day 14) | ✅ Yes | "Your free trial ends today" |
| Paid user | ❌ No | (Banner hidden) |

## Using Premium Checks in Code

### Quick Check in Component

```tsx
import { observer } from 'mobx-react-lite';
import { rootStore } from '../stores/RootStore';

const MyComponent = observer(() => {
  const { promoBannerStore } = rootStore;

  if (!promoBannerStore.appInstanceInfo?.hasPremiumPlan) {
    return <div>Upgrade to premium to access this feature</div>;
  }

  return <div>Premium content here</div>;
});
```

### Quick Check in Backend

```typescript
import { auth } from '@wix/essentials';
import { appInstances } from '@wix/app-management';

export const myMethod = webMethod(Permissions.Admin, async () => {
  const getInstance = auth.elevate(appInstances.getAppInstance);
  const { instance } = await getInstance();

  const hasPremium = !instance?.isFree ||
    instance?.billing?.freeTrialInfo?.status === 'IN_PROGRESS';

  if (!hasPremium) {
    throw new Error('Premium required');
  }

  // Your premium logic
});
```

## Adding Banner to Other Pages

```tsx
import { FreeTrialBanner } from '../../components/PromoBanner/FreeTrialBanner';

// Just add this component anywhere
<FreeTrialBanner />
```

It automatically:
- Shows/hides based on user's plan
- Displays correct message
- Handles loading states
- Links to upgrade page

## Testing Checklist

```
☐ Free user sees banner
☐ Banner has "Start Free Trial" button
☐ Clicking button redirects to Wix pricing page
☐ After starting trial, banner shows countdown
☐ After purchasing, banner disappears
☐ Premium features are accessible to paid users
☐ Premium features are blocked for free users
```

## Common Issues

**Banner not showing?**
- Clear browser cache
- Check console for errors
- Verify pricing is configured in Wix dashboard

**Upgrade button not working?**
- Check pricing page is set up in dashboard
- Verify app has correct permissions
- Look for errors in browser console

**Banner not hiding for paid users?**
- Check that plan has `packageName` in API response
- Verify billing information is present
- Try hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

## Need More Details?

📖 **PRICING_SETUP.md** - Complete setup guide
📖 **FREE_TRIAL_IMPLEMENTATION_SUMMARY.md** - Technical implementation details

## Support

Having issues? Check:
1. Browser console for errors
2. Wix dashboard pricing configuration
3. Network tab for API calls
4. Full documentation in PRICING_SETUP.md

---

**That's it! Your free trial is ready to go.** 🎉

Once you configure the pricing in Wix dashboard, everything else happens automatically. The banner will show for free users and guide them to upgrade to your premium plan.
