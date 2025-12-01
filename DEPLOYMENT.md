# Vercel Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables
Set these in Vercel Dashboard → Settings → Environment Variables:

- ✅ `DATABASE_URL` - PostgreSQL connection string (required)
- ✅ `NEXTAUTH_SECRET` - Secure random string, min 32 characters (required)
- ✅ `NEXTAUTH_URL` - Your production URL, e.g., `https://your-app.vercel.app` (optional but recommended)
- ✅ `FILE_STORAGE_ROOT` - File storage path, default: `./storage/uploads` (optional)

### 2. Database Setup
- ✅ Run migrations: `npx prisma migrate deploy` (or use Vercel's build command)
- ✅ Ensure database connection pooling is configured
- ✅ Test database connection from production environment

### 3. Build Configuration
- ✅ `package.json` includes `postinstall: prisma generate`
- ✅ Build script includes Prisma generation: `prisma generate && next build`
- ✅ `next.config.ts` has production optimizations

### 4. Security
- ✅ Security headers configured in `next.config.ts`
- ✅ Environment variables validated with Zod
- ✅ No sensitive data in code or logs
- ✅ File upload size limits enforced (10MB)

### 5. File Storage
⚠️ **Important**: Local filesystem storage is ephemeral on Vercel serverless functions.

**For Production:**
- Consider migrating to Vercel Blob Storage or AWS S3
- Files stored locally will be lost when serverless functions restart
- Current implementation works but files are not persistent

### 6. Monitoring & Logging
- ✅ Error logging configured
- ✅ Prisma logging set to `["error"]` in production
- Consider adding:
  - Error tracking (Sentry, LogRocket)
  - Performance monitoring
  - Uptime monitoring

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Production ready"
   git push origin master
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required variables (see checklist above)
   - Set for Production, Preview, and Development environments

4. **Deploy**
   - Vercel will automatically build and deploy
   - Monitor build logs for any issues
   - First deployment may take longer due to Prisma generation

5. **Run Database Migrations**
   - After first deployment, connect to your database
   - Run: `npx prisma migrate deploy`
   - Or use Vercel's CLI: `vercel env pull` then run migrations locally

6. **Verify Deployment**
   - Check all API endpoints
   - Test file upload functionality
   - Verify database connections
   - Check error logs in Vercel dashboard

## Post-Deployment

### Database Migrations
For future schema changes:
```bash
# Create migration
npx prisma migrate dev --name your_migration_name

# Deploy to production
npx prisma migrate deploy
```

### Monitoring
- Check Vercel Analytics for performance metrics
- Monitor error logs in Vercel Dashboard
- Set up alerts for critical errors

### Updates
- Push changes to GitHub
- Vercel automatically redeploys
- Monitor build and deployment logs

## Troubleshooting

### Build Fails
- Check build logs in Vercel Dashboard
- Verify all environment variables are set
- Ensure Prisma client generates successfully
- Check TypeScript errors

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check database allows connections from Vercel IPs
- Ensure connection pooling is configured
- Check database is not paused (Neon, Supabase)

### File Upload Issues
- Local filesystem is ephemeral on Vercel
- Consider migrating to cloud storage
- Check file size limits (10MB enforced)

### Runtime Errors
- Check Vercel Function Logs
- Verify environment variables
- Check Prisma client is generated
- Review error messages in logs

## Production Optimizations

- ✅ Compression enabled
- ✅ Security headers configured
- ✅ React Strict Mode enabled
- ✅ Prisma connection pooling
- ✅ Error handling in all API routes
- ✅ File size limits enforced
- ✅ TypeScript strict mode

## Next Steps

1. Set up error tracking (Sentry recommended)
2. Configure custom domain
3. Set up database backups
4. Implement rate limiting for API routes
5. Migrate file storage to cloud (Vercel Blob/S3)
6. Set up CI/CD pipeline
7. Configure monitoring and alerts

