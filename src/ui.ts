import type { ArtworkMeta } from './types';

export function setupUI() {
  const help = document.getElementById('help')!;
  const helpBtn = document.getElementById('helpBtn')!;
  const plaque = document.getElementById('plaque')!;
  const plaqueTitle = document.getElementById('plaqueTitle')!;
  const plaqueMeta = document.getElementById('plaqueMeta')!;

  const toggleHelp = () => help.classList.toggle('hidden');
  helpBtn.addEventListener('click', toggleHelp);
  window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'h') toggleHelp(); });

  function showPlaque(meta: ArtworkMeta | null) {
    if (!meta) { plaque.classList.add('hidden'); return; }
    (plaqueTitle as HTMLElement).textContent = meta.title ?? meta.file;
    (plaqueMeta as HTMLElement).textContent =
      [meta.author, meta.year].filter(Boolean).join(' • ') || '';
    plaque.classList.remove('hidden');
  }
  return { showPlaque };
}