// utils/notificationService.ts

const NOTIF_KEY = 'oncoguide_notif_date';
const NOTIF_TOMORROW_KEY = 'oncoguide_notif_tomorrow_date';

export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
};

export const hasPermission = () =>
    'Notification' in window && Notification.permission === 'granted';

const todayStr = () => new Date().toISOString().split('T')[0];

export const notifyPendientesHoy = (count: number) => {
    if (!hasPermission() || count === 0) return;

    const lastNotif = localStorage.getItem(NOTIF_KEY);
    if (lastNotif === todayStr()) return; // ya notificamos hoy

    localStorage.setItem(NOTIF_KEY, todayStr());

    const notif = new Notification('OncoGuide — Pendientes de hoy', {
        body: `Tenés ${count} tarea${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''} para hoy.`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'pendientes-hoy',
        renotify: false,
    });

    notif.onclick = () => {
        window.focus();
        notif.close();
    };
};

export const notifyPendientesManana = (count: number) => {
    if (!hasPermission() || count === 0) return;

    const hour = new Date().getHours();
    if (hour < 18) return; // solo después de las 18hs

    const lastNotif = localStorage.getItem(NOTIF_TOMORROW_KEY);
    if (lastNotif === todayStr()) return;

    localStorage.setItem(NOTIF_TOMORROW_KEY, todayStr());

    const notif = new Notification('OncoGuide — Recordatorio mañana', {
        body: `Tenés ${count} tarea${count > 1 ? 's' : ''} programada${count > 1 ? 's' : ''} para mañana.`,
        icon: '/favicon.ico',
        tag: 'pendientes-manana',
        renotify: false,
    });

    notif.onclick = () => {
        window.focus();
        notif.close();
    };
};
