import i18n from '../i18n/config';

export const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: currency,
    }).format(amount);
};

export const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
    }).format(d);
};

export const formatNumber = (num: number) => {
    return new Intl.NumberFormat(i18n.language).format(num);
};
