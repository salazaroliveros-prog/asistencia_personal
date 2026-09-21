cd c:\Users\wilso\Documents\APPS\control_asistencia_app
$env:HEADLESS = "1"
taskkill /f /im node.exe 2>$null
Start-Sleep -Seconds 2
$job = Start-Job { npx vite --host 127.0.0.1 --port 3801 2>$null }
Write-Host "Waiting for Vite..."
$viteUp = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    try {
        $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:3801/index.html")
        $req.Timeout = 3000
        $resp = $req.GetResponse()
        if ($resp.StatusCode -eq 200) { $viteUp = $true; break }
    } catch {}
}
if ($viteUp) {
    Write-Host "Vite is up. Running E2E tests..."
    npx playwright test --config=playwright.qr-camera.config.ts puesto-personalizado --reporter=list > __e2e__/e2e-puesto-output.log 2>&1
    Remove-Job $job -Force
    taskkill /f /im node.exe 2>$null
    Write-Host "=== DONE ==="
} else {
    Write-Host "Vite failed to start"
    Write-Host (Receive-Job $job)
    Stop-Job $job
    Remove-Job $job
}
