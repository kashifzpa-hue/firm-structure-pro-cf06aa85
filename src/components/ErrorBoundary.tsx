import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional label used in the message, e.g. "Org chart". */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors so a failure in one screen cannot blank the
 * whole application. Place at the app root and around risky subtrees.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {this.props.label ? `${this.props.label} failed to load` : "Something went wrong"}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. Your data has not been changed. Try again, or reload the page if the problem
            continues.
          </p>
          <p className="pt-2 text-xs text-muted-foreground/70">{error.message}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={this.reset}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
