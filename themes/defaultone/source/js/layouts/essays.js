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

// Initialize Live Photo (实况图) elements that are not yet initialized.
// Works both on first load and after Swup page transitions.
function initLivePhotos() {
  if (window.LivePhotoViewer && window.LivePhotoViewer.autoInit) {
    window.LivePhotoViewer.autoInit(document);
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
