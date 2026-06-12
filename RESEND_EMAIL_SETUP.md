# Resend Email Testing Setup Guide

## Prerequisites

✅ **Resend account configured** for `info@socialfunnel.agency`

## Testing New User Onboarding Email

### Step 1: Configure Resend API Key

Add your Resend API key to the backend `.env` file:

```env
RESEND_API_KEY=re_YourActualAPIKeyHere
```

### Step 2: Install Resend SDK (if not already installed)

```bash
cd apps/backend
npm install resend
```

### Step 3: Test the Onboarding Email

You can test the email in two ways:

#### Option A: Via Admin API

```bash
curl -X POST http://localhost:4000/api/v1/admin/staff/create \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: default" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "role": "staff"
  }'
```

#### Option B: Via Prisma Studio

1. Open Prisma Studio:
   ```bash
   cd apps/backend
   npx prisma studio
   ```

2. Navigate to the `Staff` table
3. Create a new staff record with:
   - Email: Your test email address
   - Name: Test name
   - Role: `staff` or `admin`
   - Password: (will be generated automatically)

The onboarding email will be sent automatically to the provided email address.

### Step 4: Verify Email Contents

The email should contain:
- Welcome message
- Temporary login credentials
- Dashboard login URL: `http://localhost:3000/admin/login` (or your production URL)
- Instructions to change password on first login

### Troubleshooting

**Email not sending:**
1. Check that `RESEND_API_KEY` is correctly set in `.env`
2. Verify the Resend account status at https://resend.com/dashboard
3. Check backend logs for any error messages
4. Ensure the domain `socialfunnel.agency` is verified in Resend

**Email goes to spam:**
1. Configure SPF, DKIM, and DMARC records for your domain
2. Warm up your sending domain gradually
3. Use the verified `info@socialfunnel.agency` sender address

## Production Deployment

When deploying to production:

1. Update `FRONTEND_URL` in backend `.env` to your Vercel URL
2. Add `RESEND_API_KEY` to your production environment variables
3. Ensure domain is verified in Resend for production sending

## Next Steps

Once email is working:
- Customize email template branding (if needed)
- Add password reset flow
- Configure email notifications for other events (lead assignments, booking confirmations, etc.)
