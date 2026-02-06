# replace-command-with-brandicon.ps1
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# ====== CONFIG ======
# Set this to wherever your uploaded image currently is on your PC:
$IconSource = "$env:USERPROFILE\Downloads\og-image.jpg"   # <-- CHANGE IF NEEDED
$IconDest   = Join-Path $PSScriptRoot "public\brand.jpg"

$BrandComponentPath = Join-Path $PSScriptRoot "components\brand-icon.tsx"
$BrandComponentDir  = Split-Path $BrandComponentPath -Parent

# ====== 1) Ensure public/brand.jpg exists ======
if (-not (Test-Path (Split-Path $IconDest -Parent))) {
  New-Item -ItemType Directory -Path (Split-Path $IconDest -Parent) | Out-Null
}

if (-not (Test-Path $IconSource)) {
  Write-Host "ICON SOURCE NOT FOUND: $IconSource" -ForegroundColor Yellow
  Write-Host "Fix by editing `$IconSource in this script to the correct file path." -ForegroundColor Yellow
} else {
  Copy-Item $IconSource $IconDest -Force
  Write-Host "Copied icon to: public/brand.jpg"
}

# ====== 2) Create components/brand-icon.tsx if missing ======
if (-not (Test-Path $BrandComponentDir)) {
  New-Item -ItemType Directory -Path $BrandComponentDir | Out-Null
}

if (-not (Test-Path $BrandComponentPath)) {
@'
import Image from "next/image";

export function BrandIcon({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand.jpg"
      alt="TenderRay"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      priority
    />
  );
}
'@ | Set-Content -Path $BrandComponentPath -Encoding UTF8

  Write-Host "Created: components/brand-icon.tsx"
} else {
  Write-Host "Exists: components/brand-icon.tsx"
}

# ====== Helpers ======
function Add-BrandIconImport([string]$text) {
  if ($text -match 'from "@/components/brand-icon"' ) { return $text }

  # Insert after last import line
  $lines = $text -split "`r?`n"
  $lastImportIndex = -1
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '^\s*import\s+') { $lastImportIndex = $i }
  }
  if ($lastImportIndex -ge 0) {
    $before = $lines[0..$lastImportIndex]
    $after  = @()
    if ($lastImportIndex + 1 -lt $lines.Length) { $after = $lines[($lastImportIndex+1)..($lines.Length-1)] }
    $new = @()
    $new += $before
    $new += 'import { BrandIcon } from "@/components/brand-icon";'
    $new += $after
    return ($new -join "`r`n")
  }

  # If no imports found, prepend
  return ('import { BrandIcon } from "@/components/brand-icon";' + "`r`n" + $text)
}

function Remove-CommandFromLucideImport([string]$text) {
  # Handles: import { A, Command, B } from "lucide-react";
  # and:     import {Command} from "lucide-react";
  $pattern = 'import\s*\{\s*([^}]*)\s*\}\s*from\s*["' + "'" + ']lucide-react["' + "'" + ']\s*;'
  return [regex]::Replace($text, $pattern, {
    param($m)
    $inside = $m.Groups[1].Value
    $items = $inside -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" -and $_ -ne "Command" }
    if ($items.Count -eq 0) {
      # If import would become empty, remove entire line
      return ""
    }
    return 'import { ' + ($items -join ", ") + ' } from "lucide-react";'
  })
}

function Replace-CommandJsx([string]$text) {
  # Replace <Command ... /> with <BrandIcon size={32} className="h-8 w-8" />
  # Preserve indentation and don't touch URLs (we don't search/replace those anyway)
  $pattern = '<Command\b[^>]*\/>'
  if ($text -notmatch $pattern) { return $text }
  return [regex]::Replace($text, $pattern, '<BrandIcon size={32} className="h-8 w-8" />')
}

# ====== 3) Find target files that import Command from lucide-react ======
$targets = Get-ChildItem -Path (Join-Path $PSScriptRoot "app") -Recurse -File -Include *.ts,*.tsx |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\\.next\\|\\\.git\\" }

$targets += Get-ChildItem -Path (Join-Path $PSScriptRoot "components") -Recurse -File -Include *.ts,*.tsx -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\\.next\\|\\\.git\\" }

$targets = $targets | Sort-Object FullName -Unique

$edited = 0

foreach ($f in $targets) {
  $content = ""
  try {
    $content = [System.IO.File]::ReadAllText($f.FullName)
  } catch {
    continue
  }

  if ($null -eq $content -or $content.Length -eq 0) { continue }

  # Only files that import Command from lucide-react
  if ($content -notmatch 'from\s*["' + "'" + ']lucide-react["' + "'" + ']' ) { continue }
  if ($content -notmatch '\bCommand\b' ) { continue }

  # Only proceed if there is actual JSX usage <Command ... />
  if ($content -notmatch '<Command\b') { continue }

  $orig = $content

  $content = Remove-CommandFromLucideImport $content
  $content = Add-BrandIconImport $content
  $content = Replace-CommandJsx $content

  if ($content -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $content)
    Write-Host "Updated: $($f.FullName)"
    $edited++
  }
}


Write-Host ""
Write-Host "Done. Files updated: $edited"
Write-Host "Next:"
Write-Host "  npm run dev"
Write-Host "  git status"
