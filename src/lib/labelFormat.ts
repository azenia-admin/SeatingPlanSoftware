const ROMAN_MAP: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

function toRoman(num: number): string {
  let result = '';
  for (const [value, numeral] of ROMAN_MAP) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

function toLetter(num: number, uppercase: boolean): string {
  let result = '';
  let n = num;
  while (n > 0) {
    n--;
    const char = String.fromCharCode((n % 26) + (uppercase ? 65 : 97));
    result = char + result;
    n = Math.floor(n / 26);
  }
  return result;
}

export function formatLabel(index: number, format: string): string {
  switch (format) {
    case 'LETTERS':
      return toLetter(index, true);
    case 'letters':
      return toLetter(index, false);
    case 'ROMAN':
      return toRoman(index);
    case 'roman':
      return toRoman(index).toLowerCase();
    default:
      return String(index);
  }
}

export function getMaxForFormat(format: string): number {
  switch (format) {
    case 'LETTERS':
    case 'letters':
      return 702;
    case 'ROMAN':
    case 'roman':
      return 3999;
    default:
      return 9999;
  }
}
