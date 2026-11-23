const filter = document.querySelector("[data-ris-date-filter]");
if (filter) {
  const date = filter.elements.namedItem("date");
  date.addEventListener("change", () => {
    if (date.value && date.checkValidity()) filter.requestSubmit();
  });
}
