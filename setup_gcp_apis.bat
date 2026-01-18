@echo off
echo Enabling Google Cloud APIs for ServerGem...
echo.

call gcloud services enable ^
  cloudbuild.googleapis.com ^
  run.googleapis.com ^
  artifactregistry.googleapis.com ^
  storage.googleapis.com ^
  aiplatform.googleapis.com ^
  secretmanager.googleapis.com ^
  logging.googleapis.com

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ APIs enabled successfully!
) else (
    echo.
    echo ❌ Failed to enable APIs. Please ensure you are logged in (gcloud auth login) and have selected the correct project.
)
pause
