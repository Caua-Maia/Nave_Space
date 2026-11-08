# Sobe o jogo na raiz do repo (nao em mobile/).
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$port = 8080
$listeners = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
foreach ($line in $listeners) {
    if ($line -match "\s+(\d+)\s*$") {
        $pid = [int]$Matches[1]
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -match "python") {
            Write-Host "Encerrando Python antigo na porta $port (PID $pid)..."
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host ""
Write-Host "Nave_Space em: $root"
Write-Host "Abra: http://localhost:$port"
Write-Host "Se a tela parecer quebrada: DevTools > Application > Limpar dados do site (localhost)"
Write-Host ""
python -m http.server $port
