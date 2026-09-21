# Visual Logic

Este projeto foi estruturado para ser hospedado no GitHub Pages. 
Ele é um simulador de programação por blocos simples, construído com HTML, TailwindCSS e Vanilla JavaScript.

## Estrutura de Arquivos

- `index.html`: Arquivo principal da aplicação.
- `style.css`: Estilos customizados.
- `script.js`: Toda a lógica de drag-and-drop, execução de blocos, variáveis e estado da aplicação.
- `robot.png`: A imagem utilizada para o ator (sprite) no palco.

## Melhorias Implementadas

1. **Separação de Preocupações:** O arquivo único original foi dividido em HTML, CSS e JS para manter as boas práticas.
2. **Correção da Imagem:** O Sprite do robô estava apontando para um blob (endereço temporário). Alterado para usar `robot.png` localmente.
3. **Salvar e Carregar Projetos:** O botão original de baixar exportava toda a página HTML (que já não era ideal). Foi substituído por botões **Abrir** e **Salvar**. Agora, os projetos são exportados como arquivos `.json` limpos que conservam as posições dos blocos, valores e variáveis declaradas, e podem ser facilmente recarregados.
4. **Limpeza de Scripts Injetados:** Removemos os scripts que tinham sido injetados erroneamente (possivelmente pelo editor original), para limpar os alertas de erro e aumentar a performance da aplicação.

## Como publicar no GitHub Pages

1. Crie um novo repositório no GitHub.
2. Faça o upload dos arquivos dentro desta pasta (`index.html`, `style.css`, `script.js`, `robot.png`) para o repositório criado.
3. Vá nas configurações do repositório (**Settings**).
4. No menu lateral, acesse **Pages**.
5. Na seção **Build and deployment**, selecione o branch `main` (ou `master`) na raiz (`/root`) e clique em **Save**.
6. Aguarde alguns minutos e o GitHub mostrará a URL onde seu site está disponível!
