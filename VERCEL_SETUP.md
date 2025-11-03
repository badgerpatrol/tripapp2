# Vercel Deployment Setup

This guide walks you through deploying your TripPlanner app to Vercel with the Render PostgreSQL database.

## Prerequisites

- Vercel account (sign up at [vercel.com](https://vercel.com))
- Render PostgreSQL database initialized (see [DATABASE_SETUP.md](./DATABASE_SETUP.md))
- Firebase project configured

## Step 1: Initialize Vercel Project

If you haven't already connected your project to Vercel:

```bash
# Install Vercel CLI (if needed)
npm i -g vercel

# Link your project to Vercel
vercel
```

Follow the prompts to:
1. Set up and deploy
2. Link to existing project or create new one
3. Select your framework (Next.js)

## Step 2: Configure Environment Variables

Go to your Vercel project dashboard → Settings → Environment Variables and add the following:

### Database Configuration

**Variable Name**: `DATABASE_URL`

**Value**:
```
postgresql://trip_app_db_vnrv_user:ZVaYdWQhz9DazzJleOVt2qXbePnOujyM@dpg-d41uc7n5r7bs73e1jkqg-a.frankfurt-postgres.render.com/trip_app_db_vnrv
```

**Environments**: Production, Preview (optional)

---

### Firebase Client Configuration (Public)

These are exposed to the browser and should match your `.env.local`:

**Variable Name**: `NEXT_PUBLIC_FIREBASE_API_KEY`

**Value**: `AIzaSyAQlkDRjM_mUYXhBsog81oMYoHAggZmoP8`

**Environments**: Production, Preview

---

**Variable Name**: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`

**Value**: `tripapp-f371d.firebaseapp.com`

**Environments**: Production, Preview

---

**Variable Name**: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

**Value**: `tripapp-f371d`

**Environments**: Production, Preview

---

**Variable Name**: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`

**Value**: `tripapp-f371d.firebasestorage.app`

**Environments**: Production, Preview

---

**Variable Name**: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

**Value**: (Your sender ID)

**Environments**: Production, Preview

---

**Variable Name**: `NEXT_PUBLIC_FIREBASE_APP_ID`

**Value**: (Your app ID)

**Environments**: Production, Preview

---

### Firebase Admin SDK (Server-side, Private)

**Variable Name**: `FIREBASE_SERVICE_ACCOUNT_KEY`

**Value**: (The entire JSON from your `.env.local` - copy as-is)

**Environments**: Production, Preview

---

### WebAuthn/Passkey Configuration

**Variable Name**: `NEXT_PUBLIC_RP_ID`

**Value**: Your production domain (e.g., `tripplanner.vercel.app` or your custom domain)

**Environments**: Production

---

**Variable Name**: `NEXT_PUBLIC_ORIGIN`

**Value**: Your production URL (e.g., `https://tripplanner.vercel.app` or your custom domain)

**Environments**: Production

---

## Step 3: Initialize Production Database

Before your first deployment, initialize the Render database:

```bash
DATABASE_URL="postgresql://trip_app_db_vnrv_user:ZVaYdWQhz9DazzJleOVt2qXbePnOujyM@dpg-d41uc7n5r7bs73e1jkqg-a.frankfurt-postgres.render.com/trip_app_db_vnrv" pnpm db:init:production:seed
```

This creates the schema and seeds default data.

✅ **You've already completed this step!** Your database is ready.

## Step 4: Deploy

Deploy your application:

```bash
# Deploy to production
vercel --prod

# Or just push to your main branch
git push
```

## Step 5: Verify Deployment

1. Visit your Vercel deployment URL
2. Check the deployment logs for any errors
3. Test database connectivity by creating a test user or trip

## Updating the Schema

When you make schema changes:

1. **Test locally first**:
   ```bash
   pnpm db:push
   ```

2. **Update production database**:
   ```bash
   DATABASE_URL="postgresql://trip_app_db_vnrv_user:ZVaYdWQhz9DazzJleOVt2qXbePnOujyM@dpg-d41uc7n5r7bs73e1jkqg-a/trip_app_db_vnrv" pnpm db:init:production
   ```

3. **Deploy the updated code**:
   ```bash
   vercel --prod
   ```

## Environment Variables Checklist

Use this checklist when setting up or verifying your Vercel environment variables:

- [ ] `DATABASE_URL` (Production database connection)
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY`
- [ ] `NEXT_PUBLIC_RP_ID` (Production domain)
- [ ] `NEXT_PUBLIC_ORIGIN` (Production URL)

## Troubleshooting

### Database Connection Errors

If you see database connection errors in Vercel logs:

1. Verify `DATABASE_URL` is set correctly in Vercel
2. Check that the Render database is running
3. Ensure the database has been initialized
4. Verify the connection string includes the correct password

### Build Failures

If the build fails:

1. Check build logs in Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Verify Prisma Client is generated during build (`postinstall` script)

### Firebase Authentication Issues

If Firebase auth doesn't work:

1. Verify all `NEXT_PUBLIC_FIREBASE_*` variables are set
2. Check Firebase console for authorized domains
3. Add your Vercel domain to Firebase authorized domains:
   - Go to Firebase Console → Authentication → Settings
   - Add your Vercel domain to "Authorized domains"

## Security Best Practices

1. **Never commit** environment variables to git
2. **Rotate credentials** if they're ever exposed
3. **Use Preview environments** to test before production
4. **Enable Vercel authentication** for preview deployments if needed
5. **Monitor deployment logs** for any credential leaks

## Additional Resources

- [Vercel Environment Variables Docs](https://vercel.com/docs/environment-variables)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
