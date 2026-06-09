# cutover_supabase_sg.ps1 — Migrate Kartavya DB from eu-west-2 (London) to ap-southeast-1 (Singapore)
#
# Before running, set these two env vars in your terminal:
#   $env:OLD_DB_PASS = "<password from Railway DATABASE_URL (eu-west-2 project)>"
#   $env:NEW_DB_PASS = "<password from Supabase dashboard > kartavya-sg > Settings > Database>"
#   New project dashboard: https://supabase.com/dashboard/project/toacecaewujfxjfrjwco

$OLD_HOST  = "db.efzzjcnpjigeffkiissb.supabase.co"
$NEW_HOST  = "db.toacecaewujfxjfrjwco.supabase.co"
$DUMP_FILE = "$PSScriptRoot\kartavya_dump.sql"
$PG_BIN    = "C:\Program Files\PostgreSQL\17\bin"
$pg_dump   = "$PG_BIN\pg_dump.exe"
$psql      = "$PG_BIN\psql.exe"

if (-not (Test-Path $pg_dump)) { Write-Error "pg_dump not found. Is PostgreSQL 17 installed?"; exit 1 }

if (-not $env:OLD_DB_PASS -or -not $env:NEW_DB_PASS) {
    Write-Error @"
Set passwords first:
  `$env:OLD_DB_PASS = '<password from Railway DATABASE_URL>'
  `$env:NEW_DB_PASS = '<new project password — Supabase dashboard > kartavya-sg > Settings > Database>'
"@
    exit 1
}

Write-Host "==> Step 1: Dumping old DB (eu-west-2 London)..." -ForegroundColor Cyan
$env:PGPASSWORD = $env:OLD_DB_PASS
& $pg_dump --no-owner --no-acl --schema=public -h $OLD_HOST -U postgres -d postgres -f $DUMP_FILE
if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump failed"; exit 1 }
Write-Host "    Saved to $DUMP_FILE" -ForegroundColor Green

Write-Host "==> Step 2: Importing into Singapore DB..." -ForegroundColor Cyan
$env:PGPASSWORD = $env:NEW_DB_PASS
& $psql -h $NEW_HOST -U postgres -d postgres -f $DUMP_FILE
if ($LASTEXITCODE -ne 0) { Write-Error "psql import failed"; exit 1 }
Write-Host "    Import complete." -ForegroundColor Green

Write-Host ""
Write-Host "==> Step 3: Update RAILWAY env var" -ForegroundColor Yellow
Write-Host "    DATABASE_URL = postgresql://postgres:$($env:NEW_DB_PASS)@db.toacecaewujfxjfrjwco.supabase.co:5432/postgres" -ForegroundColor Cyan

Write-Host ""
Write-Host "==> Step 4: Update VERCEL env vars" -ForegroundColor Yellow
Write-Host "    VITE_SUPABASE_URL      = https://toacecaewujfxjfrjwco.supabase.co" -ForegroundColor Cyan
Write-Host "    VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvYWNlY2Fld3VqZnhqZnJqd2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODM5NzQsImV4cCI6MjA5NjU1OTk3NH0.B0Wh-rNzEuQ6V1wtvIJyhAPAw3ZFVufgNqlEmBZiMyo" -ForegroundColor Cyan

Write-Host ""
Write-Host "==> Step 5: Change Railway region to Singapore" -ForegroundColor Yellow
Write-Host "    railway.app > kartavya service > Settings > Service Region > ap-southeast-1 (Singapore)" -ForegroundColor White

Write-Host ""
Write-Host "==> Step 6: Redeploy Railway + Vercel, verify app loads, then pause old EU project:" -ForegroundColor Yellow
Write-Host "    https://supabase.com/dashboard/project/efzzjcnpjigeffkiissb/settings/general" -ForegroundColor White
Write-Host ""
Write-Host "Migration complete!" -ForegroundColor Green
