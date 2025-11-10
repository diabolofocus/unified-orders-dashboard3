# AppInstallations Collection Schema

## Complete Field List for ALL Event Types

Update your **AppInstallations** collection in karpo.studio with these fields:

### Event Information (All Events)
| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `eventType` | Text | Type of event (APP_INSTALLED, etc.) | ✅ Yes |
| `eventDescription` | Text | Human-readable event description | ✅ Yes |
| `eventTimestamp` | Date & Time | When the event occurred | ✅ Yes |
| `installMessage` | Text | Summary message for display | ✅ Yes |

### App Information (All Events)
| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `appDefId` | Text | App ID (GUID) | ✅ Yes |
| `appName` | Text | Name of the app | ✅ Yes |
| `instanceId` | Text | App instance ID (GUID) | ✅ Yes |
| `originInstanceId` | Text | Origin instance (APP_INSTALLED only) | No |

### Site Information (APP_INSTALLED and Plan Events)
| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `siteId` | Text | Wix site ID | No |
| `siteUrl` | Text | Site URL | No |
| `siteName` | Text | Site display name | No |

### Owner Information (APP_INSTALLED and Plan Events)
| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `userEmail` | Text | Site owner's email address | No |
| `ownerId` | Text | Owner/site ID | No |

### Plan Information (Plan Events)
| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `vendorProductId` | Text | Plan/product ID | No |
| `cycle` | Text | Payment cycle (MONTHLY, YEARLY, etc.) | No |
| `operationTimestamp` | Date & Time | When plan operation occurred | No |
| `expiresOn` | Date & Time | Plan expiration date | No |

### Purchase/Change Information (Purchase and Change Events)
| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `couponName` | Text | Coupon applied to purchase | No |
| `invoiceId` | Text | Invoice ID | No |
| `previousVendorProductId` | Text | Previous plan ID (PAID_PLAN_CHANGED) | No |
| `previousCycle` | Text | Previous cycle (PAID_PLAN_CHANGED) | No |

### Cancellation Information (AUTO_RENEWAL_CANCELLED)
| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `cancelReason` | Text | System cancel reason | No |
| `userReason` | Text | User-provided cancel reason | No |
| `subscriptionCancellationType` | Text | Type of cancellation | No |
| `cancelledDuringFreeTrial` | Text | DURING_FREE_TRIAL or NOT_DURING_FREE_TRIAL | No |

### Reactivation Information (PLAN_REACTIVATED)
| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `reactivationReason` | Text | Reason for reactivation (AUTO_RENEW_TURNED_ON) | No |

### Identity Information (All Events)
| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `identityType` | Text | Type of identity (WIX_USER, MEMBER, etc.) | No |
| `wixUserId` | Text | Wix user ID (site owner) | No |
| `memberId` | Text | Member ID (if applicable) | No |

### Debug Information (All Events)
| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `rawEventData` | Text | Full event.data JSON string | No |
| `rawMetadata` | Text | Full metadata JSON string | No |

## Quick Setup Instructions

### In Wix CMS (karpo.studio):

1. Go to **CMS** → **AppInstallations** collection
2. Click **Manage Fields**
3. Add all fields listed above with matching types
4. Set **Permissions**:
   - Read: Anyone
   - Create: Anyone (for HTTP function)
   - Update: Admin only
   - Delete: Admin only

### Field Types Mapping:
- **Text** = Text field (for all string values, GUIDs, enum values)
- **Date & Time** = Date field (for timestamps)
- **Required** = Check "Required" only for the 4 core event fields

## Event-Specific Field Usage

### APP_INSTALLED
**Populated**: eventType, eventDescription, eventTimestamp, appDefId, appName, instanceId, siteId, siteUrl, siteName, userEmail, ownerId, identityType, wixUserId, originInstanceId, rawEventData, rawMetadata

**Null**: All plan-related, cancellation, and reactivation fields

### APP_REMOVED
**Populated**: eventType, eventDescription, eventTimestamp, appDefId, appName, instanceId, identityType, wixUserId, rawEventData, rawMetadata

**Null**: siteId, siteUrl, siteName, userEmail, ownerId (app already uninstalled, can't fetch data), all plan fields

### PAID_PLAN_PURCHASED
**Populated**: eventType, eventDescription, eventTimestamp, appDefId, appName, instanceId, siteId, siteUrl, siteName, userEmail, ownerId, vendorProductId, cycle, operationTimestamp, expiresOn, couponName, invoiceId, identityType, wixUserId, rawEventData, rawMetadata

**Null**: previousVendorProductId, previousCycle, cancellation fields, reactivationReason

### PAID_PLAN_CHANGED
**Populated**: eventType, eventDescription, eventTimestamp, appDefId, appName, instanceId, siteId, siteUrl, siteName, userEmail, ownerId, vendorProductId, cycle, operationTimestamp, previousVendorProductId, previousCycle, couponName, invoiceId, identityType, wixUserId, rawEventData, rawMetadata

**Null**: expiresOn, cancellation fields, reactivationReason

### PLAN_CONVERTED_TO_PAID
**Populated**: eventType, eventDescription, eventTimestamp, appDefId, appName, instanceId, siteId, siteUrl, siteName, userEmail, ownerId, vendorProductId, cycle, operationTimestamp, expiresOn, identityType, wixUserId, rawEventData, rawMetadata

**Null**: couponName, invoiceId, previousVendorProductId, previousCycle, cancellation fields, reactivationReason

### PAID_PLAN_AUTO_RENEWAL_CANCELLED
**Populated**: eventType, eventDescription, eventTimestamp, appDefId, appName, instanceId, siteId, siteUrl, siteName, userEmail, ownerId, vendorProductId, cycle, operationTimestamp, cancelReason, userReason, subscriptionCancellationType, cancelledDuringFreeTrial, identityType, wixUserId, rawEventData, rawMetadata

**Null**: expiresOn, couponName, invoiceId, previousVendorProductId, previousCycle, reactivationReason

### PLAN_REACTIVATED
**Populated**: eventType, eventDescription, eventTimestamp, appDefId, appName, instanceId, siteId, siteUrl, siteName, userEmail, ownerId, vendorProductId, cycle, operationTimestamp, expiresOn, invoiceId, reactivationReason, identityType, wixUserId, rawEventData, rawMetadata

**Null**: couponName, previousVendorProductId, previousCycle, all cancellation fields

### PLAN_TRANSFERRED
**Populated**: eventType, eventDescription, eventTimestamp, appDefId, appName, instanceId, siteId, siteUrl, siteName, userEmail, ownerId, vendorProductId, cycle, operationTimestamp, invoiceId, identityType, wixUserId, rawEventData, rawMetadata

**Null**: expiresOn, couponName, previousVendorProductId, previousCycle, cancellation fields, reactivationReason

## Important Notes

1. **APP_REMOVED has no email/site details**: The app is already uninstalled when this event fires, so we can't fetch the site owner's email or site details.

2. **Use wixUserId for tracking**: Even for APP_REMOVED, you get `wixUserId` from metadata, which is the Wix user ID (site owner). You can use this to track which user uninstalled.

3. **Plan events have full details**: All plan-related events (purchase, change, cancellation, etc.) include full site and owner information because the app is still installed.

4. **rawEventData and rawMetadata**: These contain the complete JSON payloads for debugging and can help if you need additional fields in the future.

## Total Fields: 34 fields

All fields except the 4 core event fields should be **optional/nullable** since different events populate different fields.
