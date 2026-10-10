export function bindHandlers(handlers, target = document) {
  target.addEventListener('click', handlers.click);
  target.addEventListener('change', handlers.change);
  target.addEventListener('submit', handlers.submit);
}
