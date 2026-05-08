import * as React from "react";
const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

type ToasterToast = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactElement;
  variant?: "default" | "destructive";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

let count = 0;
function genId() { count = (count + 1) % Number.MAX_SAFE_INTEGER; return count.toString(); }

type State = { toasts: ToasterToast[] };
const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: { type: string; toast?: Partial<ToasterToast>; toastId?: string }) {
  switch (action.type) {
    case "ADD_TOAST":
      memoryState = { toasts: [action.toast as ToasterToast, ...memoryState.toasts].slice(0, TOAST_LIMIT) };
      break;
    case "UPDATE_TOAST":
      memoryState = { toasts: memoryState.toasts.map(t => t.id === action.toast?.id ? { ...t, ...action.toast } : t) };
      break;
    case "DISMISS_TOAST":
      memoryState = { toasts: memoryState.toasts.map(t => (!action.toastId || t.id === action.toastId) ? { ...t, open: false } : t) };
      setTimeout(() => dispatch({ type: "REMOVE_TOAST", toastId: action.toastId }), TOAST_REMOVE_DELAY);
      break;
    case "REMOVE_TOAST":
      memoryState = { toasts: action.toastId ? memoryState.toasts.filter(t => t.id !== action.toastId) : [] };
      break;
  }
  listeners.forEach(l => l(memoryState));
}

type Toast = Omit<ToasterToast, "id">;

function toast(props: Toast) {
  const id = genId();
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });
  dispatch({ type: "ADD_TOAST", toast: { ...props, id, open: true, onOpenChange: (open) => { if (!open) dismiss(); } } });
  return { id, dismiss };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => { const i = listeners.indexOf(setState); if (i > -1) listeners.splice(i, 1); };
  }, []);
  return { ...state, toast, dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }) };
}

export { useToast, toast };
