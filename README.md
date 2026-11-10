# Dual-Stick Space Survivor

Jogo 2D estilo Asteroids + twin-stick shooter. Roda no navegador (Chrome / Edge).

## Jogar online (desktop)

Depois de ativar o GitHub Pages (Settings → Pages → **GitHub Actions**), o Stage 2 fica em:

**https://caua-maia.github.io/Nave_Space/**

Passo a passo completo: [docs/JOGAR-E-APK.md](docs/JOGAR-E-APK.md) (seção GitHub Pages).

## Como jogar (local)

1. Dê um duplo clique em `index.html` **ou** sirva a pasta:

```powershell
cd "c:\Users\Force\Downloads\Projetos\Game"
python -m http.server 8080
```

2. Abra `http://localhost:8080`
3. Clique uma vez na janela do jogo (o navegador só libera o gamepad depois de um gesto)
4. Conecte o DualShock 4 por USB ou Bluetooth e aperte qualquer botão

### DualShock 4

| Controle | Ação |
| --- | --- |
| Analógico esquerdo | Move a nave 360° |
| Analógico direito | Mira |
| R2 (ou empurrar o direito) | Atira |
| Options | Pausa |
| X | Iniciar / reiniciar |

### Teclado

WASD move, mouse mira, clique ou Espaço atira, Esc pausa, Enter inicia.

## O que já está no jogo

- Movimento livre + wrap de tela (sai de um lado, entra no outro)
- Meteoros que se partem em pedaços menores
- Inimigos perseguidores e atiradores (depois da onda inicial)
- Combo / multiplicador de pontuação
- Vida, i-frames, game over, save e ranking (`localStorage` + Supabase)
- Conta por `pilotId` (UUID), nomes iguais diferenciados no top 10 (`Nome #XXXX`)
- Power-ups: tiro rápido, escudo, triplo
- Partículas, shake, rumble (se o Chrome permitir)
- Sons procedurais (Web Audio)

## O que falta (próximos passos)

- **Arte e música de verdade** — sprites, explosões e trilha (hoje é vetor + beeps)
- **Balanceamento de bosses / campanha** — testes manuais contínuos
- **Godot / build desktop** — o projeto é HTML5; não há `.exe` nem projeto Godot
- **DS4Windows** — só se o Chrome não listar o pad (Steam Input / DS4Windows em modo XInput ajuda)
- **Teste real no seu DualShock 4** — mapeamento extra de eixos 2/5 já está no código, mas precisa validar no hardware
- **Mobile / toque** — sticks virtuais em evolução (`touch.js`)
- **Anti-cheat forte** — validação leve na nuvem; competição séria exigiria Edge Function

### Ranking e nuvem

- Local: `space-survivor-save-v2` · Global: Supabase (`js/cloud.js`)
- Migração SQL (ordem): `docs/supabase-pilot-id.sql` → `supabase-pilot-id-rls-step3.sql` → `supabase-pilot-id-guard-step4.sql`
- Detalhes: [docs/PILOT-ID-ETAPAS.md](docs/PILOT-ID-ETAPAS.md)
