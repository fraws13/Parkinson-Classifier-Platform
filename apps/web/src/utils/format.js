export const number = value => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value);
export const date = value => new Date(value).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
