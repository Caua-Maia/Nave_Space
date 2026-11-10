# Publicar e jogar no desktop

## Link fixo (GitHub Pages) — recomendado

1. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Cada push em **`stage-2`** ou **`stage-3`** dispara o workflow *Deploy GitHub Pages*.
3. Link do jogo: **https://caua-maia.github.io/Nave_Space/**

Compartilhe esse endereço no Chrome ou Edge (desktop). Ranking e save ficam no navegador de cada pessoa.

---

## Desktop — link temporário (PC ligado)

1. Na pasta do jogo: `python -m http.server 8080`
2. Em outro terminal: `npx --yes cloudflared tunnel --url http://127.0.0.1:8080`
3. Copie a URL `https://….trycloudflare.com` e mande para a galera (Chrome / Edge).

## Desktop — link fixo (GitHub Pages)

1. No GitHub: **Settings → Pages → Branch `stage-2` → / (root) → Save**
2. Aguarde 1–2 min. Link: `https://caua-maia.github.io/Nave_Space/`
3. Não precisa deixar o PC ligado.

## Celular — APK pelo USB-C

### Opção A — Gerar APK aqui (Capacitor + Android Studio)

Requisitos: [Android Studio](https://developer.android.com/studio) (SDK + platform-tools).

```powershell
cd mobile
npm install
npm run sync:www
npx cap add android
npm run android:build
```

APK: `mobile\android\app\build\outputs\apk\debug\app-debug.apk`

Instalar com cabo (depuração USB ativa):

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
& $adb install -r mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

### Opção B — Sem Android Studio (PWABuilder)

1. Use o link HTTPS do **cloudflared** ou **GitHub Pages**.
2. Abra [PWABuilder](https://www.pwabuilder.com/), cole a URL, gere o pacote Android.
3. Baixe o `.apk`, copie para a pasta **Download** do celular pelo USB (modo transferência de arquivos).
4. No celular, abra o arquivo e permita “Instalar apps desconhecidas” se pedir.

### Celular — só navegador (sem APK)

Abra o mesmo link no Chrome → menu → **Instalar app** / **Adicionar à tela inicial**.
