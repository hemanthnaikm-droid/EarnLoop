[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$Bucket,
  [string]$Prefix = 'earnloop-firestore-backups'
)
$ErrorActionPreference = 'Stop'

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw 'Google Cloud CLI (gcloud) is required. Install it and run gcloud auth login.'
}
if (-not (Get-Command gsutil -ErrorAction SilentlyContinue)) {
  Write-Warning 'gsutil was not found. The export can still run, but verification will be skipped.'
}
if ($Bucket -notmatch '^gs://') { $Bucket = "gs://$Bucket" }
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssZ')
$destination = "$Bucket/$Prefix/$ProjectId/$timestamp"

Write-Host "Starting Firestore export for project '$ProjectId' to $destination"
Write-Warning 'This exports Firestore documents only. It does not back up Firebase Authentication users, Cloud Storage files, Functions secrets, or hosting configuration.'
gcloud firestore export $destination --project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "Firestore export failed with exit code $LASTEXITCODE" }

if (Get-Command gsutil -ErrorAction SilentlyContinue) {
  gsutil ls "$destination/**"
  if ($LASTEXITCODE -ne 0) { throw 'Export command returned success, but export files could not be listed.' }
}
Write-Host "Firestore export completed: $destination"
Write-Host 'Record the destination and verify restore in a separate test project before relying on this backup.'
