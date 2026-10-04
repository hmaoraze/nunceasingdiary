export default function initEssays() {
  const dateElements = document.querySelectorAll(".essay-date");

  if (!dateElements.length) {
    return;
  }

  dateElements.forEach((element) => {
    const rawDate = element.getAttribute("data-date");
    const locale = config.language || "en";

    const formattedDate = moment(rawDate).locale(locale).calendar();
    element.textContent = formattedDate;
  });

  initLivePhotos();
}

// Re-detect Live Photo (实况图) containers on every page view.
// The inline scripts in essays.ejs instantiate LivePhotoPage once on first load;
// with Swup's PJAX navigation new containers are inserted without re-binding,
// so we re-detect after each page view.
function initLivePhotos() {
  if (window.livePhotoPage && window.livePhotoPage.detectLivePhotos) {
    window.livePhotoPage.detectLivePhotos();
  }
}
