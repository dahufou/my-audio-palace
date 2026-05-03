# =============================================================================
#  Snapclient — Installation Windows
#
#  Installe Snapclient (binaire officiel Snapcast) en service Windows et le
#  configure pour rejoindre ton serveur Aurum.
#
#  Lancer depuis PowerShell **en administrateur** :
#      Set-ExecutionPolicy -Scope Process Bypass -Force
#      .\install-windows.ps1 -ServerHost 192.168.1.50
#
#  Paramètres optionnels :
#      -ServerPort 1704      port audio Snapserver (défaut 1704)
#      -ClientName "PC-Salon"  nom de la zone qui apparaîtra dans Aurum
# =============================================================================

param(
  [Parameter(Mandatory=$true)][string]$ServerHost,
  [int]$ServerPort = 1704,
  [string]$ClientName = $env:COMPUTERNAME,
  [string]$Version = "0.31.0"
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error "Lance ce script en tant qu'administrateur."
  exit 1
}

$InstallDir = "$env:ProgramFiles\Snapclient"
$ZipUrl = "https://github.com/badaix/snapcast/releases/download/v$Version/snapclient-$Version-win-x64.zip"
$ZipPath = "$env:TEMP\snapclient-$Version.zip"

Write-Host "[aurum] Téléchargement Snapclient $Version…" -ForegroundColor Cyan
Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath -UseBasicParsing

Write-Host "[aurum] Extraction → $InstallDir" -ForegroundColor Cyan
if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
New-Item -ItemType Directory -Path $InstallDir | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force
Remove-Item $ZipPath

# Le binaire se trouve dans un sous-dossier — on l'aplatit
$exe = Get-ChildItem -Path $InstallDir -Recurse -Filter "snapclient.exe" | Select-Object -First 1
if (-not $exe) { Write-Error "snapclient.exe introuvable après extraction"; exit 1 }
if ($exe.DirectoryName -ne $InstallDir) {
  Move-Item "$($exe.DirectoryName)\*" $InstallDir -Force
}

# Stop & remove existing service if present
$svc = Get-Service -Name "Snapclient" -ErrorAction SilentlyContinue
if ($svc) {
  Write-Host "[aurum] Service Snapclient existant → arrêt et suppression" -ForegroundColor Yellow
  Stop-Service Snapclient -Force -ErrorAction SilentlyContinue
  sc.exe delete Snapclient | Out-Null
  Start-Sleep -Seconds 2
}

$binArgs = "--host $ServerHost --port $ServerPort --hostID `"$ClientName`""
Write-Host "[aurum] Création du service Windows" -ForegroundColor Cyan
sc.exe create Snapclient binPath= "`"$InstallDir\snapclient.exe`" $binArgs" start= auto DisplayName= "Snapcast Client (Aurum)" | Out-Null
sc.exe description Snapclient "Snapcast audio client — connecte ce PC au serveur Aurum ($ServerHost)" | Out-Null
Start-Service Snapclient

Write-Host ""
Write-Host "✔  Snapclient installé et démarré" -ForegroundColor Green
Write-Host "   Serveur     : $ServerHost`:$ServerPort"
Write-Host "   Nom zone    : $ClientName"
Write-Host "   Logs        : Get-EventLog -LogName Application -Source Snapclient"
Write-Host "   Statut      : Get-Service Snapclient"
Write-Host ""
Write-Host "Le PC apparaîtra comme zone dans Aurum → Réglages → Zones audio."
