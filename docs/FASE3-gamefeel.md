# FASE 3 — Game feel e balanceamento

## Combo (sobrevivência)
- Só **inimigos / bosses / núcleos mega** contam para o combo (rochas não).
- **3 s** sem acerto: barra entra em queda rápida (`COMBO_DECAY_MUL` 5.5×); o multiplicador cai degrau a degrau.
- HUD mostra **▾** e destaque laranja enquanto decai.

## Naves (`SHIP_ROSTER` em `js/entities.js`)
| Nave | Movimento | Vida | Dano recebido | Tiro |
|------|-----------|------|---------------|------|
| Lança | 340 | 100 | 1× | Padrão (homing ao acertar) |
| Dardo | 442 (+30%) | 50 | **2×** (`incomingDmgMul`) | Cadência alta (`gap` 0.048) |
| Bastião | 272 (−20%) | 300 (3×) | 1× | **5 pellets** spread 0.26 |

Cor do Bastião: `#ffb347`.

## Juice
- **Screen shake:** dano (11), escudo (8), mega derrotado (14), beam mega, buff **T** multi (13).
- **Hit stop:** ~43 ms inimigos grandes (block/orbit/score ≥220); ~48 ms bosses e megas. Loop pula `update` enquanto `hitStopLeft > 0`.

## Teste
1. Sobrevivência: pare de atirar 3 s → combo cai rápido.
2. Hangar: sinta Dardo frágil e Bastião tank/shotgun.
3. Mate um boss → micro-pausa + tremor.
