/** The Smart / Scan / Manual choice, shared by the popup and settings page. */
import { getSettings, updateSettings } from '../core/storage/settings';
import type { Mode } from '../core/types';

export const MODES: { value: Mode; label: string; help: string }[] = [
  { value: 'smart', label: 'Smart', help: 'Icons appear by article links on sites you turn on.' },
  { value: 'scan', label: 'Scan', help: 'No icons until you press "Scan this page".' },
  { value: 'manual', label: 'Manual', help: 'No icons. Right-click a link and choose "Peek".' },
];

export async function renderModePicker(container: HTMLElement): Promise<void> {
  const current = (await getSettings()).mode;
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'modes';
  const legend = document.createElement('legend');
  legend.textContent = 'Mode';
  fieldset.append(legend);
  for (const m of MODES) {
    const label = document.createElement('label');
    label.className = 'mode';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'mode';
    input.value = m.value;
    input.checked = m.value === current;
    input.addEventListener('change', () => {
      if (input.checked) void updateSettings({ mode: m.value });
    });
    const text = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = m.label;
    const help = document.createElement('span');
    help.className = 'muted';
    help.textContent = ` ${m.help}`;
    text.append(strong, help);
    label.append(input, text);
    fieldset.append(label);
  }
  container.append(fieldset);
}
