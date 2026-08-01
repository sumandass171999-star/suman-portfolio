$portsToTry = @(5173, 5174, 5175, 3000, 8000, 8080)
$listener = $null
$selectedPort = 0

foreach ($port in $portsToTry) {
    try {
        $testListener = New-Object System.Net.HttpListener
        $testListener.Prefixes.Add("http://localhost:$port/")
        $testListener.Start()
        $listener = $testListener
        $selectedPort = $port
        break
    } catch {
        if ($testListener) { $testListener.Close() }
    }
}

if (-not $listener) {
    Write-Host "Failed to find an open port."
    exit 1
}

Write-Host "Server running on http://localhost:$selectedPort/"

$rootDir = (Get-Item .).FullName

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath).TrimStart('/')
        if ([string]::IsNullOrEmpty($rawPath)) {
            $rawPath = "index.html"
        }
        $relPath = $rawPath.Replace('/', '\')
        
        $filePath = [System.IO.Path]::Combine($rootDir, $relPath)
        if (-not (Test-Path $filePath -PathType Leaf)) {
            $filePath = [System.IO.Path]::Combine($rootDir, "public", $relPath)
        }

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()

            switch ($ext) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                ".jpeg" { $response.ContentType = "image/jpeg" }
                ".png"  { $response.ContentType = "image/png" }
                ".svg"  { $response.ContentType = "image/svg+xml" }
                ".json" { $response.ContentType = "application/json" }
                default { $response.ContentType = "application/octet-stream" }
            }

            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Cache-Control", "public, max-age=3600")
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        $response.Close()
    } catch {
        # Connection closed or handled
    }
}
