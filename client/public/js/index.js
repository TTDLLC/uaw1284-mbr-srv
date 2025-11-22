function initHome() {
  const el = document.createElement('div');
  el.classList.add('notice');
  el.textContent = 'Client JS loaded.';
  document.querySelector('main').appendChild(el);
  console.log('Home page initialized.');
}

document.addEventListener('DOMContentLoaded', initHome);
