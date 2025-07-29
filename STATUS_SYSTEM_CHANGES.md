# Offer Status System Implementation

## Overview
Implemented a status system for offer letter submissions with pending/approved workflow.

## Changes Made

### 1. Offer Upload (`src/features/OfferLetterUpload.js`)
- **Added `status: 'pending'`** to all new offer submissions
- **Updated success message** to inform users about pending review process
- New offers will appear on user profile with pending symbol until approved

### 2. Search Results (`src/features/SchoolsOffers.js`)
- **Filtered offers display** to only show approved offers
- Pending offers are hidden from search results
- Applied filtering for both logged-in users and guests
- Existing offers without status field are treated as approved (legacy support)

### 3. User Profile (`src/features/Profile.js`)
- **Added status column** to offers table
- **Pending symbol** (clock icon) for offers with `status: 'pending'`
- **Rejected symbol** (X icon) for offers with `status: 'rejected'`
- **Verified symbol** (checkmark icon) for approved offers or legacy offers
- **"Why?" link** for rejected offers leading to rejection reasons page
- **Remove button** (X) for rejected offers allowing users to delete them
- Hover tooltips show status information
- **Confirmation dialog** before removing rejected offers

### 4. Firestore Rules (`firestore.rules`)
- **Created basic admin access structure**
- Updated with actual admin UID: `JVk1ibuMDkhVqY5yF9JdCh1agNY2`
- Maintains existing user permissions

### 5. Rejection Reasons Page (`src/features/RejectionReasons.js`)
- **New dedicated page** explaining common rejection reasons
- **Categorized sections**: Document Quality, Information Issues, Privacy Concerns, Duplicates
- **Best practices guide** for ensuring offer approval
- **Contact support** option for appeals

## Status Logic

### New Offers
- All new submissions get `status: 'pending'`
- Appear on user profile with pending symbol
- Hidden from public search results
- Admin can approve by changing status to `'approved'`

### Rejected Offers
- Admin can reject offers by changing status to `'rejected'`
- Includes `rejectedAt` timestamp when rejected
- Hidden from search results (like pending offers)
- Show rejection symbol with "Why?" link on profile
- Users can remove rejected offers with confirmation dialog

### Existing Offers (~2000 offers)
- Offers without status field are treated as approved
- Continue to appear in search results
- Show verified symbol on profile

### Admin Workflow
1. User uploads offer → status: 'pending'
2. Offer appears on admin dashboard (needs admin site implementation)
3. Admin reviews and either:
   - **Approves** → status: 'approved' → visible in search results
   - **Rejects** → status: 'rejected' + rejectedAt timestamp → hidden from search
4. User sees appropriate symbol on profile

## Next Steps
1. **Replace admin UIDs** in `firestore.rules` with actual admin user IDs
2. **Deploy Firestore rules** to Firebase project
3. **Test the workflow** with new offer submissions
4. **Implement admin dashboard** to manage pending offers

## Testing Checklist
- [ ] New offer submissions get pending status
- [ ] Pending offers don't appear in search results
- [ ] Pending offers show pending symbol on profile
- [ ] Rejected offers don't appear in search results
- [ ] Rejected offers show rejection symbol with "Why?" link on profile
- [ ] "Why?" link navigates to rejection reasons page
- [ ] Remove button works for rejected offers with confirmation
- [ ] Existing offers still work normally
- [ ] Admin can access all documents with deployed rules 