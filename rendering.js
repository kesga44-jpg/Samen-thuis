export function renderCollection(items, renderItem, emptyMessage) {
  return items.map(renderItem).join('') || `<li class="empty-row">${emptyMessage}</li>`;
}

export function renderError(message, retryAction, retryLabel = 'Opnieuw proberen') {
  return `<p class="quote-note muted">${message} <button type="button" class="button button-secondary button-small" data-retry="${retryAction}">${retryLabel}</button></p>`;
}
