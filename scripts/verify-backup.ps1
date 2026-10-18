[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$BackupUri)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command gsutil -ErrorAction SilentlyContinue)) {
  throw 'gsutil is required to list and verify backup files. Install Google Cloud CLI.'
}
if ($BackupUri -notmatch '^gs://') { throw 'BackupUri must begin with gs://' }
$items = @(gsutil ls "$BackupUri/**")
if ($LASTEXITCODE -ne 0 -or $items.Count -eq 0) { throw 'No backup files were found at the provided URI.' }
$items | ForEach-Object { Write-Host $_ }
Write-Host "Found $($items.Count) object(s). This confirms files exist; it does not prove that a restore works. Perform a test restore." 
