import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n";
import { useDeveloperStore } from "../store/developerStore";

type Props = { children: ReactNode };

type State = { error: Error | null };

/**
 * Catches render errors so the WebView is not a blank screen; full stack only in developer mode.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Лог для отладки в Tauri / DevTools
    console.error("[AppErrorBoundary]", error.message, error.stack, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      const developerMode = useDeveloperStore.getState().developerMode;
      return (
        <div
          className="flex min-h-0 flex-1 flex-col overflow-auto p-4 text-[var(--text-primary)]"
          role="alert"
        >
          <h2 className="text-lg font-semibold text-[var(--warning)]">
            {i18n.t("errors.uiErrorTitle")}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{i18n.t("errors.uiErrorBody")}</p>
          {developerMode ? (
            <pre className="mt-3 max-h-[min(60vh,28rem)] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/50 p-3 font-mono text-[11px] leading-relaxed">
              {error.message}
              {"\n\n"}
              {error.stack ?? ""}
            </pre>
          ) : (
            <p className="mt-3 text-xs text-[var(--text-secondary)]">{i18n.t("errors.uiErrorDevHint")}</p>
          )}
          <button
            className="mt-4 w-fit rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            onClick={() => this.setState({ error: null })}
            type="button"
          >
            {i18n.t("errors.dismiss")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
