# Firebase Storage CORS Setup for Video Uploads

## Issue
When uploading videos to Firebase Storage, you may encounter CORS (Cross-Origin Resource Sharing) errors. This prevents the browser from uploading files to Firebase Storage.

## Solution

### Option 1: Using Google Cloud Console (Recommended)

1. **Install Google Cloud SDK** (if not already installed):
   - Download from: https://cloud.google.com/sdk/docs/install
   - Or use the gcloud CLI that comes with Firebase CLI

2. **Set CORS Configuration**:
   ```bash
   # Navigate to your project directory
   cd "d:\2. Theluxmining\TheLuxMining"
   
   # Set the CORS configuration
   gcloud storage buckets update gs://theluxmining-91ab1.appspot.com --cors-file=cors.json
   ```

3. **Verify CORS Configuration**:
   ```bash
   gcloud storage buckets describe gs://theluxmining-91ab1.appspot.com --format="default(cors_config)"
   ```

### Option 2: Using Google Cloud Console Web Interface (No CLI Required)

1. **Go to Google Cloud Storage Console**:
   - Visit: https://console.cloud.google.com/storage/browser/theluxmining-91ab1.appspot.com
   - Or: https://console.cloud.google.com/storage → Select your bucket

2. **Configure CORS**:
   - Click on your bucket name: `theluxmining-91ab1.appspot.com`
   - Click on the **CONFIGURATION** tab
   - Scroll down to **CORS** section
   - Click **EDIT CORS CONFIGURATION**
   - Paste the following JSON:
   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
       "responseHeader": ["Content-Type"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
   - Click **SAVE**

3. **Alternative - Using Cloud Shell** (in Google Cloud Console):
   - Click the Cloud Shell icon (>_) in the top right
   - Run these commands:
   ```bash
   cat > /tmp/cors.json << 'EOF'
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
       "responseHeader": ["Content-Type"],
       "maxAgeSeconds": 3600
     }
   ]
   EOF
   
   gcloud storage buckets update gs://theluxmining-91ab1.appspot.com --cors-file=/tmp/cors.json
   ```

### Option 3: Using Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/project/theluxmining-91ab1/storage)
2. Click on the **Rules** tab
3. Ensure your storage rules allow video uploads (already configured)
4. For CORS, you need to use Google Cloud Console (see Option 2)

### Option 3: Using gsutil (Alternative)

If you have gsutil installed:

```bash
gsutil cors set cors.json gs://theluxmining-91ab1.appspot.com
```

## CORS Configuration File (cors.json)

The `cors.json` file has been created with the following configuration:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"]
  }
]
```

### For Production (More Restrictive)

Replace `"origin": ["*"]` with your actual domains:

```json
[
  {
    "origin": [
      "https://theluxmining-91ab1.web.app",
      "https://theluxmining-91ab1.firebaseapp.com",
      "https://yourdomain.com"
    ],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"]
  }
]
```

## Storage Rules

Your storage rules already support video uploads with the following configuration:

- ✅ Video files up to 200MB
- ✅ Admin-only upload permissions
- ✅ Public read access
- ✅ Supports: `products/`, `gallery/`, paths

## Troubleshooting

### Error: "No 'Access-Control-Allow-Origin' header"

**Cause**: CORS not configured on Firebase Storage bucket

**Solution**: Apply the CORS configuration using one of the methods above

### Error: "Failed to upload video"

**Possible causes**:
1. **File size too large**: Max 200MB (configured in storage.rules)
2. **Not authenticated as admin**: Check user authentication
3. **Invalid video format**: Only MP4, WebM, OGG supported
4. **Duration too long**: Max 300 seconds / 5 minutes (configurable)

### Error: "Permission denied"

**Cause**: User is not authenticated as admin

**Solution**: Ensure you're logged in with an admin account

### Video Upload Limits

Current limits (configurable in code):
- **Max file size**: 200MB (storage.rules)
- **Max duration**: 300 seconds / 5 minutes (video-optimization.service.ts)
- **Supported formats**: MP4, WebM, OGG
- **Max dimensions**: 1920x1080 (resized if larger)

## Testing Video Upload

1. **Login as admin**
2. **Navigate to**: Setup Guide Admin or Media Gallery
3. **Select a video file** (MP4, WebM, or OGG, < 200MB)
4. **Upload**: The system will:
   - Validate the video
   - Extract metadata (duration, dimensions)
   - Generate a thumbnail
   - Upload video and thumbnail to Firebase Storage
   - Save metadata to Firestore

## Quick Fix Commands

```bash
# Navigate to project
cd "d:\2. Theluxmining\TheLuxMining"

# Deploy storage rules
firebase deploy --only storage

# Set CORS (requires gcloud SDK)
gcloud storage buckets update gs://theluxmining-91ab1.appspot.com --cors-file=cors.json

# Check deployment status
firebase projects:list
```

## Related Files

- `storage.rules` - Firebase Storage security rules
- `cors.json` - CORS configuration for Storage bucket
- `src/app/services/storage.service.ts` - Upload service
- `src/app/services/video-optimization.service.ts` - Video processing
- `VIDEO_AND_IMAGE_OPTIMIZATION.md` - Complete media optimization guide

## Next Steps

1. ✅ Storage rules deployed
2. ⏳ Apply CORS configuration (see Option 1 above)
3. ✅ Test video upload from admin panel
4. ✅ Verify videos appear in Firebase Storage Console
