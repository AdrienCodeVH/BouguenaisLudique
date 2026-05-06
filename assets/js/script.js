const infoButton = document.getElementById("infoButton");

if (infoButton) {
  infoButton.addEventListener("click", () => {
    alert("Le site Bouguenais Ludique est en cours de construction.");
  });
}

const slideLayout = document.querySelector(".slide-layout");
const slideTrack = document.querySelector(".slide-track");
const slidePanels = slideTrack ? Array.from(slideTrack.querySelectorAll(".slide-panel")) : [];
let activeSlide = 0;
let isLocked = false;

function goToSlide(index) {
  if (!slideTrack || slidePanels.length === 0) {
    return;
  }

  const nextIndex = Math.max(0, Math.min(index, slidePanels.length - 1));

  if (nextIndex === activeSlide) {
    return;
  }

  activeSlide = nextIndex;
  slideTrack.style.transform = `translateX(-${activeSlide * 100}%)`;
}

if (slideLayout && slidePanels.length > 1) {
  window.addEventListener("wheel", (event) => {
    if (window.innerWidth <= 900) {
      return;
    }

    event.preventDefault();

    if (isLocked) {
      return;
    }

    const direction = Math.sign(event.deltaY);
    if (direction === 0) {
      return;
    }

    isLocked = true;
    goToSlide(activeSlide + direction);

    window.setTimeout(() => {
      isLocked = false;
    }, 620);
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    if (window.innerWidth <= 900) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      goToSlide(activeSlide + 1);
    }

    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      goToSlide(activeSlide - 1);
    }
  });
}

const comingSoonMessage = "Ce contenu arrive prochainement.";
const comingSoonCardText = "Bientôt disponible.";

function markCardAsComingSoon(trigger) {
  if (!trigger.classList.contains("card")) {
    return false;
  }

  const paragraphs = trigger.querySelectorAll("p");
  if (paragraphs.length === 0) {
    return false;
  }

  paragraphs.forEach((paragraph) => {
    paragraph.textContent = comingSoonCardText;
  });

  return true;
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const trigger = target.closest("[data-coming-soon]");
  if (!trigger) {
    return;
  }

  event.preventDefault();
  if (!markCardAsComingSoon(trigger)) {
    window.alert(comingSoonMessage);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (!target.closest("[data-coming-soon]")) {
    return;
  }

  event.preventDefault();
  const trigger = target.closest("[data-coming-soon]");
  if (!trigger || !markCardAsComingSoon(trigger)) {
    window.alert(comingSoonMessage);
  }
});
