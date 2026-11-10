# FASE 2 — UX, UI e persistência

## Manual inteligente (`js/help-controls.js`)
- Perfil **mobile** (Platform + user agent), **gamepad** (Gamepad API) ou **teclado/mouse**.
- Só um bloco de instruções visível em COMO JOGAR.
- Reaplica ao conectar o controle na tela de ajuda.

## Dois pilotos
- Removido aviso sobre “conta na nuvem” nas opções.
- `Cloud.watchCoop()` testa WebSocket Realtime em background (a cada 45 s).
- Botão **DOIS PILOTOS**: desabilitado + cadeado + “SERVIDOR INDISPONÍVEL” se falhar.
- Ative em Configurações → “Mostrar dois pilotos no menu”.

## Save / HUD
- **Sobrevivência:** sem salvar partida (pausa, menu, CONTINUAR).
- **História:** salvar na pausa intacto.
- Posição do HUD: `layout` + `layoutCustom` em `localStorage` (`space-survivor-save-v2`); reabre automaticamente via `Settings.apply()`.

## Teste rápido
1. COMO JOGAR em PC sem pad → só teclado; conecte pad e reabra.
2. Desligue rede → botão dois pilotos bloqueado após ~5 s.
3. Sobrevivência → pausa sem “Salvar progresso”; história → com salvar.
4. Arrastar HUD → recarregar → posições mantidas.
