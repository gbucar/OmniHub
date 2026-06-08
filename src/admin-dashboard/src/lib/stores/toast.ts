import { writable } from 'svelte/store';

interface ToastState {
	message: string;
	type: 'success' | 'error';
	visible: boolean;
}

const toast = writable<ToastState>({ message: '', type: 'success', visible: false });

let timeoutId: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, type: 'success' | 'error' = 'success') {
	if (timeoutId) clearTimeout(timeoutId);

	toast.set({ message, type, visible: true });

	timeoutId = setTimeout(() => {
		toast.set({ message: '', type: 'success', visible: false });
	}, 3000);
}

export function hideToast() {
	if (timeoutId) clearTimeout(timeoutId);
	toast.set({ message: '', type: 'success', visible: false });
}

export { toast };
