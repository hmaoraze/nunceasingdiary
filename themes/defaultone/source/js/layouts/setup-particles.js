// Initialize particles.js (encapsulated so it can be imported as an ES module)
//
// 性能约束（改造前是全屏 100 粒子 + retina 放大 + 常驻 rAF，移动端长任务的主要来源）：
//   · 粒子数降到 36，关闭 retina 放大（DPR 3 时等于白画 9 倍像素）
//   · 视口窄于 1024px 不初始化：手机上看不出差别，却要一直跑动画
//   · 系统开启"减少动态效果"时不初始化
//   · 切到后台标签页、或首页横幅滚出视口时暂停 rAF

const PARTICLES_ID = "particles-js";
const MIN_VIEWPORT_WIDTH = 1024;

let paused = false;

const getInstance = () => {
  const list = window.pJSDom;
  return Array.isArray(list) && list.length ? list[0] : null;
};

const pause = () => {
  const inst = getInstance();
  if (paused || !inst || !inst.pJS) return;
  paused = true;
  cancelAnimationFrame(inst.pJS.fn.drawAnimFrame);
};

const resume = () => {
  const inst = getInstance();
  if (!paused || !inst || !inst.pJS) return;
  paused = false;
  // vendors.draw 会画一帧并重新排下一帧，等价于恢复原来的 rAF 循环
  if (inst.pJS.fn.vendors && typeof inst.pJS.fn.vendors.draw === "function") {
    inst.pJS.fn.vendors.draw();
  }
};

const initParticles = () => {
  const mainDiv = document.getElementById(PARTICLES_ID);
  if (!mainDiv || typeof particlesJS === "undefined") {
    return;
  }

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  if (window.innerWidth < MIN_VIEWPORT_WIDTH) {
    return;
  }

  particlesJS(PARTICLES_ID, {
    "particles": {
      "number": {
        "value": 36,
        "density": {
          "enable": true,
          "value_area": 1000
        }
      },
      "color": {
        "value": "#ffffff"
      },
      "shape": {
        "type": "circle",
        "stroke": {
          "width": 0,
          "color": "#000000"
        },
        "polygon": {
          "nb_sides": 5
        }
      },
      "opacity": {
        "value": 0.5,
        "random": true,
        "anim": {
          "enable": true,
          "speed": 1,
          "opacity_min": 0.1,
          "sync": false
        }
      },
      "size": {
        "value": 3,
        "random": true,
        "anim": {
          "enable": true,
          "speed": 2,
          "size_min": 0.1,
          "sync": false
        }
      },
      "line_linked": {
        "enable": false,
        "distance": 150,
        "color": "#ffffff",
        "opacity": 0.4,
        "width": 1
      },
      "move": {
        "enable": true,
        "speed": 1,
        "direction": "bottom",
        "random": true,
        "straight": false,
        "out_mode": "out",
        "bounce": false,
        "attract": {
          "enable": false,
          "rotateX": 600,
          "rotateY": 1200
        }
      }
    },
    "interactivity": {
      "detect_on": "canvas",
      "events": {
        "onhover": {
          "enable": false,
          "mode": "repulse"
        },
        "onclick": {
          "enable": false,
          "mode": "push"
        },
        "resize": true
      },
      "modes": {
        "grab": {
          "distance": 400,
          "line_linked": {
            "opacity": 1
          }
        },
        "bubble": {
          "distance": 400,
          "size": 40,
          "duration": 2,
          "opacity": 8,
          "speed": 3
        },
        "repulse": {
          "distance": 200
        },
        "push": {
          "particles_nb": 4
        },
        "remove": {
          "particles_nb": 2
        }
      }
    },
    "retina_detect": false
  });

  // 切到后台时停掉动画，回来再继续
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pause();
    } else {
      resume();
    }
  });

  // 首页横幅滚出视口后，粒子已经看不见了，没必要继续跑
  const banner = document.querySelector(".home-banner-container");
  if (banner && "IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            resume();
          } else {
            pause();
          }
        });
      },
      { threshold: 0 }
    ).observe(banner);
  }
};

export default initParticles;
