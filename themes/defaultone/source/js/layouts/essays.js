// Function to format the dates
function formatEssayDates() {
  const dateElements = document.querySelectorAll(".essay-date");

  if (!dateElements) {
    return;
  }

  dateElements.forEach(function (element) {
    const rawDate = element.getAttribute("data-date");
    const locale = config.language || "en";

    const formattedDate = moment(rawDate).locale(locale).calendar();
    element.textContent = formattedDate;
  });
}

// Initialize Live Photo (实况图) elements handled by hexo-live-photo plugin.
// The plugin binds events once on DOMContentLoaded; with Swup's PJAX navigation
// new containers are inserted without re-binding, so we re-detect after page view.
function initLivePhotos() {
  if (window.livePhotoPage && window.livePhotoPage.detectLivePhotos) {
    window.livePhotoPage.detectLivePhotos();
  }
}

try {
  swup.hooks.on("page:view", function () {
    formatEssayDates();
    initLivePhotos();
  });
} catch (e) {
  console.error(e);
}

// Initial call for the first page load
document.addEventListener("DOMContentLoaded", function () {
  formatEssayDates();
  initLivePhotos();
});
