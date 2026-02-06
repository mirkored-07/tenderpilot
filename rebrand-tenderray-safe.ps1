$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# ==========
# SETTINGS
# ==========
$Old = "TenderPilot"
$New = "TenderRay"
$Descriptor = "AI Go/No-Go Decisions for Tenders & RFPs"
$NewWithDescriptor = "$New - $Descriptor"  # ASCII-safe

# Create or checkout branch safely
$branch = "rebrand/tenderray"
git rev-parse --verify $branch 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { git checkout $branch } else { git checkout -b $branch }

# Only scan these roots
$includeRoots = @("app", "dictionaries", "README.md")

# Exclusions
$excludePathRegex = "(\\\.next\\|\\node_modules\\|\\\.git\\)"
$excludeExact = @("app\robots.ts", "app\sitemap.ts")  # never touch

function ShouldSkipFile([string]$path) {
  if ($path -match $excludePathRegex) { return $true }
  foreach ($ex in $excludeExact) {
    if ($path.EndsWith($ex)) { return $true }
  }
  return $false
}

# Replace TenderPilot -> TenderRay ONLY on non-sensitive lines.
function ReplaceBrandSafely([string]$content) {
  $lines = $content -split "`r?`n", 0, "RegexMatch"

  for ($i=0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]

    # Skip anything that could contain URLs, canonicals, base URLs, hreflang, sitemap/robots, or emails.
    $blockSensitive =
      ($line -match "https?://") -or
      ($line -match "\bwww\.") -or
      ($line -match "new URL\(") -or
      ($line -match "\bmetadataBase\b") -or
      ($line -match "\bcanonical\b") -or
      ($line -match "\balternates\b") -or
      ($line -match "\bhreflang\b") -or
      ($line -match "\bsitemap\b") -or
      ($line -match "\brobots\b") -or
      ($line -match "mailto:") -or
      ($line -match "@") -or
      ($line -match "trytenderpilot")  # extra guard even if no http in line

    if (-not $blockSensitive) {
      $lines[$i] = $line -replace [regex]::Escape($Old), $New
    }
  }

  return ($lines -join "`r`n")
}

# Collect target files
$targets = @()
foreach ($r in $includeRoots) {
  $p = Join-Path $PSScriptRoot $r
  if (Test-Path $p) {
    if ((Get-Item $p).PSIsContainer) {
      $targets += Get-ChildItem -Path $p -Recurse -File
    } else {
      $targets += Get-Item $p
    }
  }
}

$targets = $targets | Where-Object {
  $_.Extension -in @(".ts",".tsx",".js",".jsx",".json",".md",".txt")
} | Where-Object {
  -not (ShouldSkipFile $_.FullName)
}

Write-Host "Found $($targets.Count) target files."

# 1) Global safe brand replace (no URLs / no emails)
foreach ($f in $targets) {
  $content = [System.IO.File]::ReadAllText($f.FullName)
  if ($content -match [regex]::Escape($Old)) {
    $updated = ReplaceBrandSafely $content
    if ($updated -ne $content) {
      [System.IO.File]::WriteAllText($f.FullName, $updated)
    }
  }
}

# 2) Descriptor: apply to first plain-text TenderRay mention on marketing pages ONLY
$marketingPages = @(
  "app/en/page.tsx","app/de/page.tsx","app/it/page.tsx","app/es/page.tsx","app/fr/page.tsx",
  "app/en/how-it-works/page.tsx","app/de/how-it-works/page.tsx","app/it/how-it-works/page.tsx","app/es/how-it-works/page.tsx","app/fr/how-it-works/page.tsx",
  "app/en/sample/page.tsx","app/de/sample/page.tsx","app/it/sample/page.tsx","app/es/sample/page.tsx","app/fr/sample/page.tsx",
  "app/how-it-works/page.tsx","app/sample/page.tsx"
) | Where-Object { $_ -and $_.Trim().Length -gt 0 }

foreach ($rel in $marketingPages) {
  $full = (Resolve-Path (Join-Path $PSScriptRoot $rel) -ErrorAction SilentlyContinue).Path
  if (-not $full) { continue }

  $content = [System.IO.File]::ReadAllText($full)
  if ($content -match [regex]::Escape($NewWithDescriptor)) { continue }

  $lines = $content -split "`r?`n", 0, "RegexMatch"
  $done = $false

  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($done) { continue }

    $line = $lines[$i]
    $blockSensitive =
      ($line -match "https?://") -or
      ($line -match "\bwww\.") -or
      ($line -match "new URL\(") -or
      ($line -match "\bmetadataBase\b") -or
      ($line -match "\bcanonical\b") -or
      ($line -match "\balternates\b") -or
      ($line -match "\bhreflang\b") -or
      ($line -match "mailto:") -or
      ($line -match "@") -or
      ($line -match "trytenderpilot")

    if (-not $blockSensitive -and $line -match [regex]::Escape($New)) {
      $lines[$i] = ([regex]::Replace($line, [regex]::Escape($New), $NewWithDescriptor, 1))
      $done = $true
    }
  }

  if ($done) {
    [System.IO.File]::WriteAllText($full, ($lines -join "`r`n"))
    Write-Host "Descriptor applied: $rel"
  }
}

# 3) Guard: block TenderRay URLs (but allow plain text/email if it existed)
$changed = git diff --name-only
$badUrlHits = Select-String -Path $changed -Pattern "https?://[^`"'\s]*tenderray\.com" -AllMatches -ErrorAction SilentlyContinue
if ($badUrlHits) {
  $badUrlHits | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber) $($_.Line.Trim())" }
  throw "Blocked: found TenderRay URL strings. URLs must remain trytenderpilot.com."
}

Write-Host "Done. Next: npm run build, then git diff --stat."
