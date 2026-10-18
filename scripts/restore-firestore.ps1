[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$BackupUri
)
$ErrorActionPreference = 'Stop'

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw 'Google Cloud CLI (gcloud) is required. Install it and run gcloud auth login.'
}
if ($BackupUri -notmatch '^gs://') {
  throw 'BackupUri must be the exact gs:// URI of a completed Firestore export directory.'
}
Write-Warning "RESTORE TARGET: $ProjectId"
Write-Warning "SOURCE BACKUP: $BackupUri"
Write-Warning 'Firestore import merges exported documents; it does not delete documents absent from the backup. Test in a separate project first.'
if ($PSCmdlet.ShouldProcess("Firestore project $ProjectId", "Import backup $BackupUri")) {
  gcloud firestore import $BackupUri --project $ProjectId
  if ($LASTEXITCODE -ne 0) { throw "Firestore import failed with exit code $LASTEXITCODE" }
  Write-Host 'Import command completed. Run application-level verification before directing users to this project.'
}
