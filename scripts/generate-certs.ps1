# Script para gerar certificados SSL locais para o contêiner do PostgreSQL
# Executar este script usando o Git OpenSSL no Windows

$OpenSSLPath = "C:\Program Files\Git\usr\bin\openssl.exe"
$CertDir = "db-certs"

if (-not (Test-Path $OpenSSLPath)) {
    Write-Error "O OpenSSL do Git não foi encontrado em $OpenSSLPath. Certifique-se de que o Git está instalado no local padrão."
    exit 1
}

if (-not (Test-Path $CertDir)) {
    New-Item -ItemType Directory -Path $CertDir -Force
}

# Gerar chave e certificado autoassinados para localhost (válido por 10 anos)
& $OpenSSLPath req -new -x509 -days 3650 -nodes -out "$CertDir/server.crt" -keyout "$CertDir/server.key" -subj "/CN=localhost"

Write-Host "Certificados SSL locais gerados com sucesso na pasta '$CertDir/'!"
