(function() {
  const initPlayer = function () {
    const audioList = [];
    const isFixed = theme.plugins.aplayer.type === "fixed";
    const isMini = theme.plugins.aplayer.type === "mini";

    for (const audio of theme.plugins.aplayer.audios) {
      const audioObj = {
        name: audio.name,
        artist: audio.artist,
        url: audio.url,
        cover: audio.cover,
        lrc: audio.lrc,
        theme: audio.theme,
      };
      audioList.push(audioObj);
    }

    const container = document.getElementById("aplayer");
    if (!container || typeof APlayer === "undefined") {
      return;
    }

    if (isMini) {
      new APlayer({
        container,
        mini: true,
        audio: audioList,
      });
    } else if (isFixed) {
      const player = new APlayer({
        container,
        fixed: true,
        lrcType: 3,
        audio: audioList,
      });
      document.querySelector(".aplayer-icon-lrc").click();
    }
  };

  // 脚本以 defer 加载，APlayer 同名库按文档顺序先执行；统一在 DOM 就绪后实例化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlayer, { once: true });
  } else {
    initPlayer();
  }
})();
