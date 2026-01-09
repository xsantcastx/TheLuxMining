# Firebase Storage Video Upload Checker
# This script verifies your Firebase setup for video uploads

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Firebase Video Upload Setup Checker" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectPath = "d:\2. Theluxmining\TheLuxMining"
Set-Location $projectPath

# Check 1: Firebase CLI
Write-Host "[1/6] Checking Firebase CLI..." -ForegroundColor Yellow
$firebaseCmd = Get-Command firebase -ErrorAction SilentlyContinue
if ($firebaseCmd) {
    $firebaseVersion = & firebase --version 2>&1
    Write-Host "  OK - Firebase CLI installed: v$firebaseVersion" -ForegroundColor Green
} else {
    Write-Host "  ERROR - Firebase CLI not found" -ForegroundColor Red
    Write-Host "    Install: npm install -g firebase-tools" -ForegroundColor Gray
}

# Check 2: CORS Configuration File
Write-Host "`n[2/6] Checking CORS configuration file..." -ForegroundColor Yellow
if (Test-Path "cors.json") {
    Write-Host "  OK - cors.json exists" -ForegroundColor Green
    $corsContent = Get-Content "cors.json" -Raw
    Write-Host "    Content:" -ForegroundColor Gray
    Write-Host $corsContent -ForegroundColor Gray
} else {
    Write-Host "  ERROR - cors.json not found" -ForegroundColor Red
}

# Check 3: Storage Rules
Write-Host "`n[3/6] Checking storage.rules..." -ForegroundColor Yellow
if (Test-Path "storage.rules") {
    Write-Host "  OK - storage.rules exists" -ForegroundColor Green
    
    # Check for video validation
    $storageRules = Get-Content "storage.rules" -Raw
    if ($storageRules -match "isValidVideo") {
        Write-Host "  OK - Video validation rules found" -ForegroundColor Green
    } else {
        Write-Host "  ERROR - Video validation rules not found" -ForegroundColor Red
    }
    
    # Check video size limit
    if ($storageRules -match "200 \* 1024 \* 1024") {
        Write-Host "  OK - Video size limit: 200MB" -ForegroundColor Green
    } else {
        Write-Host "  WARN - Video size limit may need verification" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ERROR - storage.rules not found" -ForegroundColor Red
}

# Check 4: Firebase Configuration
Write-Host "`n[4/6] Checking firebase.json..." -ForegroundColor Yellow
if (Test-Path "firebase.json") {
    Write-Host "  OK - firebase.json exists" -ForegroundColor Green
    $firebaseConfig = Get-Content "firebase.json" -Raw | ConvertFrom-Json
    
    if ($firebaseConfig.storage) {
        Write-Host "  OK - Storage configuration found" -ForegroundColor Green
        Write-Host "    Rules file: $($firebaseConfig.storage.rules)" -ForegroundColor Gray
    } else {
        Write-Host "  ERROR - Storage configuration not found" -ForegroundColor Red
    }
} else {
    Write-Host "  ERROR - firebase.json not found" -ForegroundColor Red
}

# Check 5: Video Optimization Service
Write-Host "`n[5/6] Checking video optimization service..." -ForegroundColor Yellow
$videoServicePath = "src\app\services\video-optimization.service.ts"
if (Test-Path $videoServicePath) {
    Write-Host "  OK - Video optimization service exists" -ForegroundColor Green
    
    $videoService = Get-Content $videoServicePath -Raw
    if ($videoService -match "optimizeVideo") {
        Write-Host "  OK - optimizeVideo method found" -ForegroundColor Green
    }
    if ($videoService -match "captureThumbnail") {
        Write-Host "  OK - Thumbnail generation found" -ForegroundColor Green
    }
} else {
    Write-Host "  ERROR - Video optimization service not found" -ForegroundColor Red
}

# Check 6: Storage Service
Write-Host "`n[6/6] Checking storage service..." -ForegroundColor Yellow
$storageServicePath = "src\app\services\storage.service.ts"
if (Test-Path $storageServicePath) {
    Write-Host "  OK - Storage service exists" -ForegroundColor Green
    
    $storageService = Get-Content $storageServicePath -Raw
    if ($storageService -match "uploadOptimizedVideo") {
        Write-Host "  OK - uploadOptimizedVideo method found" -ForegroundColor Green
    }
    if ($storageService -match "uploadProductVideo") {
        Write-Host "  OK - uploadProductVideo method found" -ForegroundColor Green
    }
    if ($storageService -match "uploadGalleryVideo") {
        Write-Host "  OK - uploadGalleryVideo method found" -ForegroundColor Green
    }
} else {
    Write-Host "  ERROR - Storage service not found" -ForegroundColor Red
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Setup Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Deploy storage rules:" -ForegroundColor White
Write-Host "   firebase deploy --only storage" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Apply CORS configuration:" -ForegroundColor White
Write-Host "   Go to Google Cloud Console Storage and configure CORS" -ForegroundColor Gray
Write-Host "   URL: https://console.cloud.google.com/storage" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test video upload:" -ForegroundColor White
Write-Host "   Run app and upload test video as admin" -ForegroundColor Gray
Write-Host ""

Write-Host "Documentation files:" -ForegroundColor Cyan
Write-Host "   - VIDEO_UPLOAD_SETUP.md" -ForegroundColor Gray
Write-Host "   - FIREBASE_STORAGE_CORS_SETUP.md" -ForegroundColor Gray
Write-Host "   - VIDEO_AND_IMAGE_OPTIMIZATION.md" -ForegroundColor Gray
Write-Host ""
