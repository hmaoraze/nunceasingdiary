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
        // 不预取音频元数据：播放器是常驻 UI，默认的 auto 会替每个访客多下一个请求
        preload: "none",
        audio: audioList,
      });
    } else if (isFixed) {
      new APlayer({
        container,
        fixed: true,
        lrcType: 3,
        preload: "none",
        audio: audioList,
      });
      // 原实现在这里点了 .aplayer-icon-lrc：会自动展开歌词面板，进而额外拉取
      // LRC 与封面（还是跨域的，控制台一直报 CORS）。改成用户主动点开再加载。
      const cover = container.querySelector(".aplayer-pic img");
      if (cover) {
        cover.loading = "lazy";
        cover.decoding = "async";
      }
    }
  };

  // 脚本以 defer 加载，APlayer 同名库按文档顺序先执行；统一在 DOM 就绪后实例化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlayer, { once: true });
  } else {
    initPlayer();
  }
})();
