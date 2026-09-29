const NUMBER_WORDS = new Map([
  ['zero', 0],
  ['un', 1],
  ['deux', 2],
  ['trois', 3],
  ['quatre', 4],
  ['cinq', 5],
  ['six', 6],
  ['sept', 7],
  ['huit', 8],
  ['neuf', 9],
  ['dix', 10],
  ['onze', 11],
  ['douze', 12],
  ['treize', 13],
  ['quatorze', 14],
  ['quinze', 15],
  ['seize', 16],
  ['vingt', 20],
  ['vingts', 20],
  ['trente', 30],
  ['quarante', 40],
  ['cinquante', 50],
  ['soixante', 60],
]);

export const normalizeFrenchAnswer = (value) => value
  .trim()
  .toLocaleLowerCase('fr-FR')
  .normalize('NFC');

export const withoutFrenchAccents = (value) => normalizeFrenchAnswer(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export const parseFrenchNumber = (value) => {
  const normalized = withoutFrenchAccents(value)
    .replace(/[\u00a0\s]+/g, ' ')
    .trim();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) return Number(normalized);

  const tokens = normalized
    .replace(/[-']/g, ' ')
    .split(/\s+/)
    .filter((token) => token !== 'et');

  let current = 0;
  let recognized = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === 'quatre' && (tokens[index + 1] === 'vingt' || tokens[index + 1] === 'vingts')) {
      current += 80;
      recognized = true;
      index += 1;
      continue;
    }
    if (token === 'cent' || token === 'cents') {
      current = (current || 1) * 100;
      recognized = true;
      continue;
    }
    const amount = NUMBER_WORDS.get(token);
    if (amount === undefined) return null;
    current += amount;
    recognized = true;
  }

  return recognized ? current : null;
};

export const dictationAnswersMatch = (value, expected) => {
  if (normalizeFrenchAnswer(value) === normalizeFrenchAnswer(expected)) return true;
  const valueAsNumber = parseFrenchNumber(value);
  const expectedAsNumber = parseFrenchNumber(expected);
  return valueAsNumber !== null
    && expectedAsNumber !== null
    && valueAsNumber === expectedAsNumber;
};
