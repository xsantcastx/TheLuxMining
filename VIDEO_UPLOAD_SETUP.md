# Firebase Storage Video Upload - Complete Setup & Troubleshooting

## ✅ Current Status

- **Storage Rules**: Deployed successfully
- **Video Upload Code**: Implemented
- **CORS Configuration**: ⚠️ Needs to be applied manually

## 🔧 Quick Fix Steps

### Step 1: Apply CORS Configuration

**Option A: Google Cloud Console (Easiest - No CLI)**

1. Visit: https://console.cloud.google.com/storage/browser/theluxmining-91ab1.appspot.com
2. Click on your bucket: `theluxmining-91ab1.appspot.com`
3. Click the **CONFIGURATION** tab
4. Scroll to **CORS** section → Click **EDIT CORS CONFIGURATION**
5. Paste this JSON:
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
6. Click **SAVE**

**Option B: Google Cloud Shell (In Browser)**

1. Go to: https://console.cloud.google.com
2. Click the Cloud Shell icon (>_) at the top right
3. Run:
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

### Step 2: Verify Storage Rules

```powershell
cd "d:\2. Theluxmining\TheLuxMining"
firebase deploy --only storage
```

Expected output:
```
✔ firebase.storage: rules file storage.rules compiled successfully
✔ storage: released rules storage.rules to firebase.storage
```

### Step 3: Test Video Upload

1. Run your app: `npm start`
2. Login as admin
3. Navigate to: **Admin Panel → Setup Guide** or **Media Gallery**
4. Upload a test video (MP4, < 200MB, < 5 minutes)

## 🐛 Common Errors & Solutions

### Error 1: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Symptom**: Video upload fails in browser console with CORS error

**Solution**: Apply CORS configuration (see Step 1 above)

**Verify**:
```bash
# In Google Cloud Shell
gcloud storage buckets describe gs://theluxmining-91ab1.appspot.com --format="json(cors_config)"
```

### Error 2: "Permission denied" or "Unauthorized"

**Symptom**: Upload fails with 403 error

**Possible Causes**:
1. Not logged in as admin
2. Storage rules not deployed
3. Firebase app not initialized properly

**Solution**:
```typescript
// Check user role in browser console:
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const auth = getAuth();
const db = getFirestore();
const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
console.log('User role:', userDoc.data()?.role); // Should be 'admin'
```

### Error 3: "File too large"

**Symptom**: Upload fails for videos > 200MB

**Solution**: Current limits in `storage.rules`:
- Images: 10MB max
- Videos: 200MB max

To increase:
```javascript
// In storage.rules
function isValidVideo() {
  return request.resource.contentType.matches('video/.*') &&
         request.resource.size < 500 * 1024 * 1024; // Change to 500MB
}
```

Then redeploy:
```powershell
firebase deploy --only storage
```

### Error 4: "Video duration exceeds limit"

**Symptom**: Upload fails with "Video duration exceeds 300 seconds"

**Solution**: Update in `src/app/services/video-optimization.service.ts`:
```typescript
maxDuration?: number = 600; // Change to 600 seconds (10 minutes) if needed
```

Or when calling the upload:
```typescript
this.videoOptimizer.optimizeVideo(file, {
  maxWidth: 1920,
  maxHeight: 1080,
  maxDuration: 600, // Custom duration (10 minutes)
  thumbnailTime: 1
});
```

### Error 5: "Failed to load video metadata"

**Symptom**: Upload fails during video validation

**Possible Causes**:
1. Corrupted video file
2. Unsupported codec
3. Browser doesn't support video format

**Solution**:
- Use MP4 with H.264 codec (most compatible)
- Try different video file
- Update browser

**Supported Formats**:
- ✅ MP4 (H.264)
- ✅ WebM (VP8/VP9)
- ❌ AVI, MOV, FLV (not supported)

## 📊 Video Upload Flow

```
1. User selects video file
   ↓
2. Frontend validates:
   - File type (MP4/WebM/OGG)
   - File size (< 200MB)
   - Video duration (< 300s / 5 minutes)
   ↓
3. Video Optimization Service:
   - Loads video metadata
   - Calculates dimensions
   - Generates thumbnail (JPEG + WebP)
   - Returns optimized data
   ↓
4. Storage Service:
   - Uploads video to Firebase Storage
   - Uploads thumbnail
   - Tracks progress (0-100%)
   ↓
5. Success:
   - Returns download URLs
   - Saves metadata to Firestore
   - Displays in media library
```

## 🔍 Debugging Tips

### Check Browser Console

```javascript
// Enable verbose Firebase logging
import { setLogLevel } from 'firebase/app';
setLogLevel('debug');
```

### Check Network Tab

1. Open DevTools → Network tab
2. Filter by `firebasestorage.googleapis.com`
3. Look for:
   - ✅ Status 200 = Success
   - ❌ Status 403 = Permission denied (check rules/auth)
   - ❌ Status 400 = CORS issue

### Test Storage Rules

Go to: https://console.firebase.google.com/project/theluxmining-91ab1/storage/rules

Click **Simulator** to test rules:
```javascript
// Test video upload as admin
Path: /products/test-video.mp4
File type: video/mp4
File size: 50000000 (50MB)
Auth: { uid: "your-admin-uid", token: { role: "admin" } }
```

## 📝 Configuration Summary

### Storage Rules (`storage.rules`)
- ✅ Videos up to 200MB
- ✅ Images up to 10MB
- ✅ Admin-only uploads
- ✅ Public read access

### Video Limits (Code)
- Max duration: 300 seconds (5 minutes)
- Max dimensions: 1920x1080
- Formats: MP4, WebM, OGG
- Thumbnail: Auto-generated at 1 second

### Paths
- Products: `/products/{slug}-video-{timestamp}.mp4`
- Gallery: `/gallery/{category}/video-{timestamp}.mp4`
- Thumbnails: `/products/{slug}-video-{timestamp}-thumb.webp`

## 🚀 Production Checklist

- [ ] Apply CORS configuration
- [ ] Deploy storage rules
- [ ] Test video upload as admin
- [ ] Verify thumbnail generation
- [ ] Check Firebase Storage console
- [ ] Test on different browsers
- [ ] Monitor storage usage/costs
- [ ] Consider CDN for video delivery
- [ ] Update CORS origin to specific domains (remove `*`)

## 📞 Support

If issues persist:
1. Check [Firebase Storage docs](https://firebase.google.com/docs/storage)
2. Check [CORS troubleshooting](https://cloud.google.com/storage/docs/cross-origin)
3. Review `VIDEO_AND_IMAGE_OPTIMIZATION.md`
4. Check Firebase console for errors
