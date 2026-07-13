import { writable } from 'svelte/store';

interface ToastState {
	message: string;
	type: 'success' | 'error';
	visible: boolean;
}

const DEFAULT_DURATION_MS = 3000;
const LONG_DURATION_MS = 10000;

const toast = writable<ToastState>({ message: '', type: 'success', visible: false });

let timeoutId: ReturnType<typeof setTimeout> | null = null;

export function showToast(
	message: string,
	type: 'success' | 'error' = 'success',
	durationMs: number = DEFAULT_DURATION_MS
) {
	if (timeoutId) clearTimeout(timeoutId);

	toast.set({ message, type, visible: true });

	timeoutId = setTimeout(() => {
		toast.set({ message: '', type: 'success', visible: false });
	}, durationMs);
}

/**
 * Convenience for long / multi-line import summaries that the admin
 * needs to read in full before they disappear. Renders identically
 * to `showToast` but stays on screen for 10s instead of 3s.
 */
export function showLongToast(message: string, type: 'success' | 'error' = 'success') {
	showToast(message, type, LONG_DURATION_MS);
}

export function hideToast() {
	if (timeoutId) clearTimeout(timeoutId);
	toast.set({ message: '', type: 'success', visible: false });
}

export { toast };
