# FASE 4 — Object pooling (mobile)

## Tiros (`BulletPool` em `js/entities.js`)
- Pré-aloca **192** instâncias no carregamento (`warm`).
- `spawnPooledBullet` → `obtain`; `cutBullet` / `pruneLive` → `release`.
- Até **384** objetos guardados no pool livre.
- Flag `active` em cada bala (inativa no pool).

## Inimigos (`EnemyPool`)
- Pré-aloca **64** inimigos.
- `spawnPooledEnemy(list, x, y, type, scale)` no spawn e no sync online.
- Morte: `releaseEnemyAt` (devolve ao pool) em vez de `new Enemy` + descarte.
- `drainEnemies` / `drainBullets` em `resetArena`, mega alert e restore de sessão.

## O que não entrou nesta fase
- Rochas, bosses, power-ups e partículas (partículas já tinham pool).
- Array ativo continua listando só entidades vivas; o ganho é **menos GC** ao reciclar `Bullet`/`Enemy`.

## Smoke test
1. Sobrevivência onda alta — FPS estável no Android (DevTools Performance: menos picos de GC).
2. Dois pilotos (guest): sync de inimigos sem vazar referências após sair da sala.
