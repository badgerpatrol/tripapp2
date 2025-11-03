# Deployment Checklist

Quick reference guide for deploying TripPlanner with dual database setup (local + production).

## ✅ Completed Setup

- [x] Local database configuration (`.env`)
- [x] Production database initialization script created
- [x] Database management scripts added to `package.json`
- [x] `.gitignore` configured to protect credentials
- [x] Documentation created

## 📋 Next Steps

### 1. Initialize Production Database (One-time)

✅ **COMPLETED** - Your production database is set up and seeded!

The command that was run:

```bash
DATABASE_URL="postgresql://trip_app_db_vnrv_user:ZVaYdWQhz9DazzJleOVt2qXbePnOujyM@dpg-d41uc7n5r7bs73e1jkqg-a.frankfurt-postgres.render.com/trip_app_db_vnrv" pnpm db:init:production:seed
```

### 2. Configure Vercel Environment Variables

Go to your Vercel project → Settings → Environment Variables and add:

#### Required Variables:

1. **DATABASE_URL**
   ```
   postgresql://trip_app_db_vnrv_user:ZVaYdWQhz9DazzJleOVt2qXbePnOujyM@dpg-d41uc7n5r7bs73e1jkqg-a.frankfurt-postgres.render.com/trip_app_db_vnrv
   ```

2. **Firebase Config** (copy from `.env.local`):
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `FIREBASE_SERVICE_ACCOUNT_KEY`

3. **WebAuthn Config**:
   - `NEXT_PUBLIC_RP_ID` → Your domain (e.g., `tripplanner.vercel.app`)
   - `NEXT_PUBLIC_ORIGIN` → Your URL (e.g., `https://tripplanner.vercel.app`)

See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed instructions.

### 3. Deploy to Vercel

```bash
vercel --prod
```

Or push to your git repository if you have automatic deployments set up.

### 4. Verify Deployment

- [ ] Visit your Vercel URL
- [ ] Check deployment logs for errors
- [ ] Test user authentication
- [ ] Create a test trip to verify database connection

## 🔄 Workflow Reference

### Local Development

```bash
# Start development server
pnpm dev

# Update local schema
pnpm db:push

# View database
pnpm db:studio

# Seed data
pnpm db:seed
```

### Making Schema Changes

1. **Update** `prisma/schema.prisma`
2. **Test locally**:
   ```bash
   pnpm db:push
   ```
3. **Update production**:
   ```bash
   DATABASE_URL="<production_url>" pnpm db:init:production
   ```
4. **Deploy**:
   ```bash
   vercel --prod
   ```

## 📚 Documentation

- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Complete database setup guide
- [VERCEL_SETUP.md](./VERCEL_SETUP.md) - Vercel deployment guide

## 🔒 Security Reminders

- ✅ Never commit `.env` files
- ✅ Never hardcode credentials in code
- ✅ Rotate credentials if exposed
- ✅ Use Vercel environment variables for production
- ✅ Keep production database URL secure

## 🆘 Quick Troubleshooting

### Can't connect to local database
```bash
# Check if PostgreSQL is running
brew services list

# Restart if needed
brew services restart postgresql
```

### Production database connection issues
1. Verify `DATABASE_URL` in Vercel settings
2. Check Render database status
3. Verify connection string is correct

### Build fails on Vercel
1. Check Vercel build logs
2. Verify all environment variables are set
3. Ensure `postinstall` script runs (`prisma generate`)

## ✨ Tips

- Use `pnpm db:studio` to visually inspect your local database
- Test all changes locally before deploying to production
- Keep backups of production data before schema changes
- Monitor Vercel deployment logs for issues
