(function () {
  function limparNome(nome) {
    return String(nome || 'Relatorio_Do_Campo.pdf')
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .replace(/_+/g, '_');
  }

  function baixarNoNavegador(dataUri, nome) {
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  window.DoCampoPDF = {
    async salvarECompartilhar(dataUri, nome, titulo) {
      nome = limparNome(nome);
      const base64 = String(dataUri).includes(',') ? String(dataUri).split(',')[1] : String(dataUri);
      const cap = window.Capacitor;
      const filesystem = cap && cap.Plugins && cap.Plugins.Filesystem;
      const share = cap && cap.Plugins && cap.Plugins.Share;
      if (window.DoCampoDB) window.DoCampoDB.addDocument({ name: nome, title: titulo || 'Relatório Do Campo', generatedAt: new Date().toISOString(), localOnly: true, snapshot: { name: nome, title: titulo || 'Relatório Do Campo' } });

      if (!cap || !cap.isNativePlatform || !cap.isNativePlatform() || !filesystem || !share) {
        baixarNoNavegador('data:application/pdf;base64,' + base64, nome);
        return { navegador: true };
      }

      const gravado = await filesystem.writeFile({
        path: nome,
        data: base64,
        directory: 'CACHE',
        recursive: true
      });

      await share.share({
        title: titulo || 'Relatório Do Campo',
        text: 'Relatório gerado pelo Do Campo SmartFarm',
        url: gravado.uri,
        dialogTitle: 'Salvar ou compartilhar PDF'
      });
      return { uri: gravado.uri };
    }
  };
})();
